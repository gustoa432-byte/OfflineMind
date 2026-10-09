import React from 'react';
import { BookOpen, Cpu, Smartphone, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ModelManager } from '../services/modelManager';

interface HeaderProps {
  activeTab: 'search' | 'catalog' | 'model' | 'benchmark' | 'android';
  onSelectTab: (tab: 'search' | 'catalog' | 'model' | 'benchmark' | 'android') => void;
  isDeviceFrame: boolean;
  onToggleDeviceFrame: () => void;
  isModelReady: boolean;
  isModelLoadedInRam: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  isDeviceFrame,
  onToggleDeviceFrame,
  isModelReady,
  isModelLoadedInRam
}) => {
  const modelManager = ModelManager.getInstance();
  const activeModel = modelManager.getActiveModel();

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTab('search')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:border-cyan-500/40 transition-colors">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-100 tracking-tight block">
                Offline Knowledge
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:block">
                Локальный справочник · Android
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Nav Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1">
          <button
            onClick={() => onSelectTab('search')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'search'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Вопрос
          </button>
          <button
            onClick={() => onSelectTab('catalog')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'catalog'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Справочник
          </button>
          <button
            onClick={() => onSelectTab('model')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'model'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Модель
            {isModelReady && isModelLoadedInRam ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            ) : isModelReady ? (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            )}
          </button>
          <button
            onClick={() => onSelectTab('benchmark')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'benchmark'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Тесты 30+
          </button>
          <button
            onClick={() => onSelectTab('android')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'android'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Исходники APK
          </button>
        </nav>

        {/* Zone 3: Actions & Device Mode */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onToggleDeviceFrame}
            title={isDeviceFrame ? 'Развернуть на весь экран' : 'Включить вид HONOR NIC-LX1'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">
              {isDeviceFrame ? 'Вид: Смартфон' : 'Вид: Полный'}
            </span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-xs border border-slate-800 bg-slate-900/60 rounded-lg px-2.5 py-1.5">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 font-mono text-[11px] truncate max-w-[130px]">
              {activeModel.name.split(' ')[0]} {activeModel.parameters}
            </span>
            <span className="text-slate-600">·</span>
            <span className={isModelLoadedInRam ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
              {isModelLoadedInRam ? 'В RAM' : 'Выгружена'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
