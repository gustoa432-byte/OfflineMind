import React, { useState } from 'react';
import { 
  Search, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  HelpCircle,
  Hash,
  Scale,
  Maximize2,
  Clock,
  Sparkles
} from 'lucide-react';
import { VERIFIED_KNOWLEDGE_BASE } from '../data/knowledgeBase';
import { KnowledgeEntry } from '../types';

interface KnowledgeCatalogProps {
  onAskQuestion: (query: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'Все разделы' },
  { id: 'arithmetic', label: 'Арифметика' },
  { id: 'geometry', label: 'Геометрия' },
  { id: 'units_area', label: 'Меры площади' },
  { id: 'units_length', label: 'Длина и расстояния' },
  { id: 'units_mass', label: 'Масса и вес' },
  { id: 'units_volume', label: 'Объем и ёмкость' },
  { id: 'units_time_speed', label: 'Время и скорость' }
];

export const KnowledgeCatalog: React.FC<KnowledgeCatalogProps> = ({ onAskQuestion }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);

  const filteredEntries = VERIFIED_KNOWLEDGE_BASE.filter(entry => {
    const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.canonicalTitle.toLowerCase().includes(q) ||
      entry.definition.toLowerCase().includes(q) ||
      entry.simpleExplanation.toLowerCase().includes(q) ||
      entry.keywords.some(k => k.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 flex-1 flex flex-col justify-start">
      {/* Catalog Intro Kicker */}
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">Локальный справочник (SQLite)</span>
          <span aria-hidden="true">·</span>
          <span>Доступен мгновенно без нейросети</span>
          <span aria-hidden="true">·</span>
          <span>{VERIFIED_KNOWLEDGE_BASE.length} проверенных статей</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Быстрый поиск по терминам (<5 мс)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
          />
        </div>
      </div>

      {/* Category Segmented Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main Grid: Articles List & Detail View */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
        {/* Left Column: List of Entries */}
        <div className="md:col-span-5 space-y-2 max-h-[640px] overflow-y-auto pr-1">
          {filteredEntries.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/60 rounded-xl border border-slate-800">
              Ничего не найдено по запросу «{searchQuery}».
            </div>
          ) : (
            filteredEntries.map(entry => (
              <button
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1 group ${
                  selectedEntry?.id === entry.id
                    ? 'bg-slate-850 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/30'
                    : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">
                    {entry.canonicalTitle}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {entry.categoryNameRu}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {entry.simpleExplanation}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Right Column: Detail Article View */}
        <div className="md:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between max-h-[640px] overflow-y-auto">
          {selectedEntry ? (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Проверенная запись энциклопедии</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">{selectedEntry.categoryNameRu}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-100">
                    {selectedEntry.canonicalTitle}
                  </h2>
                </div>

                <button
                  onClick={() => onAskQuestion(selectedEntry.canonicalTitle)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
                  title="Задать вопрос через нейросеть"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Объяснить LLM</span>
                </button>
              </div>

              {/* Simple explanation */}
              <div>
                <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">
                  Объяснение простыми словами
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  {selectedEntry.simpleExplanation}
                </p>
              </div>

              {/* Strict Definition */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Академическое определение
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {selectedEntry.definition}
                </p>
              </div>

              {/* Examples */}
              {selectedEntry.examples.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Наглядные примеры
                  </h4>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300">
                    {selectedEntry.examples.map((ex, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-cyan-400 mt-1">•</span>
                        <span>{ex}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Do not confuse with */}
              {selectedEntry.doNotConfuseWith && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                  <div className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>НЕ ПУТАТЬ С: {selectedEntry.doNotConfuseWith.term}</span>
                  </div>
                  <p className="text-amber-100/90 leading-normal">
                    {selectedEntry.doNotConfuseWith.difference}
                  </p>
                </div>
              )}

              {/* Formulas */}
              {selectedEntry.formulas && selectedEntry.formulas.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Формулы и соотношения
                  </h4>
                  <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-300">
                    {selectedEntry.formulas.map((f, i) => (
                      <div key={i}>{f}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Source verification footer */}
              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                <span>{selectedEntry.source}</span>
                <span>Проверено {selectedEntry.verificationDate}</span>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <BookOpen className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm font-medium text-slate-400">Выберите термин из списка слева</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Все статьи доступны полностью офлайн, поиск занимает менее 1 секунды без подключения к нейросети.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
