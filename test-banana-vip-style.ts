import axios from 'axios';

function getImageDimensions(buffer: Buffer) {
  if (buffer.length < 24) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), type: 'png' };
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (offset + 4 > buffer.length) break;
      const marker = buffer.readUInt16BE(offset);
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xFFC0 && marker <= 0xFFC3) {
        if (offset + 9 > buffer.length) break;
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height, type: 'jpeg' };
      }
      offset += 2 + length;
    }
  }
  return null;
}

async function run() {
  const apiKey = process.env.EXTERNAL_API_KEY;

  console.log('Downloading real test images...');
  const img1Res = await axios.get('https://file5.aitohumanize.com/file/4306daa6ea534e0084340c5f8d7931a3.jpeg', { responseType: 'arraybuffer' });
  const img2Res = await axios.get('https://file1.aitohumanize.com/file/fa313506d0a64eafa50a7c068f7ca36f.jpeg', { responseType: 'arraybuffer' });

  const b64_1 = `data:image/jpeg;base64,${Buffer.from(img1Res.data).toString('base64')}`;
  const b64_2 = `data:image/jpeg;base64,${Buffer.from(img2Res.data).toString('base64')}`;

  const payload = {
    model: 'nano-banana-2',
    prompt: '基于图1车牌展示图，将图1的车牌换成图2的样式',
    aspect_ratio: '2880x2880',
    aspectRatio: '2880x2880',
    resolution: '2880x2880',
    imageSize: '2880x2880',
    image_size: '2880x2880',
    size: '2880x2880',
    width: 2880,
    height: 2880,
    width_height: '2880x2880',
    images: [b64_1, b64_2],
    reply_type: 'json'
  };

  try {
    console.log('Sending nano-banana-2 VIP-style 4K request...');
    const res = await axios.post('https://grsaiapi.com/v1/api/generate', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey?.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`
      },
      timeout: 120000 // generous timeout
    });
    console.log('Status:', res.status);
    const url = res.data?.results?.[0]?.url;
    if (url) {
      console.log('URL:', url);
      const imgRes = await axios.get(url, { responseType: 'arraybuffer' });
      const dims = getImageDimensions(Buffer.from(imgRes.data));
      console.log('Result dimensions:', dims);
    } else {
      console.log('Failed:', res.data);
    }
  } catch (err: any) {
    console.error('Error:', err.response ? err.response.status : err.message, err.response ? err.response.data : '');
  }
}

run();
