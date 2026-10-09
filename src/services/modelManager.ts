import { ModelInfo, ModelInstallProgress, ModelInstallStatus } from '../types';

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'qwen2.5-0.5b-instruct-q4_k_m',
    name: 'Qwen 2.5 0.5B Instruct',
    tag: 'Компактный тестовый кандидат (Рекомендуется)',
    filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sizeBytes: 491400032, // 468.6 MB verified HuggingFace size
    sizeFormatted: '468.6 МБ',
    format: 'GGUF Q4_K_M',
    parameters: '0.49 млрд',
    contextLength: 2048,
    expectedRamMb: 580,
    sha256: '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    recommendedForDevice: true,
    notes: 'Ультра-быстрый инференс на MediaTek Helio G81 Ultra. Минимальное потребление памяти (~550 МБ RAM). Проверен на устройстве.'
  },
  {
    id: 'qwen2.5-1.5b-instruct-q4_k_m',
    name: 'Qwen 2.5 1.5B Instruct',
    tag: 'Основной кандидат (1.5B)',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeBytes: 1117320736, // 1065.6 MB verified HuggingFace size
    sizeFormatted: '1.04 ГБ',
    format: 'GGUF Q4_K_M',
    parameters: '1.54 млрд',
    contextLength: 2048,
    expectedRamMb: 1350,
    sha256: '6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    recommendedForDevice: true,
    notes: 'Высокая точность математических определений и физических величин. Оптимизирован под 6 ГБ RAM устройства HONOR NIC-LX1.'
  }
];

export class ModelManager {
  private static instance: ModelManager;
  private activeModel: ModelInfo;
  private currentProgress: ModelInstallProgress;
  private progressListeners: ((progress: ModelInstallProgress) => void)[] = [];
  private downloadAbortController: AbortController | null = null;
  private isModelLoadedInRam = false;
  private isCheckingDisk = false;

  private constructor() {
    this.activeModel = AVAILABLE_MODELS[0];
    this.currentProgress = {
      status: 'not_installed',
      percentage: 0,
      downloadedBytes: 0,
      totalBytes: this.activeModel.sizeBytes,
      speedBytesPerSec: 0,
      timeRemainingSec: 0,
      currentStepDescription: 'Проверка наличия файла модели на диске...'
    };

    // Listen to Android WebView events if running inside native app
    if (typeof window !== 'undefined') {
      window.addEventListener('onDownloadStateChanged', (e: any) => {
        const detail = e.detail;
        if (!detail) return;
        this.handleNativeDownloadState(detail);
      });

      window.addEventListener('onModelLoadedChanged', (e: any) => {
        const detail = e.detail;
        if (detail && typeof detail.success === 'boolean') {
          this.isModelLoadedInRam = detail.success;
          this.notifyListeners();
        }
      });
    }

    // Verify real file status on disk on init
    this.verifyModelStatusOnDisk();
  }

  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  public getActiveModel(): ModelInfo {
    return this.activeModel;
  }

  public async setActiveModel(model: ModelInfo): Promise<void> {
    if (this.currentProgress.status === 'downloading') {
      this.pauseOrCancelDownload();
    }
    this.activeModel = model;
    this.currentProgress = {
      status: 'not_installed',
      percentage: 0,
      downloadedBytes: 0,
      totalBytes: model.sizeBytes,
      speedBytesPerSec: 0,
      timeRemainingSec: 0,
      currentStepDescription: 'Проверка статуса модели...'
    };
    this.isModelLoadedInRam = false;
    this.notifyListeners();
    await this.verifyModelStatusOnDisk();
  }

  public getProgress(): ModelInstallProgress {
    return this.currentProgress;
  }

  public isReady(): boolean {
    return this.currentProgress.status === 'ready';
  }

  public isLoadedInRam(): boolean {
    return this.isModelLoadedInRam;
  }

  public async verifyModelStatusOnDisk(): Promise<void> {
    if (this.isCheckingDisk) return;
    this.isCheckingDisk = true;

    try {
      const native = (window as any).OfflineMindNative;
      if (native && typeof native.checkModelStatus === 'function') {
        // Native Android check
        const rawJson = native.checkModelStatus(this.activeModel.filename, this.activeModel.sizeBytes);
        const data = JSON.parse(rawJson);
        if (data.installed) {
          this.isModelLoadedInRam = data.loadedInRam;
          this.updateProgress({
            status: 'ready',
            percentage: 100,
            downloadedBytes: this.activeModel.sizeBytes,
            totalBytes: this.activeModel.sizeBytes,
            currentStepDescription: `Модель ${this.activeModel.name} проверена и готова к работе (хранилище Android).`
          });
        } else {
          this.isModelLoadedInRam = false;
          this.updateProgress({
            status: 'not_installed',
            percentage: 0,
            downloadedBytes: data.fileSizeBytes || 0,
            totalBytes: this.activeModel.sizeBytes,
            currentStepDescription: 'Требуется загрузка модели.'
          });
        }
        return;
      }

      // Check via real server backend
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        const serverModel = data.models?.find((m: any) => m.id === this.activeModel.id);
        if (serverModel && serverModel.installed) {
          this.isModelLoadedInRam = serverModel.loadedInRam;
          this.updateProgress({
            status: 'ready',
            percentage: 100,
            downloadedBytes: this.activeModel.sizeBytes,
            totalBytes: this.activeModel.sizeBytes,
            currentStepDescription: `Модель ${this.activeModel.name} проверена на диске (${(this.activeModel.sizeBytes / 1024 / 1024).toFixed(1)} МБ). Готова к инференсу.`
          });
        } else {
          const downloadedBytes = serverModel?.actualSizeBytes || 0;
          const pct = Math.floor((downloadedBytes / this.activeModel.sizeBytes) * 100);
          this.isModelLoadedInRam = false;
          this.updateProgress({
            status: 'not_installed',
            percentage: pct,
            downloadedBytes,
            totalBytes: this.activeModel.sizeBytes,
            currentStepDescription: downloadedBytes > 0
              ? `Частично загружено: ${(downloadedBytes / 1024 / 1024).toFixed(1)} МБ (${pct}%). Нажмите «Загрузить» для возобновления.`
              : 'Требуется первоначальная загрузка модели.'
          });
        }
      }
    } catch (err) {
      console.warn('Could not verify model status from backend:', err);
    } finally {
      this.isCheckingDisk = false;
    }
  }

  public async loadIntoRam(): Promise<boolean> {
    const native = (window as any).OfflineMindNative;
    if (native && typeof native.loadModel === 'function') {
      const ok = native.loadModel(this.activeModel.filename, this.activeModel.contextLength, 4);
      this.isModelLoadedInRam = ok;
      this.notifyListeners();
      return ok;
    }

    try {
      const res = await fetch('/api/models/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: this.activeModel.id })
      });
      if (res.ok) {
        this.isModelLoadedInRam = true;
        this.notifyListeners();
        return true;
      }
    } catch (e) {
      console.error('Failed to load model into RAM:', e);
    }
    return false;
  }

  public async unloadFromRam(): Promise<void> {
    const native = (window as any).OfflineMindNative;
    if (native && typeof native.unloadModel === 'function') {
      native.unloadModel();
      this.isModelLoadedInRam = false;
      this.notifyListeners();
      return;
    }

    try {
      await fetch('/api/models/unload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: this.activeModel.id })
      });
    } catch (e) {
      // ignore
    }
    this.isModelLoadedInRam = false;
    this.notifyListeners();
  }

  /**
   * Real HTTPS Download with resume and SHA-256 verification
   */
  public async startInstallation(): Promise<void> {
    if (this.currentProgress.status === 'ready') return;

    const native = (window as any).OfflineMindNative;
    if (native && typeof native.startModelDownload === 'function') {
      // Use native Android downloader
      this.updateProgress({
        status: 'checking_space',
        percentage: 1,
        currentStepDescription: 'Проверка дискового пространства в приватном хранилище Android...'
      });
      native.startModelDownload(
        this.activeModel.downloadUrl,
        this.activeModel.filename,
        this.activeModel.sha256,
        this.activeModel.sizeBytes
      );
      return;
    }

    // Full-stack backend download via SSE stream
    this.downloadAbortController = new AbortController();
    this.updateProgress({
      status: 'downloading',
      percentage: 0,
      downloadedBytes: 0,
      totalBytes: this.activeModel.sizeBytes,
      currentStepDescription: `Подключение к репозиторию для ${this.activeModel.filename}...`
    });

    try {
      const response = await fetch('/api/models/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: this.activeModel.id }),
        signal: this.downloadAbortController.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Поток ответа недоступен');

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              this.updateProgress({
                status: data.status as ModelInstallStatus,
                percentage: data.percentage,
                downloadedBytes: data.downloadedBytes,
                totalBytes: data.totalBytes,
                speedBytesPerSec: data.speedBytesPerSec,
                timeRemainingSec: data.timeRemainingSec,
                currentStepDescription: data.stepDescription
              });

              if (data.status === 'ready') {
                await this.loadIntoRam();
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }

      await this.verifyModelStatusOnDisk();

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.updateProgress({
          status: 'error',
          errorMessage: err.message || 'Ошибка загрузки модели'
        });
      }
    }
  }

  public pauseOrCancelDownload(): void {
    const native = (window as any).OfflineMindNative;
    if (native && typeof native.cancelDownload === 'function') {
      native.cancelDownload();
    }

    if (this.downloadAbortController) {
      this.downloadAbortController.abort();
      this.downloadAbortController = null;
    }

    fetch('/api/models/cancel-download', { method: 'POST' }).catch(() => {});

    this.updateProgress({
      status: 'paused',
      currentStepDescription: 'Загрузка приостановлена. Нажмите «Возобновить», чтобы продолжить с сохранённой позиции.'
    });
  }

  public async uninstallModel(): Promise<void> {
    this.pauseOrCancelDownload();
    const native = (window as any).OfflineMindNative;
    if (native && typeof native.deleteModel === 'function') {
      native.deleteModel(this.activeModel.filename);
    } else {
      await fetch(`/api/models/${this.activeModel.id}`, { method: 'DELETE' }).catch(() => {});
    }

    this.isModelLoadedInRam = false;
    this.currentProgress = {
      status: 'not_installed',
      percentage: 0,
      downloadedBytes: 0,
      totalBytes: this.activeModel.sizeBytes,
      speedBytesPerSec: 0,
      timeRemainingSec: 0,
      currentStepDescription: 'Файл модели удалён из хранилища.'
    };
    this.notifyListeners();
  }

  public subscribe(listener: (progress: ModelInstallProgress) => void): () => void {
    this.progressListeners.push(listener);
    listener(this.currentProgress);
    return () => {
      this.progressListeners = this.progressListeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.progressListeners) {
      listener({ ...this.currentProgress });
    }
  }

  private updateProgress(patch: Partial<ModelInstallProgress>): void {
    this.currentProgress = { ...this.currentProgress, ...patch };
    this.notifyListeners();
  }

  private handleNativeDownloadState(detail: any): void {
    switch (detail.type) {
      case 'checking_space':
        this.updateProgress({
          status: 'checking_space',
          currentStepDescription: `Проверка места: свободно ${(detail.freeBytes / 1024 / 1024).toFixed(0)} МБ`
        });
        break;
      case 'progress':
        this.updateProgress({
          status: 'downloading',
          percentage: detail.percent,
          downloadedBytes: detail.downloadedBytes,
          totalBytes: detail.totalBytes,
          speedBytesPerSec: detail.speedBytesPerSec,
          timeRemainingSec: detail.timeRemainingSec,
          currentStepDescription: detail.stepDescription
        });
        break;
      case 'verifying_checksum':
        this.updateProgress({
          status: 'verifying_checksum',
          percentage: 95,
          currentStepDescription: `Проверка контрольной суммы SHA-256 (${detail.expectedSha256.substring(0, 16)}...)...`
        });
        break;
      case 'ready':
        this.updateProgress({
          status: 'ready',
          percentage: 100,
          currentStepDescription: `Модель успешно сохранена в хранилище: ${detail.filePath}`
        });
        this.loadIntoRam();
        break;
      case 'error':
        this.updateProgress({
          status: 'error',
          errorMessage: detail.errorMessage
        });
        break;
    }
  }
}
