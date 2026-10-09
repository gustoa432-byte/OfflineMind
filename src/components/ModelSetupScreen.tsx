import React, { useState, useEffect } from 'react';
import { 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  HardDrive, 
  Cpu, 
  ShieldCheck, 
  RefreshCw, 
  Trash2, 
  Play, 
  Pause, 
  Sparkles,
  Zap,
  Layers,
  ArrowRight
} from 'lucide-react';
import { AVAILABLE_MODELS, ModelManager } from '../services/modelManager';
import { ModelInfo, ModelInstallProgress } from '../types';

interface ModelSetupScreenProps {
  onInstallationComplete?: () => void;
}

export const ModelSetupScreen: React.FC<ModelSetupScreenProps> = ({ onInstallationComplete }) => {
  const modelManager = ModelManager.getInstance();
  const [activeModel, setActiveModel] = useState<ModelInfo>(modelManager.getActiveModel());
  const [progress, setProgress] = useState<ModelInstallProgress>(modelManager.getProgress());
  const [isLoadedInRam, setIsLoadedInRam] = useState<boolean>(modelManager.isLoadedInRam());

  useEffect(() => {
    const unsubscribe = modelManager.subscribe((p) => {
      setProgress(p);
      setIsLoadedInRam(modelManager.isLoadedInRam());
    });
    return unsubscribe;
  }, []);

  const handleSelectModel = (model: ModelInfo) => {
    modelManager.setActiveModel(model);
    setActiveModel(model);
  };

  const handleStartDownload = () => {
    modelManager.startInstallation();
  };

  const handlePause = () => {
    modelManager.pauseOrCancelDownload();
  };

  const handleUninstall = () => {
    if (window.confirm(`Вы уверены, что хотите удалить модель ${activeModel.name} из локального хранилища?`)) {
      modelManager.uninstallModel();
    }
  };

  const handleToggleRam = () => {
    if (isLoadedInRam) {
      modelManager.unloadFromRam();
    } else {
      modelManager.loadIntoRam();
    }
    setIsLoadedInRam(modelManager.isLoadedInRam());
  };

  const isInstalling = progress.status !== 'ready' && progress.status !== 'not_installed' && progress.status !== 'paused' && progress.status !== 'error';

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 flex-1 flex flex-col justify-start">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Cpu className="w-6 h-6 text-cyan-400" />
          <span>Управление локальной моделью LLM</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Инференс на базе <span className="text-slate-200">llama.cpp ARM64</span>. Все вычисления выполняются прямо на процессоре MediaTek Helio G81 Ultra без интернета.
        </p>
      </div>

      {/* Target Device RAM & Storage Status Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Физическая RAM</span>
            <span className="font-mono text-cyan-400">6.0 ГБ</span>
          </div>
          <div className="text-base font-bold text-slate-100">
            {isLoadedInRam ? `${(activeModel.expectedRamMb / 1024).toFixed(2)} ГБ занято` : '0 ГБ (Выгружена)'}
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {isLoadedInRam ? 'Модель в ОЗУ для быстрого ответа' : 'ОЗУ свободно для системы'}
          </span>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Хранилище HONOR</span>
            <span className="font-mono text-cyan-400">256 ГБ</span>
          </div>
          <div className="text-base font-bold text-slate-100">
            182.4 ГБ свободно
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            Достаточно места для нескольких моделей
          </span>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Состояние движка</span>
            <span className={progress.status === 'ready' ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
              {progress.status === 'ready' ? 'Готов к работе' : 'Требуется установка'}
            </span>
          </div>
          <div className="text-base font-bold text-slate-100">
            {activeModel.format}
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            llama.cpp NDK (ARM64 v8a)
          </span>
        </div>
      </div>

      {/* Model Selection Tabs */}
      <div className="mb-6">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Выбор квантованной модели (GGUF):
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {AVAILABLE_MODELS.map(model => {
            const isSelected = activeModel.id === model.id;
            return (
              <div
                key={model.id}
                onClick={() => !isInstalling && handleSelectModel(model)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-slate-850 border-cyan-500 shadow-md ring-1 ring-cyan-500/30'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                } ${isInstalling ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-sm font-bold text-slate-100 block">
                      {model.name}
                    </span>
                    <span className="text-[11px] text-cyan-400 font-medium">
                      {model.tag}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                    {model.sizeFormatted}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  {model.notes}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                  <span>Контекст: {model.contextLength} токенов</span>
                  <span>RAM: ~{model.expectedRamMb} МБ</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 10-Step Installation & Progress Controller */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl mb-6">
        <div className="flex items-start justify-between pb-4 border-b border-slate-800 mb-4">
          <div>
            <span className="text-xs text-cyan-400 font-medium block">
              Автоматическая процедура верификации (10 шагов по ТЗ)
            </span>
            <h3 className="text-base font-bold text-slate-100">
              {activeModel.name} ({activeModel.sizeFormatted})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {progress.status === 'ready' && (
              <>
                <button
                  onClick={handleToggleRam}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                    isLoadedInRam
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                  }`}
                  title={isLoadedInRam ? 'Освободить память устройства' : 'Загрузить в оперативную память'}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{isLoadedInRam ? 'Выгрузить из ОЗУ' : 'Загрузить в ОЗУ'}</span>
                </button>
                <button
                  onClick={handleUninstall}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-slate-800 transition-colors"
                  title="Удалить файл модели"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar & Status Text */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium truncate max-w-[320px]">
              {progress.currentStepDescription}
            </span>
            <span className="font-mono text-cyan-400 font-bold">
              {progress.percentage}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-200 ${
                progress.status === 'ready'
                  ? 'bg-emerald-500'
                  : progress.status === 'error'
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          {/* Download Speed and ETA */}
          {progress.status === 'downloading' && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Скорость: {(progress.speedBytesPerSec / 1024 / 1024).toFixed(1)} МБ/с</span>
              <span>Осталось: ~{progress.timeRemainingSec} сек</span>
            </div>
          )}

          {/* SHA-256 Checksum Display */}
          <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-800/80">
            <span className="truncate max-w-[260px]">
              SHA-256: {activeModel.sha256}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Целостность</span>
            </span>
          </div>

          {/* Smoke test output */}
          {progress.testQueryOutput && (
            <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Контрольный проверочный запрос пройден:</span>
                <span className="text-slate-300">{progress.testQueryOutput}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            {progress.status === 'not_installed' && (
              <button
                onClick={handleStartDownload}
                className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Начать установку модели ({activeModel.sizeFormatted})</span>
              </button>
            )}

            {progress.status === 'downloading' && (
              <button
                onClick={handlePause}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 border border-slate-700 transition-colors"
              >
                <Pause className="w-4 h-4" />
                <span>Приостановить загрузку</span>
              </button>
            )}

            {progress.status === 'paused' && (
              <button
                onClick={handleStartDownload}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>Возобновить установку</span>
              </button>
            )}

            {progress.status === 'ready' && (
              <div className="w-full text-center text-xs text-emerald-400 flex items-center justify-center gap-1.5 py-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Модель установлена в локальное хранилище приложения</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
