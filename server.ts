import express from "express";
import path from "path";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import http from "http";
import https from "https";

const httpAgent = new http.Agent({ keepAlive: true, timeout: 1800000 });
const httpsAgent = new https.Agent({ keepAlive: true, timeout: 1800000 });

// Local log recorder
function logToFile(msg: string) {
  try {
    const logMsg = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(path.join(process.cwd(), "server.log"), logMsg);
    console.log(`[ServerLog] ${msg}`);
  } catch (e) {
    console.error('[ServerLog] Write failed:', e);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB per file
      files: 10,
      fieldSize: 100 * 1024 * 1024 // 100MB for fields
    }
  });

  // Global request logger
  app.use((req, res, next) => {
    if (req.url.startsWith('/api/')) {
      logToFile(`[RequestLog] ${req.method} ${req.url} - Content-Length: ${req.headers['content-length'] || 'none'} - Content-Type: ${req.headers['content-type'] || 'none'}`);
    }
    next();
  });

  // API Proxy Endpoint
  app.all("/api/generate", (req, res, next) => {
    if (req.method !== 'POST') {
      logToFile(`Received unsupported non-POST request to /api/generate: ${req.method}`);
      return res.status(405).json({
        error: `HTTP method ${req.method} is not supported for /api/generate. Please use POST.`,
        methodReceived: req.method
      });
    }
    
    upload.array('images', 9)(req, res, (err) => {
      if (err) {
        logToFile(`Multer upload error: ${err.message}`);
        return res.status(400).json({ 
          error: "Multipart upload failed", 
          details: err.message,
          code: (err as any).code
        });
      }
      next();
    });
  }, async (req: any, res) => {
    let heartbeatInterval: NodeJS.Timeout | null = null;

    try {
      const { 
        prompt, 
        model, 
        aspect_ratio, 
        resolution,
        custom_api_key,
        custom_api_url
      } = req.body;

      // Resolve endpoint URL and key
      let targetUrl = custom_api_url || process.env.EXTERNAL_API_URL || "https://grsai.dakka.com.cn/v1/api/generate";
      if (targetUrl) {
        targetUrl = targetUrl.replace(/\/$/, '');
        if (!targetUrl.includes('/v1/api/')) {
          targetUrl += '/v1/api/generate';
        }
      }
      const apiKey = custom_api_key || process.env.EXTERNAL_API_KEY;

      const files = (req.files as any[]) || [];

      logToFile(`\n--- NEW proxy request ---`);
      logToFile(`Model: ${model}`);
      logToFile(`Prompt: "${prompt}"`);
      logToFile(`Aspect Ratio: ${aspect_ratio}`);
      logToFile(`Resolution: ${resolution}`);
      logToFile(`Target endpoint: ${targetUrl}`);
      logToFile(`API Key length: ${apiKey ? apiKey.length : 0} (starts with Bearer: ${apiKey ? apiKey.startsWith('Bearer ') : false})`);
      logToFile(`Attached images: ${files.length}`);

      let response;
      try {
        // Reverse resolution mapping helper dictionary
        const REVERSE_VIP_RESOLUTION_MAP: Record<string, { ratio: string, resolution: string }> = {
          '1024x1024': { ratio: '1:1', resolution: '1K' },
          '2048x2048': { ratio: '1:1', resolution: '2K' },
          '2880x2880': { ratio: '1:1', resolution: '4K' },
          '1280x720': { ratio: '16:9', resolution: '1K' },
          '2048x1152': { ratio: '16:9', resolution: '2K' },
          '3840x2160': { ratio: '16:9', resolution: '4K' },
          '720x1280': { ratio: '9:16', resolution: '1K' },
          '1152x2048': { ratio: '9:16', resolution: '2K' },
          '2160x3840': { ratio: '9:16', resolution: '4K' },
          '1152x864': { ratio: '4:3', resolution: '1K' },
          '2304x1728': { ratio: '4:3', resolution: '2K' },
          '3264x2448': { ratio: '4:3', resolution: '4K' },
          '864x1152': { ratio: '3:4', resolution: '1K' },
          '1728x2304': { ratio: '3:4', resolution: '2K' },
          '2448x3264': { ratio: '3:4', resolution: '4K' },
          '1536x1024': { ratio: '3:2', resolution: '1K' },
          '2048x1360': { ratio: '3:2', resolution: '2K' },
          '3504x2336': { ratio: '3:2', resolution: '4K' },
          '1024x1536': { ratio: '2:3', resolution: '1K' },
          '1360x2048': { ratio: '2:3', resolution: '2K' },
          '2336x3504': { ratio: '2:3', resolution: '4K' },
          '1120x896': { ratio: '5:4', resolution: '1K' },
          '2240x1792': { ratio: '5:4', resolution: '2K' },
          '3200x2560': { ratio: '5:4', resolution: '4K' },
          '896x1120': { ratio: '4:5', resolution: '1K' },
          '1792x2240': { ratio: '4:5', resolution: '2K' },
          '2560x3200': { ratio: '4:5', resolution: '4K' },
          '1456x624': { ratio: '21:9', resolution: '1K' },
          '2912x1248': { ratio: '21:9', resolution: '2K' },
          '3840x1648': { ratio: '21:9', resolution: '4K' },
          '624x1456': { ratio: '9:21', resolution: '1K' },
          '1248x2912': { ratio: '9:21', resolution: '2K' },
          '1648x3840': { ratio: '9:21', resolution: '4K' },
          '1536x768': { ratio: '2:1', resolution: '1K' },
          '3072x1536': { ratio: '2:1', resolution: '2K' },
          '3840x1920': { ratio: '2:1', resolution: '4K' },
          '768x1536': { ratio: '1:2', resolution: '1K' },
          '1536x3072': { ratio: '1:2', resolution: '2K' },
          '1920x3840': { ratio: '1:2', resolution: '4K' },
          '2048x688': { ratio: '3:1', resolution: '1K' },
          '3840x1280': { ratio: '3:1', resolution: '4K' },
          '688x2048': { ratio: '1:3', resolution: '1K' },
          '1280x3840': { ratio: '1:3', resolution: '4K' }
        };

        const FORWARD_VIP_RESOLUTION_MAP: Record<string, Record<string, string>> = {
          '1:1': { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880' },
          '16:9': { '1K': '1280x720', '2K': '2048x1152', '4K': '3840x2160' },
          '9:16': { '1K': '720x1280', '2K': '1152x2048', '4K': '2160x3840' },
          '4:3': { '1K': '1152x864', '2K': '2304x1728', '4K': '3264x2448' },
          '3:4': { '1K': '864x1152', '2K': '1728x2304', '4K': '2448x3264' },
          '3:2': { '1K': '1536x1024', '2K': '2048x1360', '4K': '3504x2336' },
          '2:3': { '1K': '1024x1536', '2K': '1360x2048', '4K': '2336x3504' },
          '5:4': { '1K': '1120x896', '2K': '2240x1792', '4K': '3200x2560' },
          '4:5': { '1K': '896x1120', '2K': '1792x2240', '4K': '2560x3200' },
          '21:9': { '1K': '1456x624', '2K': '2912x1248', '4K': '3840x1648' },
          '9:21': { '1K': '624x1456', '2K': '1248x2912', '4K': '1648x3840' },
          '2:1': { '1K': '1536x768', '2K': '3072x1536', '4K': '3840x1920' },
          '1:2': { '1K': '768x1536', '2K': '1536x3072', '4K': '1920x3840' },
          '3:1': { '1K': '2048x688', '2K': '2048x688', '4K': '3840x1280' },
          '1:3': { '1K': '688x2048', '2K': '688x2048', '4K': '1280x3840' }
        };

        let resolvedRatio = aspect_ratio;
        let resolvedSize = resolution;

        if (aspect_ratio && aspect_ratio.includes('x')) {
          resolvedSize = aspect_ratio;
          const mapped = REVERSE_VIP_RESOLUTION_MAP[aspect_ratio];
          if (mapped) {
            resolvedRatio = mapped.ratio;
          }
        } else if (aspect_ratio && (aspect_ratio.includes(':') || aspect_ratio === 'auto')) {
          const lookupRatio = aspect_ratio === 'auto' ? '1:1' : aspect_ratio;
          const targetRes = resolution || '1K';
          const pixelDim = FORWARD_VIP_RESOLUTION_MAP[lookupRatio]?.[targetRes];
          if (pixelDim) {
            resolvedSize = pixelDim;
            resolvedRatio = lookupRatio;
          }
        }

        let resolvedModel = model || '';
        let wasRoutedFor4K = false;
        
        // Automatic routing for 4K resolutions on models that only support 1K/2K
        if (resolution === '4K') {
          if (resolvedModel.includes('banana') || resolvedModel === 'gpt-image-2') {
            resolvedModel = 'gpt-image-2-vip';
            wasRoutedFor4K = true;
            logToFile(`Routing model [${model}] with resolution 4K to [gpt-image-2-vip] to guarantee true 4K ultra-high-definition output dimensions.`);
          }
        } else if (files.length > 0 && resolvedModel === 'gpt-image-2') {
          resolvedModel = 'gpt-image-2-vip';
          logToFile(`Routing model [gpt-image-2] with image uploads to [gpt-image-2-vip] to ensure stable Image-to-Image merging and resolve high-latency upstream issues.`);
        }

        const isBananaModel = resolvedModel?.includes('banana');

        // For VIP and Banana models, force aspect_ratio to be the resolved pixel dimension string (e.g. '1024x1024')
        // since these models do not support ratio strings directly.
        let finalAspectRatioField = resolvedRatio;
        if (!isBananaModel && (resolvedModel === 'gpt-image-2-vip' || resolvedModel?.includes('vip'))) {
          finalAspectRatioField = resolvedSize || aspect_ratio;
          logToFile(`Forcing aspect_ratio field to pixel dimensions: ${finalAspectRatioField}`);
        }

        let width = 1024;
        let height = 1024;
        if (resolvedSize && resolvedSize.includes('x')) {
          const parts = resolvedSize.split('x');
          if (parts.length === 2) {
            width = parseInt(parts[0]) || 1024;
            height = parseInt(parts[1]) || 1024;
          }
        }

        // ALWAYS send as clean JSON with Base64 arrays since Grsai API expects JSON format
        const apiPayload: any = {
          model: resolvedModel,
          prompt: prompt || '',
          
          // Ratio formats OR Forced Pixel sizes depending on model VIP requirements
          aspect_ratio: isBananaModel ? (aspect_ratio || '1:1') : (finalAspectRatioField || ''),
          aspectRatio: isBananaModel ? (aspect_ratio || '1:1') : (finalAspectRatioField || ''),
          
          // Image Dimension formats (e.g. '2880x2880', '1K')
          resolution: resolvedSize || resolution || '1K',
          imageSize: resolvedSize || resolution || '1K',
          image_size: resolvedSize || resolution || '1K',
          size: resolvedSize || resolution || '1K',
          
          // Explicit width and height constraints
          width: width,
          height: height,
          width_height: isBananaModel ? (resolution || '1K') : (resolvedSize || ''),
          
          // Raw originals for strict compliance checking
          raw_aspect_ratio: aspect_ratio || '',
          rawAspectRatio: aspect_ratio || '',
          raw_resolution: resolution || '',
          rawResolution: resolution || '',
          
          // Status types
          replyType: 'json',
          reply_type: 'json'
        };

        if (files.length > 0) {
          logToFile(`Encoding ${files.length} uploads to Base64 image strings...`);
          const base64Images = files.map((file: any) => {
            const b64 = file.buffer.toString('base64');
            return `data:${file.mimetype || 'image/jpeg'};base64,${b64}`;
          });
          
          // Align dynamic keyword namespaces
          apiPayload.images = base64Images;
          apiPayload.imageUrls = base64Images;
          apiPayload.image_urls = base64Images;
          apiPayload.base64s = base64Images;
          if (base64Images.length > 0) {
            apiPayload.image = base64Images[0];
            apiPayload.image_url = base64Images[0];
          }
          logToFile(`Total base64 characters generated: ${base64Images.reduce((acc: number, str: string) => acc + str.length, 0)}`);
        } else {
          apiPayload.images = [];
          apiPayload.imageUrls = [];
          apiPayload.image_urls = [];
          apiPayload.base64s = [];
        }

        logToFile(`Proxying via application/json payload...`);

        response = await axios.post(targetUrl, apiPayload, {
          headers: { 
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Banana/1.0',
            ...(apiKey ? { 'Authorization': apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}` } : {})
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          validateStatus: () => true,
          httpAgent,
          httpsAgent,
          timeout: 1800000, // 30 minutes timeout
        });
      } catch (postError: any) {
        logToFile(`Axios connection/post error: ${postError.message}`);
        if (postError.response) {
          logToFile(`Axios response status: ${postError.response.status}`);
          logToFile(`Axios response body snippet: ${JSON.stringify(postError.response.data || '').slice(0, 500)}`);
        }

        let errorMsg = "Internal proxy exception";
        if (postError.code === 'ECONNABORTED' || postError.message.includes('timeout')) {
          errorMsg = "Remote generation timed out or connection was aborted.";
        }
        
        return res.status(500).json({
          error: errorMsg,
          details: postError.message,
          code: postError.code
        });
      }

      logToFile(`Remote returned HTTP status: ${response.status}`);
      const bodySnippet = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      logToFile(`Remote body snippet (first 600 chars): ${bodySnippet.slice(0, 600)}`);

      const contentType = String(response.headers['content-type'] || '');

      // Check if it's returning HTML error page
      if (contentType.includes('text/html') || bodySnippet.trim().startsWith('<!')) {
        logToFile(`Remote returned HTML content (likely an error or cloudflare challenge).`);
        return res.status(502).json({ 
          error: "Remote server returned HTML instead of JSON. This usually indicates an overloaded server, block, or wrong endpoint.",
          status: response.status,
          peek: bodySnippet.slice(0, 200)
        });
      }

      // Check for remote server HTTP error codes
      if (response.status >= 400) {
        let errorData = response.data;
        if (typeof errorData === 'string') {
          try {
            errorData = JSON.parse(errorData);
          } catch (e) {
            errorData = { details: errorData };
          }
        }
        
        const realError = errorData?.error || errorData?.details || errorData?.msg || errorData?.message || `Remote API error [${response.status}]`;
        return res.status(response.status).json({
          error: realError,
          details: realError,
          ...errorData
        });
      }

      // Successful response transmission
      return res.status(200).json(typeof response.data === 'string' ? JSON.parse(response.data) : response.data);
    } catch (error: any) {
      logToFile(`Crash in proxy endpoint: ${error.message}`);
      
      let statusCode = 500;
      let errorMsg = "Internal proxy exception";
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        statusCode = 504;
        errorMsg = "Remote generation timed out or connection was aborted.";
      }

      return res.status(statusCode).json({
        error: errorMsg,
        details: error.message,
        code: error.code
      });
    }
  });

  // Get log endpoint
  app.get("/api/server-logs", (req, res) => {
    try {
      const logPath = path.join(process.cwd(), "server.log");
      if (fs.existsSync(logPath)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.sendFile(logPath);
      }
      return res.status(200).send("No server logs files found yet.");
    } catch (e: any) {
      return res.status(500).send(`Error reading logs: ${e.message}`);
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Explicitly handle 404 for API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "API Route not found" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Set generous timeout boundaries to accommodate long image generation without dropping connections
  server.timeout = 1800000; // 30 minutes
  server.keepAliveTimeout = 600000; // 10 minutes
  server.headersTimeout = 610000; // 10 minutes + 10s margin as recommended by Node.js docs
}

startServer();

