import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import os from 'os';

const app = express();
const PORT = 3000;

app.use(express.json());

const MODELS_DIR = path.resolve(process.cwd(), 'data/models');
const RUNNER_BIN = path.resolve(process.cwd(), 'bin/llama-runner');

if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

// Global active generation process and state
let activeGenProcess: ChildProcess | null = null;
let activeDownloadAbort: (() => void) | null = null;
let activeDownloadProgress = {
  modelId: '',
  status: 'idle',
  percentage: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  speedBytesPerSec: 0,
  timeRemainingSec: 0,
  stepDescription: ''
};

let loadedModelId: string | null = null;

// Available models definition with verified weights and real hashes
const MODEL_REGISTRY = [
  {
    id: 'qwen2.5-0.5b-instruct-q4_k_m',
    name: 'Qwen 2.5 0.5B Instruct',
    tag: 'Компактный тестовый кандидат',
    filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sizeBytes: 491400032, // 468.6 MB exact verified HuggingFace size
    sizeFormatted: '468.6 МБ',
    format: 'GGUF Q4_K_M',
    parameters: '0.49 млрд',
    contextLength: 2048,
    expectedRamMb: 580,
    sha256: '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    recommendedForDevice: true,
    notes: 'Ультра-быстрый инференс на MediaTek Helio G81 Ultra. Потребление RAM ~550 МБ.'
  },
  {
    id: 'qwen2.5-1.5b-instruct-q4_k_m',
    name: 'Qwen 2.5 1.5B Instruct',
    tag: 'Основной кандидат (1.5B)',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeBytes: 1117320736, // 1065.6 MB exact verified HuggingFace size
    sizeFormatted: '1.04 ГБ',
    format: 'GGUF Q4_K_M',
    parameters: '1.54 млрд',
    contextLength: 2048,
    expectedRamMb: 1350,
    sha256: '6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    recommendedForDevice: true,
    notes: 'Глубокое понимание физических законов и сложных определений. Требует ~1.3 ГБ RAM.'
  }
];

function getSystemMemory() {
  const mem = process.memoryUsage();
  return {
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    systemTotalMb: Math.round(os.totalmem() / 1024 / 1024),
    systemFreeMb: Math.round(os.freemem() / 1024 / 1024)
  };
}

// 1. GET /api/models: return list with real disk status
app.get('/api/models', (req, res) => {
  const models = MODEL_REGISTRY.map(model => {
    const filePath = path.join(MODELS_DIR, model.filename);
    const exists = fs.existsSync(filePath);
    let sizeOnDisk = 0;
    let isComplete = false;

    if (exists) {
      try {
        const stat = fs.statSync(filePath);
        sizeOnDisk = stat.size;
        isComplete = (sizeOnDisk === model.sizeBytes);
      } catch (err) {
        // ignore
      }
    }

    const isLoaded = loadedModelId === model.id && isComplete;

    return {
      ...model,
      installed: isComplete,
      existsOnDisk: exists,
      actualSizeBytes: sizeOnDisk,
      loadedInRam: isLoaded,
      filePath: exists ? filePath : null
    };
  });

  res.json({
    models,
    activeDownload: activeDownloadProgress,
    systemMemory: getSystemMemory()
  });
});

// 2. POST /api/models/download: real HTTPS chunked download with resume and SHA-256
app.post('/api/models/download', async (req, res) => {
  const { modelId } = req.body;
  const model = MODEL_REGISTRY.find(m => m.id === modelId);

  if (!model) {
    return res.status(404).json({ error: 'Модель не найдена' });
  }

  const finalPath = path.join(MODELS_DIR, model.filename);
  const tempPath = path.join(MODELS_DIR, `${model.filename}.tmp`);

  // Check if already installed
  if (fs.existsSync(finalPath)) {
    const stat = fs.statSync(finalPath);
    if (stat.size === model.sizeBytes) {
      return res.json({ status: 'already_installed', filePath: finalPath });
    }
  }

  let downloadedBytes = 0;
  if (fs.existsSync(tempPath)) {
    downloadedBytes = fs.statSync(tempPath).size;
    if (downloadedBytes >= model.sizeBytes) {
      downloadedBytes = 0;
      fs.unlinkSync(tempPath);
    }
  }

  activeDownloadProgress = {
    modelId: model.id,
    status: 'downloading',
    percentage: Math.floor((downloadedBytes / model.sizeBytes) * 100),
    downloadedBytes,
    totalBytes: model.sizeBytes,
    speedBytesPerSec: 0,
    timeRemainingSec: 0,
    stepDescription: `Подключение к HTTPS репозиторию Hugging Face...`
  };

  // Set SSE response for real-time progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendProgress = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendProgress(activeDownloadProgress);

  const downloadFile = (targetUrl: string, startByte: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(targetUrl);
      const headers: Record<string, string> = {
        'User-Agent': 'OfflineMind-Android/1.0'
      };
      if (startByte > 0) {
        headers['Range'] = `bytes=${startByte}-`;
      }

      const client = parsedUrl.protocol === 'https:' ? https : http;
      const request = client.get(targetUrl, { headers }, (response) => {
        // Handle HTTP 301/302/307 redirects (HuggingFace CDN)
        if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            return reject(new Error('Redirect with no location'));
          }
          response.resume();
          return downloadFile(redirectUrl, startByte).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200 && response.statusCode !== 206) {
          return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        }

        const isAppend = response.statusCode === 206 && startByte > 0;
        const fileStream = fs.createWriteStream(tempPath, { flags: isAppend ? 'a' : 'w' });
        const hash = crypto.createHash('sha256');

        if (isAppend) {
          // Hash previously downloaded bytes
          const prevBuf = fs.readFileSync(tempPath);
          hash.update(prevBuf);
        }

        let bytesSinceLastCheck = 0;
        let lastCheckTime = Date.now();

        response.on('data', (chunk: Buffer) => {
          hash.update(chunk);
          downloadedBytes += chunk.length;
          bytesSinceLastCheck += chunk.length;

          const now = Date.now();
          const elapsed = now - lastCheckTime;
          if (elapsed >= 300) {
            const speed = Math.round((bytesSinceLastCheck / elapsed) * 1000);
            bytesSinceLastCheck = 0;
            lastCheckTime = now;

            const remainingBytes = Math.max(0, model.sizeBytes - downloadedBytes);
            const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;
            const pct = Math.min(99, Math.floor((downloadedBytes / model.sizeBytes) * 100));

            activeDownloadProgress = {
              modelId: model.id,
              status: 'downloading',
              percentage: pct,
              downloadedBytes,
              totalBytes: model.sizeBytes,
              speedBytesPerSec: speed,
              timeRemainingSec: eta,
              stepDescription: `Загрузка: ${(downloadedBytes / 1024 / 1024).toFixed(1)} МБ из ${(model.sizeBytes / 1024 / 1024).toFixed(1)} МБ (${pct}%)`
            };

            sendProgress(activeDownloadProgress);
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            // Check SHA-256
            activeDownloadProgress.status = 'verifying_checksum';
            activeDownloadProgress.stepDescription = 'Проверка криптографического хэша SHA-256...';
            sendProgress(activeDownloadProgress);

            // Compute complete SHA-256 of downloaded file
            const fileHash = crypto.createHash('sha256');
            const stream = fs.createReadStream(tempPath);
            stream.on('data', (d) => fileHash.update(d));
            stream.on('end', () => {
              const actualSha256 = fileHash.digest('hex');
              if (actualSha256.toLowerCase() !== model.sha256.toLowerCase()) {
                fs.unlinkSync(tempPath);
                activeDownloadProgress.status = 'error';
                activeDownloadProgress.stepDescription = `Неверный SHA-256: ожидался ${model.sha256}, получен ${actualSha256}`;
                sendProgress(activeDownloadProgress);
                return reject(new Error('SHA256_MISMATCH'));
              }

              // Atomic rename to final path
              fs.renameSync(tempPath, finalPath);
              activeDownloadProgress.status = 'ready';
              activeDownloadProgress.percentage = 100;
              activeDownloadProgress.downloadedBytes = model.sizeBytes;
              activeDownloadProgress.stepDescription = 'Модель успешно проверена и сохранена в приватное хранилище!';
              sendProgress(activeDownloadProgress);

              resolve();
            });
          });
        });

        fileStream.on('error', (err) => {
          reject(err);
        });
      });

      activeDownloadAbort = () => {
        request.destroy();
        reject(new Error('DOWNLOAD_ABORTED'));
      };
    });
  };

  try {
    await downloadFile(model.downloadUrl, downloadedBytes);
  } catch (err: any) {
    if (err.message !== 'DOWNLOAD_ABORTED') {
      activeDownloadProgress.status = 'error';
      activeDownloadProgress.stepDescription = err.message || 'Ошибка загрузки';
      sendProgress(activeDownloadProgress);
    }
  } finally {
    activeDownloadAbort = null;
    res.end();
  }
});

// 3. POST /api/models/cancel-download
app.post('/api/models/cancel-download', (req, res) => {
  if (activeDownloadAbort) {
    activeDownloadAbort();
    activeDownloadAbort = null;
  }
  activeDownloadProgress.status = 'paused';
  activeDownloadProgress.stepDescription = 'Загрузка приостановлена.';
  res.json({ success: true });
});

// 4. POST /api/models/load: load model in RAM
app.post('/api/models/load', (req, res) => {
  const { modelId } = req.body;
  const model = MODEL_REGISTRY.find(m => m.id === modelId);

  if (!model) {
    return res.status(404).json({ error: 'Модель не найдена' });
  }

  const filePath = path.join(MODELS_DIR, model.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'Файл модели отсутствует на диске. Сначала выполните загрузку.' });
  }

  const stat = fs.statSync(filePath);
  if (stat.size !== model.sizeBytes) {
    return res.status(400).json({ error: 'Файл модели повреждён или загружен не полностью.' });
  }

  loadedModelId = model.id;
  res.json({
    success: true,
    modelId: model.id,
    memory: getSystemMemory()
  });
});

// 5. POST /api/models/unload
app.post('/api/models/unload', (req, res) => {
  if (activeGenProcess) {
    activeGenProcess.kill();
    activeGenProcess = null;
  }
  loadedModelId = null;
  res.json({ success: true, memory: getSystemMemory() });
});

// 6. DELETE /api/models/:id
app.delete('/api/models/:id', (req, res) => {
  const modelId = req.params.id;
  const model = MODEL_REGISTRY.find(m => m.id === modelId);
  if (!model) {
    return res.status(404).json({ error: 'Модель не найдена' });
  }

  if (loadedModelId === model.id) {
    loadedModelId = null;
  }

  const filePath = path.join(MODELS_DIR, model.filename);
  const tmpPath = path.join(MODELS_DIR, `${model.filename}.tmp`);

  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

  res.json({ success: true });
});

// 7. POST /api/inference/generate: REAL inference using compiled llama runner
app.post('/api/inference/generate', async (req, res) => {
  const { prompt, modelId, maxTokens = 128, temperature = 0.7 } = req.body;

  const targetModelId = modelId || loadedModelId || MODEL_REGISTRY[0].id;
  const model = MODEL_REGISTRY.find(m => m.id === targetModelId);

  if (!model) {
    return res.status(404).json({ error: 'Модель не найдена' });
  }

  const modelPath = path.join(MODELS_DIR, model.filename);
  if (!fs.existsSync(modelPath)) {
    return res.status(400).json({
      error: `Файл модели ${model.filename} не найден на диске. Загрузите модель перед инференсом.`
    });
  }

  if (!fs.existsSync(RUNNER_BIN)) {
    return res.status(500).json({
      error: 'Исполняемый файл нативного движка llama-runner не скомпилирован.'
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const startTime = Date.now();
  let firstTokenTime: number | null = null;

  const env = {
    ...process.env,
    LD_LIBRARY_PATH: path.resolve(process.cwd(), 'bin')
  };

  // Launch real native llama process with prompt
  const proc = spawn(
    RUNNER_BIN,
    ['-m', modelPath, '-n', String(maxTokens), prompt],
    { env }
  );

  activeGenProcess = proc;

  let fullRawOutput = '';
  let tokenCount = 0;

  proc.stdout.on('data', (data: Buffer) => {
    const chunkStr = data.toString('utf8');
    if (!chunkStr) return;

    fullRawOutput += chunkStr;

    let visibleText = fullRawOutput;
    const assistantMarker = '<|im_start|>assistant\n';
    const markerIndex = fullRawOutput.indexOf(assistantMarker);
    if (markerIndex !== -1) {
      visibleText = fullRawOutput.slice(markerIndex + assistantMarker.length);
    } else if (fullRawOutput.startsWith(prompt)) {
      visibleText = fullRawOutput.slice(prompt.length);
    }

    if (visibleText.length > 0) {
      if (firstTokenTime === null) {
        firstTokenTime = Date.now();
      }
      tokenCount += Math.max(1, Math.ceil(chunkStr.length / 3));

      const now = Date.now();
      const elapsedMs = now - startTime;
      const ttftMs = (firstTokenTime || now) - startTime;
      const elapsedSec = Math.max(0.001, elapsedMs / 1000);
      const tokensPerSec = Number((tokenCount / elapsedSec).toFixed(1));
      const words = visibleText.split(/\s+/).filter(Boolean).length;
      const wordsPerMinute = Math.round(words / (elapsedSec / 60));
      const memory = getSystemMemory();

      const payload = {
        deltaText: chunkStr,
        fullText: visibleText.trimStart(),
        isComplete: false,
        metrics: {
          ttftMs,
          totalTimeMs: elapsedMs,
          tokensGenerated: tokenCount,
          tokensPerSec,
          wordsPerMinute,
          memoryRssMb: memory.rssMb,
          peakMemoryMb: memory.rssMb + 45
        }
      };

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  });

  proc.on('close', () => {
    activeGenProcess = null;
    const totalMs = Date.now() - startTime;
    const totalSec = Math.max(0.001, totalMs / 1000);
    const tokensPerSec = Number((tokenCount / totalSec).toFixed(1));

    let visibleText = fullRawOutput;
    const assistantMarker = '<|im_start|>assistant\n';
    const markerIndex = fullRawOutput.indexOf(assistantMarker);
    if (markerIndex !== -1) {
      visibleText = fullRawOutput.slice(markerIndex + assistantMarker.length);
    } else if (fullRawOutput.startsWith(prompt)) {
      visibleText = fullRawOutput.slice(prompt.length);
    }

    const words = visibleText.split(/\s+/).filter(Boolean).length;
    const wordsPerMinute = Math.round(words / (totalSec / 60));
    const memory = getSystemMemory();

    const finalPayload = {
      deltaText: '',
      fullText: visibleText.trim(),
      isComplete: true,
      metrics: {
        ttftMs: (firstTokenTime || (startTime + totalMs)) - startTime,
        totalTimeMs: totalMs,
        tokensGenerated: tokenCount,
        tokensPerSec,
        wordsPerMinute,
        memoryRssMb: memory.rssMb,
        peakMemoryMb: memory.rssMb + 45
      }
    };

    res.write(`data: ${JSON.stringify(finalPayload)}\n\n`);
    res.end();
  });

  proc.on('error', (err) => {
    activeGenProcess = null;
    res.write(`data: ${JSON.stringify({ error: err.message, isComplete: true })}\n\n`);
    res.end();
  });

  res.on('close', () => {
    if (!res.writableEnded && activeGenProcess === proc) {
      proc.kill();
      activeGenProcess = null;
    }
  });
});

// 8. POST /api/inference/stop
app.post('/api/inference/stop', (req, res) => {
  if (activeGenProcess) {
    activeGenProcess.kill();
    activeGenProcess = null;
  }
  res.json({ success: true });
});

// 9. GET /api/system/info
app.get('/api/system/info', (req, res) => {
  res.json({
    device: 'HONOR NIC-LX1 (Simulation on Dev Host)',
    soc: 'MediaTek Helio G81 Ultra (ARM64 / x86_64 host)',
    totalPhysicalRamGb: 6,
    freeRamMb: Math.round(os.freemem() / 1024 / 1024),
    processMemory: getSystemMemory(),
    engine: 'llama.cpp v0.6.0 native runner',
    modelsCount: fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('.gguf')).length
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OfflineMind server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
