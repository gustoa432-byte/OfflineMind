import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Send, 
  Square, 
  Bookmark, 
  BookmarkCheck, 
  Copy, 
  Check, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  ArrowRight,
  Database,
  History as HistoryIcon,
  Activity,
  Layers,
  Info
} from 'lucide-react';
import { KnowledgeEntry, InferenceMetrics, QueryHistoryItem } from '../types';
import { LocalInferenceEngine, GenerationChunk } from '../services/inferenceEngine';
import { searchKnowledgeBase } from '../services/knowledgeEngine';
import { ModelManager } from '../services/modelManager';

interface SearchScreenProps {
  onOpenModelSetup: () => void;
  onOpenCatalog: () => void;
  initialQuery?: string;
}

const QUICK_SUGGESTIONS = [
  'Чем площадь отличается от периметра?',
  'Сколько метров в дециметре?',
  'Что такое сотка и сколько в ней квадратных метров?',
  'Чем акр отличается от гектара?',
  'Как называется число, которое делят?'
];

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onOpenModelSetup,
  onOpenCatalog,
  initialQuery = ''
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [matchedEntry, setMatchedEntry] = useState<KnowledgeEntry | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<InferenceMetrics | null>(null);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItems, setHistoryItems] = useState<QueryHistoryItem[]>([]);
  
  // Real-time suggestions as user types (< 5ms)
  const [instantMatches, setInstantMatches] = useState<KnowledgeEntry[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const answerBottomRef = useRef<HTMLDivElement>(null);
  const modelManager = ModelManager.getInstance();
  const inferenceEngine = LocalInferenceEngine.getInstance();

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('offline_knowledge_history');
      if (saved) {
        setHistoryItems(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      handleAskQuestion(initialQuery);
    }
  }, [initialQuery]);

  // Live search in verified knowledge base on typing
  useEffect(() => {
    if (query.trim().length >= 2) {
      const results = searchKnowledgeBase(query.trim());
      setInstantMatches(results.slice(0, 3).map(r => r.entry));
    } else {
      setInstantMatches([]);
    }
  }, [query]);

  const saveHistoryItem = (item: QueryHistoryItem) => {
    const updated = [item, ...historyItems.filter(h => h.id !== item.id)].slice(0, 50);
    setHistoryItems(updated);
    localStorage.setItem('offline_knowledge_history', JSON.stringify(updated));
  };

  const handleAskQuestion = async (userQuestion: string) => {
    const q = userQuestion.trim();
    if (!q || isGenerating) return;

    // Reset state
    setCurrentAnswer('');
    setMatchedEntry(null);
    setMetrics(null);
    setFollowUps([]);
    setIsGenerating(true);
    setIsFavorite(false);
    setInstantMatches([]);

    try {
      const result = await inferenceEngine.generateAnswer(q, (chunk: GenerationChunk) => {
        setCurrentAnswer(chunk.fullText);
        setMetrics(chunk.metrics);
        if (chunk.isComplete) {
          setIsGenerating(false);
        }
      });

      setMatchedEntry(result.matchedEntry || null);
      setIsVerified(result.isVerifiedKnowledge);
      setFollowUps(result.followUpQuestions);

      // Save to query history
      const historyRecord: QueryHistoryItem = {
        id: 'query_' + Date.now(),
        timestamp: Date.now(),
        query: q,
        matchedEntryId: result.matchedEntry?.id,
        matchedEntryTitle: result.matchedEntry?.canonicalTitle,
        isVerifiedKnowledge: result.isVerifiedKnowledge,
        answerText: result.answerText,
        metrics: result.metrics,
        isFavorite: false,
        followUpQuestions: result.followUpQuestions
      };
      saveHistoryItem(historyRecord);

    } catch (err) {
      console.error(err);
      setCurrentAnswer('Ошибка выполнения запроса. Пожалуйста, проверьте состояние модели в настройках.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    inferenceEngine.stopGeneration();
    setIsGenerating(false);
  };

  const handleCopy = () => {
    if (!currentAnswer) return;
    navigator.clipboard.writeText(currentAnswer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    if (historyItems.length > 0) {
      const updated = [...historyItems];
      updated[0].isFavorite = !isFavorite;
      setHistoryItems(updated);
      localStorage.setItem('offline_knowledge_history', JSON.stringify(updated));
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 flex-1 flex flex-col justify-start">
      {/* Top Welcome / Info Kicker */}
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-300">Офлайн-справочник</span>
          <span aria-hidden="true">·</span>
          <span>База знаний SQLite</span>
          <span aria-hidden="true">·</span>
          <span>Qwen2.5 GGUF</span>
        </div>
        <button
          onClick={() => setShowHistoryModal(true)}
          className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <HistoryIcon className="w-3.5 h-3.5" />
          <span>История ({historyItems.length})</span>
        </button>
      </div>

      {/* Main Search Input Form */}
      <div className="relative mb-4">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleAskQuestion(query);
          }}
          className="relative flex items-center"
        >
          <div className="absolute left-4 text-slate-500 pointer-events-none">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Что хочешь вспомнить? (например: сотка, делимое, акр...)"
            disabled={isGenerating}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl pl-12 pr-28 py-3.5 text-sm sm:text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 shadow-lg transition-all"
          />
          <div className="absolute right-2 flex items-center gap-1.5">
            {isGenerating ? (
              <button
                type="button"
                onClick={handleStop}
                className="px-3 py-2 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-medium flex items-center gap-1.5 border border-rose-500/30 transition-colors"
                title="Остановить генерацию"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Стоп</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!query.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-md shadow-cyan-950/50 transition-all active:scale-95"
              >
                <span>Найти</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>

        {/* Live Instant Matches Dropdown (<10ms fast preview without LLM) */}
        {instantMatches.length > 0 && !isGenerating && !currentAnswer && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-xl z-30">
            <div className="text-[11px] text-slate-400 px-3 py-1 font-medium flex items-center gap-1">
              <Database className="w-3 h-3 text-cyan-400" />
              <span>Найдено в локальной базе знаний:</span>
            </div>
            {instantMatches.map(match => (
              <button
                key={match.id}
                onClick={() => {
                  setQuery(match.canonicalTitle);
                  handleAskQuestion(match.canonicalTitle);
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-between group"
              >
                <div>
                  <span className="text-sm font-medium text-slate-200 group-hover:text-cyan-400">
                    {match.canonicalTitle}
                  </span>
                  <p className="text-xs text-slate-400 line-clamp-1">
                    {match.simpleExplanation}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Suggestion Chips (as requested in Section 1 of ТЗ) */}
      {!currentAnswer && !isGenerating && (
        <div className="mb-6">
          <div className="text-xs text-slate-400 mb-2 font-medium">
            Популярные вопросы из справочника:
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(suggestion);
                  handleAskQuestion(suggestion);
                }}
                className="text-left text-xs bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-xl px-3 py-2 transition-colors flex items-center gap-1.5"
              >
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Answer Area */}
      {currentAnswer && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl mb-6 relative">
          {/* Header of Answer */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Проверено базой знаний</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Непроверенный термин (генерация LLM)</span>
                  </span>
                )}
                {matchedEntry && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs text-slate-400">{matchedEntry.categoryNameRu}</span>
                  </>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                {matchedEntry ? matchedEntry.canonicalTitle : query}
              </h2>
            </div>

            {/* Actions: Favorite, Copy */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleFavorite}
                className={`p-2 rounded-lg border transition-colors ${
                  isFavorite
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
                title={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
              >
                {isFavorite ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-400 hover:text-slate-200 transition-colors"
                title="Скопировать ответ"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Formatted Answer Content */}
          <div className="py-4 text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-line space-y-3 font-normal">
            {currentAnswer}
          </div>

          {/* Dedicated "Do Not Confuse With" Callout Card (if matched in DB) */}
          {matchedEntry?.doNotConfuseWith && (
            <div className="mt-2 mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm text-amber-200">
              <div className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>НЕ ПУТАТЬ С: {matchedEntry.doNotConfuseWith.term}</span>
              </div>
              <p className="text-amber-100/90 leading-normal">
                {matchedEntry.doNotConfuseWith.difference}
              </p>
            </div>
          )}

          {/* Source Citation */}
          {matchedEntry?.source && (
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Источник: {matchedEntry.source}</span>
              <span>Верификация: {matchedEntry.verificationDate}</span>
            </div>
          )}

          {/* Real-Time Generation Metrics Bar (WPM, TTFT, TPS, RAM) */}
          {metrics && (
            <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Скорость речи</span>
                <span className="text-slate-200 font-mono font-medium text-xs">
                  {metrics.wordsPerMinute} сл/мин
                </span>
                <span className="text-[10px] text-slate-400 ml-1">(цель ~60)</span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Отклик (TTFT)</span>
                <span className="text-slate-200 font-mono font-medium text-xs">
                  {metrics.ttftMs} мс
                </span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Генерация</span>
                <span className="text-slate-200 font-mono font-medium text-xs">
                  {metrics.tokensPerSec} токенов/с
                </span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Память RSS</span>
                <span className="text-cyan-400 font-mono font-medium text-xs">
                  {metrics.memoryRssMb} МБ / 6 ГБ
                </span>
              </div>
            </div>
          )}

          <div ref={answerBottomRef} />
        </div>
      )}

      {/* Follow-up Questions / Clarifications */}
      {followUps.length > 0 && !isGenerating && (
        <div className="mb-6">
          <div className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Уточнить или узнать больше:</span>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            {followUps.map((fu, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(fu);
                  handleAskQuestion(fu);
                }}
                className="text-left text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-cyan-300 rounded-xl px-3 py-2 transition-colors flex items-center gap-1.5"
              >
                <span>{fu}</span>
                <ArrowRight className="w-3 h-3 text-slate-500 shrink-0 ml-auto sm:ml-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-100">История запросов</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded"
              >
                Закрыть
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {historyItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  История пуста. Задайте вопрос в поиске.
                </div>
              ) : (
                historyItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setQuery(item.query);
                      setCurrentAnswer(item.answerText);
                      setMetrics(item.metrics);
                      setIsVerified(item.isVerifiedKnowledge);
                      setFollowUps(item.followUpQuestions || []);
                      setShowHistoryModal(false);
                    }}
                    className="w-full text-left p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-400">
                        {item.query}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        {item.isVerifiedKnowledge ? 'Проверенная база' : 'Локальная LLM'}
                      </div>
                    </div>
                    {item.isFavorite && (
                      <BookmarkCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
            {historyItems.length > 0 && (
              <div className="p-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    setHistoryItems([]);
                    localStorage.removeItem('offline_knowledge_history');
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Очистить историю
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
