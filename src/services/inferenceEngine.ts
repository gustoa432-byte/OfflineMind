import { KnowledgeEntry, InferenceMetrics } from '../types';
import { ModelManager } from './modelManager';
import { searchKnowledgeBase } from './knowledgeEngine';

export interface GenerationChunk {
  fullText: string;
  deltaText: string;
  isComplete: boolean;
  metrics: InferenceMetrics;
}

export class LocalInferenceEngine {
  private static instance: LocalInferenceEngine;
  private isGenerating = false;
  private shouldAbort = false;
  private abortController: AbortController | null = null;

  private constructor() {}

  public static getInstance(): LocalInferenceEngine {
    if (!LocalInferenceEngine.instance) {
      LocalInferenceEngine.instance = new LocalInferenceEngine();
    }
    return LocalInferenceEngine.instance;
  }

  public isBusy(): boolean {
    return this.isGenerating;
  }

  public stopGeneration(): void {
    if (this.isGenerating) {
      this.shouldAbort = true;
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }

      const native = (window as any).OfflineMindNative;
      if (native && typeof native.stopGeneration === 'function') {
        native.stopGeneration();
      }

      fetch('/api/inference/stop', { method: 'POST' }).catch(() => {});
    }
  }

  /**
   * Executes real on-device neural network inference via llama.cpp.
   * Step 1: Query verified local database for reference definitions/formulas.
   * Step 2: Construct prompt with knowledge context (if present).
   * Step 3: Stream real tokens from compiled llama engine, measuring actual TTFT and tokens/sec.
   */
  public async generateAnswer(
    query: string,
    onChunk: (chunk: GenerationChunk) => void
  ): Promise<{
    answerText: string;
    matchedEntry?: KnowledgeEntry;
    isVerifiedKnowledge: boolean;
    metrics: InferenceMetrics;
    followUpQuestions: string[];
  }> {
    const modelManager = ModelManager.getInstance();
    const activeModel = modelManager.getActiveModel();

    if (!modelManager.isReady()) {
      throw new Error(`Модель ${activeModel.name} не установлена на диске. Перейдите во вкладку «Модель» и выполните загрузку.`);
    }

    if (!modelManager.isLoadedInRam()) {
      await modelManager.loadIntoRam();
    }

    this.isGenerating = true;
    this.shouldAbort = false;
    this.abortController = new AbortController();

    // Step 1: Query verified local knowledge base (< 10ms)
    const searchMatches = searchKnowledgeBase(query);
    const matchedEntry = searchMatches.length > 0 ? searchMatches[0].entry : undefined;
    const isVerifiedKnowledge = !!matchedEntry;

    // Follow up questions based on context
    const followUpQuestions: string[] = [];
    if (matchedEntry) {
      followUpQuestions.push(
        `Как на практике применить: ${matchedEntry.canonicalTitle}?`,
        `В каких единицах чаще всего выражается ${matchedEntry.canonicalTitle}?`,
        `С какими формулами связано это понятие?`
      );
    } else {
      followUpQuestions.push(
        'Дай более подробный пример.',
        'В чем физический смысл этого понятия?',
        'Какова история открытия этого явления?'
      );
    }

    // Step 2: Construct prompt per ТЗ (Strict adherence to facts & refusal on not found)
    if (!matchedEntry) {
      const refusalText = 'В локальном справочнике этого понятия пока нет.\nПопробуйте сформулировать иначе или скачать обновление справочника, когда оно появится.';
      const dummyMetrics: InferenceMetrics = {
        ttftMs: 5,
        totalTimeMs: 15,
        tokensGenerated: 0,
        tokensPerSec: 0,
        wordsPerMinute: 0,
        memoryRssMb: 0,
        peakMemoryMb: 0
      };
      onChunk({
        fullText: refusalText,
        deltaText: refusalText,
        isComplete: true,
        metrics: dummyMetrics
      });
      return {
        answerText: refusalText,
        matchedEntry: undefined,
        isVerifiedKnowledge: false,
        metrics: dummyMetrics,
        followUpQuestions: [
          'Как скачать обновление справочника?',
          'Какие понятия уже есть в справочнике?'
        ]
      };
    }

    const factsContext = [
      `ПОНЯТИЕ: ${matchedEntry.canonicalTitle}`,
      `ОПРЕДЕЛЕНИЕ: ${matchedEntry.definition}`,
      `ПРОСТОЕ ОБЪЯСНЕНИЕ: ${matchedEntry.simpleExplanation}`,
      matchedEntry.formulas?.length ? `ФОРМУЛЫ: ${matchedEntry.formulas.join('; ')}` : '',
      matchedEntry.doNotConfuseWith ? `НЕ ПУТАТЬ С: ${matchedEntry.doNotConfuseWith.term} (${matchedEntry.doNotConfuseWith.difference})` : '',
      matchedEntry.examples?.length ? `ПРИМЕР: ${matchedEntry.examples[0]}` : ''
    ].filter(Boolean).join('\n');

    const prompt = `<|im_start|>system
Ты — OfflineMind, офлайн-справочник по математике на устройстве пользователя.
Отвечай ТОЛЬКО на русском языке.
Используй ТОЛЬКО приведённые ниже факты. Ничего не выдумывай и не добавляй от себя.
Если фактов недостаточно для полного ответа — скажи об этом прямо.

Структура ответа:
1) Простыми словами
2) Правило или формула (если есть)
3) Короткий пример (если уместно)

ФАКТЫ:
${factsContext}<|im_end|>
<|im_start|>user
${query}<|im_end|>
<|im_start|>assistant
`;

    // Step 3: Stream tokens from real llama engine
    const native = (window as any).OfflineMindNative;
    if (native && typeof native.generateStream === 'function') {
      return this.generateViaNativeAndroid(prompt, matchedEntry, isVerifiedKnowledge, followUpQuestions, onChunk);
    } else {
      return this.generateViaBackend(prompt, activeModel.id, matchedEntry, isVerifiedKnowledge, followUpQuestions, onChunk);
    }
  }

  private async generateViaBackend(
    prompt: string,
    modelId: string,
    matchedEntry: KnowledgeEntry | undefined,
    isVerifiedKnowledge: boolean,
    followUpQuestions: string[],
    onChunk: (chunk: GenerationChunk) => void
  ): Promise<{
    answerText: string;
    matchedEntry?: KnowledgeEntry;
    isVerifiedKnowledge: boolean;
    metrics: InferenceMetrics;
    followUpQuestions: string[];
  }> {
    const startTime = performance.now();
    let currentText = '';
    let latestMetrics: InferenceMetrics = {
      ttftMs: 0,
      totalTimeMs: 0,
      tokensGenerated: 0,
      tokensPerSec: 0,
      wordsPerMinute: 0,
      memoryRssMb: 0,
      peakMemoryMb: 0
    };

    try {
      const response = await fetch('/api/inference/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          modelId,
          maxTokens: 160,
          temperature: 0.7
        }),
        signal: this.abortController?.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Поток инференса недоступен');

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        if (this.shouldAbort) {
          currentText += '\n\n[■ Генерация остановлена пользователем]';
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                throw new Error(data.error);
              }

              currentText = data.fullText || (currentText + (data.deltaText || ''));
              latestMetrics = data.metrics || latestMetrics;

              onChunk({
                fullText: currentText,
                deltaText: data.deltaText || '',
                isComplete: !!data.isComplete,
                metrics: latestMetrics
              });
            } catch (e: any) {
              if (e.message?.includes('JSON')) continue;
              throw e;
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        currentText += `\n\n[Ошибка инференса: ${err.message}]`;
      }
    } finally {
      this.isGenerating = false;
      this.abortController = null;
    }

    const totalElapsed = Math.round(performance.now() - startTime);
    if (!latestMetrics.totalTimeMs) {
      latestMetrics.totalTimeMs = totalElapsed;
    }

    onChunk({
      fullText: currentText,
      deltaText: '',
      isComplete: true,
      metrics: latestMetrics
    });

    return {
      answerText: currentText,
      matchedEntry,
      isVerifiedKnowledge,
      metrics: latestMetrics,
      followUpQuestions
    };
  }

  private generateViaNativeAndroid(
    prompt: string,
    matchedEntry: KnowledgeEntry | undefined,
    isVerifiedKnowledge: boolean,
    followUpQuestions: string[],
    onChunk: (chunk: GenerationChunk) => void
  ): Promise<{
    answerText: string;
    matchedEntry?: KnowledgeEntry;
    isVerifiedKnowledge: boolean;
    metrics: InferenceMetrics;
    followUpQuestions: string[];
  }> {
    return new Promise((resolve) => {
      const native = (window as any).OfflineMindNative;
      let currentText = '';
      let latestMetrics: InferenceMetrics = {
        ttftMs: 0,
        totalTimeMs: 0,
        tokensGenerated: 0,
        tokensPerSec: 0,
        wordsPerMinute: 0,
        memoryRssMb: 0,
        peakMemoryMb: 0
      };

      const chunkListener = (e: any) => {
        const detail = e.detail;
        if (!detail) return;

        currentText = detail.fullText;
        if (detail.metrics) {
          latestMetrics = detail.metrics;
        }

        onChunk({
          fullText: currentText,
          deltaText: detail.deltaText,
          isComplete: detail.isComplete,
          metrics: latestMetrics
        });

        if (detail.isComplete) {
          cleanup();
          this.isGenerating = false;
          resolve({
            answerText: currentText,
            matchedEntry,
            isVerifiedKnowledge,
            metrics: latestMetrics,
            followUpQuestions
          });
        }
      };

      const errorListener = (e: any) => {
        cleanup();
        this.isGenerating = false;
        currentText += `\n\n[Ошибка: ${e.detail?.error || 'Сбой нативного движка'}]`;
        resolve({
          answerText: currentText,
          matchedEntry,
          isVerifiedKnowledge,
          metrics: latestMetrics,
          followUpQuestions
        });
      };

      const cleanup = () => {
        window.removeEventListener('onGenerationChunk', chunkListener);
        window.removeEventListener('onGenerationError', errorListener);
      };

      window.addEventListener('onGenerationChunk', chunkListener);
      window.addEventListener('onGenerationError', errorListener);

      native.generateStream(prompt, 160, 0.7);
    });
  }
}
