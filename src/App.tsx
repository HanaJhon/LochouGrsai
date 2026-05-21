import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Download, 
  Loader2, 
  X, 
  Layers,
  Maximize2,
  Trash2,
  Sparkles,
  Settings2,
  Cpu,
  History,
  Activity,
  Key,
  Globe,
  Settings,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Types
interface GenerationParams {
  prompt: string;
  model: string;
  size: string;
  aspect_ratio: string;
  resolution: string;
  images: File[];
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

interface Task {
  id: string;
  prompt: string;
  model: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  resultUrl?: string;
  error?: string;
  timestamp: number;
  duration?: string;
  params: GenerationParams;
}

interface GenerationResult {
  id: string;
  url: string;
  params: GenerationParams;
  timestamp: number;
}

const MODELS = [
  { id: 'nano-banana-2', name: 'Banana 2', description: '旗舰模型，平衡质量与速度' },
  { id: 'nano-banana-pro', name: 'Banana Pro', description: '旗舰Pro，最高质量保证' },
  { id: 'nano-banana-2-cl', name: 'Banana 2 CL', description: '专注创意与逻辑' },
  { id: 'nano-banana-pro-cl', name: 'Banana Pro CL', description: 'Pro级别的创意逻辑' },
  { id: 'nano-banana-fast', name: 'Banana Fast', description: '极致响应速度' },
  { id: 'nano-banana', name: 'Banana Standard', description: '基础通用模型' },
  { id: 'nano-banana-pro-vip', name: 'Banana Pro VIP', description: 'VIP专属高质量渲染' },
];

const GPT_IMAGE_2_MODELS = [
  { id: 'gpt-image-2', name: 'GPT Image 2', description: '基础模型，支持常用比例' },
  { id: 'gpt-image-2-vip', name: 'GPT Image 2 VIP', description: '专业模型，支持1-4K超高清' },
];

const GPT_NODES = [
  { name: '全球节点', url: 'https://grsaiapi.com' },
  { name: '国内节点', url: 'https://grsai.dakka.com.cn' },
];

const RATIOS = [
  { label: 'Auto', value: 'auto', icon: 'w-4 h-4 border-2 border-dashed' },
  { label: '1:1', value: '1:1', icon: 'w-4 h-4 border-2' },
  { label: '16:9', value: '16:9', icon: 'w-6 h-3 border-2' },
  { label: '9:16', value: '9:16', icon: 'w-3 h-6 border-2' },
  { label: '4:3', value: '4:3', icon: 'w-5 h-4 border-2' },
  { label: '3:4', value: '3:4', icon: 'w-4 h-5 border-2' },
  { label: '3:2', value: '3:2', icon: 'w-5.5 h-4 border-2' },
  { label: '2:3', value: '2:3', icon: 'w-4 h-5.5 border-2' },
  { label: '5:4', value: '5:4', icon: 'w-4.5 h-4 border-2' },
  { label: '4:5', value: '4:5', icon: 'w-4 h-4.5 border-2' },
  { label: '21:9', value: '21:9', icon: 'w-7 h-3 border-2' },
  { label: '9:21', value: '9:21', icon: 'w-3 h-7 border-2' },
  { label: '2:1', value: '2:1', icon: 'w-8 h-4 border-2' },
  { label: '1:2', value: '1:2', icon: 'w-4 h-8 border-2' },
  { label: '3:1', value: '3:1', icon: 'w-8 h-2.5 border-2' },
  { label: '1:3', value: '1:3', icon: 'w-2.5 h-8 border-2' },
];

const EXTRA_RATIOS = [
  { label: '1:4', value: '1:4', icon: 'w-2 h-8 border-2' },
  { label: '4:1', value: '4:1', icon: 'w-8 h-2 border-2' },
  { label: '1:8', value: '1:8', icon: 'w-1 h-8 border-2' },
  { label: '8:1', value: '8:1', icon: 'w-8 h-1 border-2' },
];

// Mapping for VIP model resolutions
const VIP_RESOLUTION_MAP: Record<string, Record<string, string>> = {
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
  '1:3': { '1K': '688x2048', '2K': '688x2048', '4K': '1280x3840' },
};

const RESOLUTIONS = ['1K', '2K', '4K'];

export default function App() {
  const [activeTab, setActiveTab] = useState<'banana' | 'gpt-image-2'>('banana');
  const [params, setParams] = useState<GenerationParams>({
    prompt: '',
    model: MODELS[0].id,
    size: '1024',
    aspect_ratio: '1:1',
    resolution: '1K',
    images: [],
  });

  const [gptNode, setGptNode] = useState(GPT_NODES[0].url);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // When switching tabs or models, reset invalid settings
    if (activeTab === 'banana') {
      if (!MODELS.some(m => m.id === params.model)) {
        setParams(prev => ({ ...prev, model: MODELS[0].id }));
      }
    } else {
      if (!GPT_IMAGE_2_MODELS.some(m => m.id === params.model)) {
        setParams(prev => ({ ...prev, model: GPT_IMAGE_2_MODELS[0].id }));
      }
      
      // If gpt-image-2 is selected, resolution MUST be 1K
      if (params.model === 'gpt-image-2' && params.resolution !== '1K') {
        setParams(prev => ({ ...prev, resolution: '1K' }));
      }
    }
  }, [activeTab, params.model]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // User Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [userApiKey, setUserApiKey] = useState(() => {
    try {
      return localStorage.getItem('lochou_api_key') || '';
    } catch (e) {
      return '';
    }
  });
  const [userApiUrl, setUserApiUrl] = useState(() => {
    try {
      return localStorage.getItem('lochou_api_url') || '';
    } catch (e) {
      return '';
    }
  });

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };
    setLogs(prev => [...prev.slice(-49), newLog]); // Keep last 50
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('lochou_api_key', userApiKey);
      localStorage.setItem('lochou_api_url', userApiUrl);
      addLog('System settings updated and saved to local storage.', 'success');
    } catch (e) {
      addLog('Failed to save settings to local storage.', 'error');
    }
    setShowSettings(false);
  };

  const compressImage = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.85): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                  const compressedFile = new File([blob], `${nameWithoutExt}_optimized.jpg`, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  resolve(compressedFile);
                } else {
                  resolve(file);
                }
              },
              'image/jpeg',
              quality
            );
          } else {
            resolve(file);
          }
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async (files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const totalPossible = 9 - params.images.length;
    const filesToAdd = newFiles.slice(0, totalPossible);

    if (newFiles.length > totalPossible) {
      addLog('Reference images limited to 9. Some files were skipped.', 'warn');
    }

    if (filesToAdd.length > 0) {
      addLog(`Optimizing ${filesToAdd.length} reference image(s)...`, 'info');
      try {
        const compressedFiles = await Promise.all(
          filesToAdd.map(file => compressImage(file))
        );

        setParams(prev => ({ ...prev, images: [...prev.images, ...compressedFiles] }));
        
        compressedFiles.forEach(file => {
          const reader = new FileReader();
          reader.onloadend = () => {
            setPreviewImages(prev => [...prev, reader.result as string]);
          };
          reader.readAsDataURL(file);
        });
        
        addLog(`Added and optimized ${compressedFiles.length} image(s).`, 'info');
      } catch (err: any) {
        console.error('Compression failed:', err);
        setParams(prev => ({ ...prev, images: [...prev.images, ...filesToAdd] }));
        filesToAdd.forEach(file => {
          const reader = new FileReader();
          reader.onloadend = () => {
            setPreviewImages(prev => [...prev, reader.result as string]);
          };
          reader.readAsDataURL(file);
        });
        addLog(`Added ${filesToAdd.length} image(s) without optimization.`, 'info');
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (index: number) => {
    setParams(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
    addLog('Reference image removed.', 'info');
  };

  const clearImages = () => {
    setParams(prev => ({ ...prev, images: [] }));
    setPreviewImages([]);
    addLog('All reference images cleared.', 'warn');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!params.prompt.trim()) return;

    if (!userApiKey) {
      addLog('警告: 未检测到用户配置的 API Key，将尝试使用系统默认配置。', 'warn');
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTask: Task = {
      id: taskId,
      prompt: params.prompt,
      model: params.model,
      status: 'processing',
      progress: 0,
      timestamp: Date.now(),
      params: { ...params },
    };

    setTasks(prev => [newTask, ...prev]);
    addLog(`Initiating generation task [${taskId.slice(-4)}] for model: ${params.model}...`, 'info');
    
    // Independent task execution
    executeTask(newTask);
  };

  const executeTask = async (task: Task) => {
    const startTime = Date.now();
    const updateTask = (updates: Partial<Task>) => {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
    };

    // Simulate progress while waiting
    const progressInterval = setInterval(() => {
      setTasks(prev => prev.map(t => {
        if (t.id === task.id && t.status === 'processing' && t.progress < 90) {
          return { ...t, progress: t.progress + Math.floor(Math.random() * 10) };
        }
        return t;
      }));
    }, 1500);

    try {
      const formData = new FormData();
      formData.append('prompt', task.params.prompt);
      formData.append('model', task.params.model);
      
      let apiAspectRatio = task.params.aspect_ratio;
      if (activeTab === 'gpt-image-2') {
        if (task.params.model === 'gpt-image-2-vip') {
          let lookupKey = task.params.aspect_ratio === 'auto' ? '1:1' : task.params.aspect_ratio;
          apiAspectRatio = VIP_RESOLUTION_MAP[lookupKey]?.[task.params.resolution] || '1024x1024';
        } else {
          apiAspectRatio = task.params.aspect_ratio;
        }
      }
      
      formData.append('aspect_ratio', apiAspectRatio);
      formData.append('resolution', task.params.resolution);
      
      if (userApiKey) formData.append('custom_api_key', userApiKey);
      
      const finalApiUrl = userApiUrl || (activeTab === 'gpt-image-2' ? gptNode : 'https://grsaiapi.com');
      if (finalApiUrl) {
        let cleanedUrl = finalApiUrl.replace(/\/$/, '');
        if (!cleanedUrl.includes('/v1/api/')) {
          cleanedUrl += '/v1/api/generate';
        }
        formData.append('custom_api_url', cleanedUrl);
      }

      if (task.params.images && task.params.images.length > 0) {
        task.params.images.forEach(file => {
          formData.append('images', file);
        });
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      clearInterval(progressInterval);

      const contentType = response.headers.get("content-type");
      let responseData: any;
      const text = await response.text();

      if (contentType && contentType.includes("application/json")) {
        try {
          responseData = JSON.parse(text.trim());
        } catch (e) {
          throw new Error(`Server returned invalid JSON structure [${response.status}]. Code: ${text.slice(0, 150)}`);
        }
      } else {
        throw new Error(`Server returned non-JSON [${response.status}]. Type: ${contentType}. Code: ${text.slice(0, 150)}`);
      }

      // Check for errors embedded in streamed JSON response even if status was ok
      if (responseData && (responseData.error || responseData.details)) {
        throw new Error(responseData.error || responseData.details);
      }

      if (!response.ok) {
        throw new Error(responseData.error || responseData.details || `HTTP ${response.status}`);
      }

      let imageUrl = '';
      if (responseData.results && responseData.results.length > 0) {
        imageUrl = responseData.results[0].url;
      } else if (responseData.url) {
        imageUrl = responseData.url;
      } else {
        imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(task.prompt)}?seed=${Math.floor(Math.random() * 100000)}&width=1024&height=1024`;
      }

      const newResult: GenerationResult = {
        id: task.id, // Use the task ID to maintain link
        url: imageUrl,
        params: { ...task.params },
        timestamp: Date.now(),
      };

      updateTask({ 
        status: 'completed', 
        progress: 100, 
        resultUrl: imageUrl, 
        duration: `${duration}s` 
      });
      
      setResults(prev => [newResult, ...prev]);
      setActiveResultId(newResult.id);
      addLog(`Task [${task.id.slice(-4)}] succeeded in ${duration}s`, 'success');
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error(error);
      updateTask({ status: 'failed', error: error.message, progress: 0 });
      addLog(`Task [${task.id.slice(-4)}] failed: ${error.message}`, 'error');
    }
  };

  const isGenerating = tasks.some(t => t.status === 'processing');
  const activeTaskCount = tasks.filter(t => t.status === 'processing').length;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      {/* Slim Sidebar Rail */}
      <aside className="w-20 sm:w-24 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-8 gap-10 sticky top-0 h-screen z-40 shrink-0">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-600/20">L</div>
        
        <nav className="flex flex-col gap-6 w-full px-2">
          <button 
            onClick={() => setActiveTab('banana')}
            className={cn(
              "flex flex-col items-center gap-1 group transition-all",
              activeTab === 'banana' ? "opacity-100" : "opacity-60 hover:opacity-80"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
              activeTab === 'banana' ? "bg-indigo-600/10 border border-indigo-500/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]" : "bg-slate-800 text-slate-400 group-hover:bg-slate-700"
            )}>
              <Sparkles className="w-6 h-6" />
            </div>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-tighter",
              activeTab === 'banana' ? "text-white" : "text-slate-500"
            )}>Banana</span>
          </button>

          <button 
            onClick={() => setActiveTab('gpt-image-2')}
            className={cn(
              "flex flex-col items-center gap-1 group transition-all",
              activeTab === 'gpt-image-2' ? "opacity-100" : "opacity-60 hover:opacity-80"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
              activeTab === 'gpt-image-2' ? "bg-indigo-600/10 border border-indigo-500/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]" : "bg-slate-800 text-slate-400 group-hover:bg-slate-700"
            )}>
              <ImageIcon className="w-6 h-6" />
            </div>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-tighter text-center",
              activeTab === 'gpt-image-2' ? "text-white" : "text-slate-500"
            )}>Gpt image 2</span>
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors relative"
          >
            <Key className="w-5 h-5" />
            {(!userApiKey) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900" />
            )}
          </button>
        </div>
      </aside>

      <div className="flex-1 p-4 md:p-6 overflow-x-hidden">
        <div className="max-w-[1500px] mx-auto space-y-6">
          
          {/* Header Block */}
          <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 px-6 mb-2">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white leading-tight uppercase font-mono">
                  {activeTab === 'banana' ? 'Banana' : 'Gpt image 2'}
                </h1>
                <p className="text-[10px] text-indigo-400 font-mono tracking-[0.2em] uppercase">
                  Lochou AI Studio
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-center">
              <a 
                href="https://ais-pre-nw5nsyo65ebfasxbyuy5qa-264122046589.us-west1.run.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[11px] italic font-signature text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-200 hover:from-indigo-300 hover:to-white transition-all mr-1 drop-shadow-sm"
              >
                官方版Banana
              </a>
              <div className="hidden sm:flex items-center gap-2 bg-slate-950/50 border border-slate-800 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono">API Connection Stable</span>
              </div>
            </div>
          </header>

        {/* Main Bento Grid */}
        <div className="grid grid-cols-12 gap-4">
          
          {/* Controls Column (Span 3) */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            {/* Model Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
              <h2 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Layers className="w-3 h-3" /> 模型选择
              </h2>
              <div className="space-y-2">
                {(activeTab === 'banana' ? MODELS : GPT_IMAGE_2_MODELS).map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setParams(prev => ({ ...prev, model: model.id }))}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all relative overflow-hidden group",
                      params.model === model.id 
                        ? "bg-indigo-600/10 border-indigo-500/50 text-white" 
                        : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600"
                    )}
                  >
                    <div className="text-xs font-bold mb-0.5">{model.name}</div>
                    <div className="text-[9px] opacity-60 leading-tight">{model.description}</div>
                    {params.model === model.id && (
                      <div className="absolute top-0 right-0 p-1">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Node Selection (Only for GPT Image 2) */}
            {activeTab === 'gpt-image-2' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
                <h2 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Globe className="w-3 h-3" /> 节点选择
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {GPT_NODES.map((node) => (
                    <button
                      key={node.url}
                      onClick={() => setGptNode(node.url)}
                      className={cn(
                        "text-[10px] py-2 rounded-lg border transition-all",
                        gptNode === node.url 
                          ? "bg-indigo-600/10 border-indigo-500/50 text-white" 
                          : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600"
                      )}
                    >
                      {node.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Maximize2 className="w-3 h-3" /> 分辨率等级
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {RESOLUTIONS.map(res => {
                  const isGptNonVip = (activeTab === 'gpt-image-2' && params.model === 'gpt-image-2');
                  const isDisabled = isGptNonVip && res !== '1K';
                  const labelSuffix = (isGptNonVip && res !== '1K') ? "(仅VIP支持)" : "";
                  
                  return (
                    <button
                      key={res}
                      disabled={isDisabled}
                      onClick={() => setParams(prev => ({ ...prev, resolution: res }))}
                      className={cn(
                        "text-xs py-2.5 px-3 rounded-xl border text-center transition-all",
                        params.resolution === res
                          ? "bg-slate-200 text-slate-950 border-slate-200 font-bold"
                          : isDisabled
                            ? "bg-slate-900 border-slate-800 text-slate-700 opacity-40 cursor-not-allowed"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                      )}
                    >
                      {res} {labelSuffix}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Concurrent Tasks Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 max-h-[400px]">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Activity className="w-3 h-3" /> 并发任务队列
                </h2>
                {tasks.length > 0 && (
                  <button 
                    onClick={() => setTasks([])}
                    className="text-[9px] text-slate-500 hover:text-red-400 uppercase font-bold"
                  >
                    清空
                  </button>
                )}
              </div>
              <div className="space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                {tasks.length === 0 ? (
                  <div className="text-center py-6 text-slate-600 italic text-[10px] uppercase tracking-wider">
                    暂无活动任务
                  </div>
                ) : (
                  tasks.map(task => (
                    <div key={task.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-slate-300 font-bold truncate">{task.prompt}</p>
                          <p className="text-[8px] text-slate-500 font-mono uppercase mt-0.5">{task.model} | {task.id.slice(-4)}</p>
                        </div>
                        <div className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                          task.status === 'processing' ? "bg-indigo-500/20 text-indigo-400 animate-pulse" :
                          task.status === 'completed' ? "bg-emerald-500/20 text-emerald-400" :
                          task.status === 'failed' ? "bg-red-500/20 text-red-400" : "bg-slate-800 text-slate-400"
                        )}>
                          {task.status}
                        </div>
                      </div>
                      
                      {task.status === 'processing' && (
                        <div className="space-y-1">
                          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-indigo-500" 
                              initial={{ width: 0 }}
                              animate={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[8px] font-mono text-slate-500">
                            <span>PROGRESS</span>
                            <span>{task.progress}%</span>
                          </div>
                        </div>
                      )}

                      {task.status === 'completed' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              const result = results.find(r => r.url === task.resultUrl || r.id === task.id);
                              if (result) {
                                setActiveResultId(result.id);
                              } else if (task.resultUrl) {
                                setActiveResultId(task.id);
                              }
                            }}
                            className="flex-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 py-1 rounded text-[9px] font-bold uppercase transition-all"
                          >
                            预览
                          </button>
                          {task.resultUrl && (
                            <>
                              <button 
                                onClick={() => window.open(task.resultUrl, '_blank')}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                                title="Open Original"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                              <a 
                                href={task.resultUrl}
                                download={`generation-${task.id.slice(-4)}.png`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                                title="Download"
                              >
                                <Download className="w-3 h-3" />
                              </a>
                            </>
                          )}
                          <span className="text-[8px] text-slate-600 font-mono flex items-center ml-auto">{task.duration}</span>
                        </div>
                      )}

                      {task.status === 'failed' && (
                        <p className="text-[8px] text-red-500/80 italic line-clamp-1">{task.error}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action History / Secondary Info */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Settings2 className="w-3 h-3" /> 系统参数
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">Reply Type</span>
                  <span className="text-indigo-400">JSON</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">Image Size</span>
                  <span className="text-indigo-400">{params.resolution}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">Engine</span>
                  <span className="text-indigo-400">Banana-v2</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column: Prompt & Preview (Span 6) */}
          <div className="col-span-12 lg:col-span-6 space-y-4">
            {/* Prompt & Reference Image Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col gap-3">
              <div className="flex flex-col gap-3">
                {/* Advanced Multi-Image Upload Area */}
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "min-h-[140px] border-2 border-dashed rounded-xl transition-all p-3 flex flex-col gap-3 group relative",
                    isDragging ? "border-indigo-400 bg-indigo-500/10" : "border-slate-800 bg-slate-950",
                    params.images.length === 0 ? "items-center justify-center cursor-pointer hover:border-slate-600" : ""
                  )}
                  onClick={() => params.images.length === 0 && fileInputRef.current?.click()}
                >
                  {params.images.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2 w-full">
                      {previewImages.map((src, idx) => (
                        <div key={idx} className="aspect-square relative group/img rounded-lg overflow-hidden border border-slate-800">
                          <img src={src} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                            className="absolute top-1 right-1 p-1 bg-red-500 rounded-md text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {params.images.length < 9 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                          className="aspect-square border-2 border-dashed border-slate-800 rounded-lg flex items-center justify-center text-slate-500 hover:border-indigo-500 hover:text-indigo-400 transition-all bg-slate-900/50"
                        >
                          <Upload className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 pointer-events-none">
                      <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800">
                        <Upload className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">拖拽图片或点击上传</p>
                        <p className="text-[10px] text-slate-600 font-mono mt-0.5 uppercase tracking-widest">Supports up to 9 reference images</p>
                      </div>
                    </div>
                  )}
                  
                  {params.images.length > 0 && (
                    <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-800/50">
                      <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-widest">
                        Images: {params.images.length} / 9
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); clearImages(); }}
                        className="text-[9px] text-red-500/60 hover:text-red-500 font-bold uppercase tracking-widest"
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                  
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" multiple />
                </div>

                <div className="flex-1 relative">
                  <textarea
                    value={params.prompt}
                    onChange={(e) => setParams(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="在此输入您的创意描述..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-sm outline-none text-white placeholder:text-slate-600 focus:border-indigo-500 transition-all resize-none h-[110px]"
                  />
                </div>
              </div>
              
              <div className="flex flex-row gap-2 justify-end items-center px-1">
                <div className="mr-auto hidden sm:flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                  PROMPT READY
                </div>
                <button 
                  onClick={handleGenerate}
                  disabled={!params.prompt.trim() || activeTaskCount >= 5}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-indigo-200" />}
                  {activeTaskCount >= 5 ? "队列已满" : (isGenerating ? "继续添加" : "开始生成")}
                </button>
              </div>
            </div>

            {/* Main Preview Result */}
            <div className="aspect-square md:aspect-video bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden relative group">
              <div className="absolute inset-0 flex items-center justify-center">
                {(() => {
                  const activeResult = results.find(r => r.id === activeResultId) || results[0];
                  if (activeResult) {
                    return <img src={activeResult.url} alt="Generated" className="w-full h-full object-contain" />;
                  }
                  return (
                    <div className="text-center px-6">
                      <div className="w-20 h-20 border-4 border-slate-800 border-t-indigo-500 rounded-full mx-auto mb-6 animate-spin" style={{ animationDuration: isGenerating ? '1s' : '0s', opacity: isGenerating ? 1 : 0.2 }}></div>
                      <p className="text-slate-600 text-sm italic font-mono uppercase tracking-widest">{isGenerating ? '正在请求算力资源...' : '等待任务输入...'}</p>
                    </div>
                  );
                })()}
              </div>
              
              {/* Scanning Animation */}
              <AnimatePresence>
                {isGenerating && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-indigo-500/5 backdrop-blur-[2px]" />
                    <motion.div 
                      initial={{ top: '-10%' }}
                      animate={{ top: '110%' }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_15px_rgba(129,140,248,0.8)]"
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(99,102,241,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />
                  </motion.div>
                )}
              </AnimatePresence>
              
              {(() => {
                const activeResult = results.find(r => r.id === activeResultId) || results[0];
                if (activeResult) {
                  return (
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 to-transparent">
                      <div className="flex justify-between items-end">
                        <div>
                          <span className="px-2 py-1 bg-indigo-500 text-[10px] font-bold rounded text-white mb-2 inline-block">READY TO RENDER</span>
                          <p className="text-slate-400 text-[10px] font-mono tracking-widest uppercase">LATENCY: ACTIVE • ID: {activeResult.id.slice(0, 8)}</p>
                        </div>
                        <button 
                          onClick={() => window.open(activeResult.url, '_blank')}
                          className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-all"
                        >
                          <Download className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Console Log Panel */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden font-mono flex flex-col h-[180px]">
              <div className="bg-slate-900 px-4 py-2 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-indigo-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Logs</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-800" />
                  <div className="w-2 h-2 rounded-full bg-slate-800" />
                  <div className="w-2 h-2 rounded-full bg-slate-800" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                {logs.length === 0 ? (
                  <div className="text-[10px] text-slate-700 italic">Terminal initialized. Ready for commands...</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="text-[10px] flex gap-3 text-slate-500 leading-relaxed">
                      <span className="text-slate-700 shrink-0">[{log.timestamp}]</span>
                      <span className={cn(
                        "font-bold uppercase shrink-0 w-12",
                        log.type === 'error' ? "text-red-500" :
                        log.type === 'success' ? "text-emerald-500" :
                        log.type === 'warn' ? "text-amber-500" : "text-indigo-400"
                      )}>
                        {log.type}
                      </span>
                      <span className={cn(
                        "break-all",
                        log.type === 'error' ? "text-red-400/80" :
                        log.type === 'success' ? "text-emerald-400/80" :
                        log.type === 'warn' ? "text-amber-400/80" : "text-slate-400"
                      )}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>

          {/* Right Column: Extras (Span 3) */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            {/* Aspect Ratio Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-full">
              <h2 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> 画面比例
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {RATIOS.concat(activeTab === 'banana' && params.model.includes('banana-2') ? EXTRA_RATIOS : []).map(ratio => (
                  <button
                    key={ratio.value}
                    onClick={() => setParams(prev => ({ ...prev, aspect_ratio: ratio.value }))}
                    className={cn(
                      "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all border",
                      params.aspect_ratio === ratio.value
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-200"
                        : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600"
                    )}
                  >
                    <div className={cn(ratio.icon, params.aspect_ratio === ratio.value ? "border-indigo-400" : "border-slate-700")} />
                    <span className="text-[9px] font-bold">{ratio.label}</span>
                    {activeTab === 'gpt-image-2' && params.model === 'gpt-image-2-vip' && (
                      <span className="text-[7px] text-slate-600 font-mono">
                        {VIP_RESOLUTION_MAP[ratio.value]?.[params.resolution] || '1024x1024'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Width Asset History */}
          <div className="col-span-12 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-3">
                <History className="w-4 h-4" /> 最近生成的资产
              </h2>
              <span className="text-[10px] text-slate-600 font-mono italic">SESSION PERSISTENCE ACTIVE</span>
            </div>
            
            {results.length <= 1 ? (
              <div className="py-12 text-center text-slate-700 bg-slate-950/30 rounded-3xl border border-slate-800/50 border-dashed">
                <p className="text-xs font-mono uppercase tracking-[0.2em]">待生成的历史记录...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                <AnimatePresence>
                  {results.slice(1).map((result) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => setActiveResultId(result.id)}
                      className={cn(
                        "aspect-square bg-slate-950 rounded-xl border overflow-hidden relative group cursor-pointer transition-all",
                        activeResultId === result.id ? "border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]" : "border-slate-800"
                      )}
                    >
                      <img src={result.url} alt="History" className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:opacity-40" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                        <button 
                          onClick={() => window.open(result.url, '_blank')}
                          className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center"
                        >
                          <Download className="w-3.5 h-3.5 text-white" />
                        </button>
                        <button 
                          onClick={() => setResults(prev => prev.filter(r => r.id !== result.id))}
                          className="w-8 h-8 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center border border-red-500/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="text-[8px] text-slate-300 font-mono mt-1 opacity-60">{result.params.aspect_ratio}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Footer Status Bar */}
        <footer className="mt-8 flex flex-col sm:flex-row justify-between items-center px-4 gap-4 pb-4">
          <div className="flex gap-6 text-[10px] text-slate-500 font-mono tracking-wider">
            <div className="flex items-center gap-2"><Activity className="w-3 h-3 text-indigo-500" /> <span className="opacity-60">LATENCY:</span> 142ms</div>
            <div className="flex items-center gap-2"><Cpu className="w-3 h-3 text-indigo-500" /> <span className="opacity-60">ENDPOINT:</span> GRSAIAPI/V1</div>
            <div className="flex items-center gap-1.5 bg-indigo-500/10 px-2 py-0.5 rounded text-indigo-400 border border-indigo-500/20"><span className="uppercase">Timeout:</span> DISABLED</div>
          </div>
          <div className="text-[9px] text-slate-700 uppercase tracking-[0.4em] font-bold">
            Lumina Cloud Rendering Engine v2.4.0
          </div>
        </footer>
      </div>
    </div>

    {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white uppercase tracking-tight">API 端点配置</h3>
                      <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase">System Configuration</p>
                    </div>
                  </div>
                  <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Key className="w-3 h-3" /> API Key
                    </label>
                    <input 
                      type="password"
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-indigo-100 placeholder:text-slate-700 font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Globe className="w-3 h-3" /> API Endpoint
                    </label>
                    <input 
                      type="text"
                      value={userApiUrl}
                      onChange={(e) => setUserApiUrl(e.target.value)}
                      placeholder="https://grsaiapi.com/v1/api/generate"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-indigo-100 placeholder:text-slate-700 font-mono"
                    />
                    <p className="text-[9px] text-slate-600 font-mono italic">留空则使用系统默认节点</p>
                  </div>
                </div>

                <button 
                  onClick={saveSettings}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-900/20 transition-all uppercase tracking-widest text-sm"
                >
                  保存配置并返回
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
