import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HonorDeviceFrame } from './components/HonorDeviceFrame';
import { SearchScreen } from './components/SearchScreen';
import { KnowledgeCatalog } from './components/KnowledgeCatalog';
import { ModelSetupScreen } from './components/ModelSetupScreen';
import { BenchmarkScreen } from './components/BenchmarkScreen';
import { AndroidSourceViewer } from './components/AndroidSourceViewer';
import { ModelManager } from './services/modelManager';

export default function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'catalog' | 'model' | 'benchmark' | 'android'>('search');
  const [isDeviceFrame, setIsDeviceFrame] = useState<boolean>(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState<string>('');

  const modelManager = ModelManager.getInstance();
  const [isModelReady, setIsModelReady] = useState(modelManager.isReady());
  const [isModelLoadedInRam, setIsModelLoadedInRam] = useState(modelManager.isLoadedInRam());

  useEffect(() => {
    const unsub = modelManager.subscribe(() => {
      setIsModelReady(modelManager.isReady());
      setIsModelLoadedInRam(modelManager.isLoadedInRam());
    });
    return unsub;
  }, []);

  const handleAskFromCatalog = (query: string) => {
    setSearchInitialQuery(query);
    setActiveTab('search');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top 3-Zone Navigation Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'search') {
            setSearchInitialQuery('');
          }
        }}
        isDeviceFrame={isDeviceFrame}
        onToggleDeviceFrame={() => setIsDeviceFrame(!isDeviceFrame)}
        isModelReady={isModelReady}
        isModelLoadedInRam={isModelLoadedInRam}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 flex flex-col">
        <HonorDeviceFrame isDeviceFrame={isDeviceFrame}>
          {activeTab === 'search' && (
            <SearchScreen
              initialQuery={searchInitialQuery}
              onOpenModelSetup={() => setActiveTab('model')}
              onOpenCatalog={() => setActiveTab('catalog')}
            />
          )}

          {activeTab === 'catalog' && (
            <KnowledgeCatalog onAskQuestion={handleAskFromCatalog} />
          )}

          {activeTab === 'model' && (
            <ModelSetupScreen onInstallationComplete={() => setActiveTab('search')} />
          )}

          {activeTab === 'benchmark' && (
            <BenchmarkScreen />
          )}

          {activeTab === 'android' && (
            <AndroidSourceViewer />
          )}
        </HonorDeviceFrame>
      </main>

      {/* Bottom Quiet Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>Offline Knowledge v1.0.0</span>
            <span aria-hidden="true">·</span>
            <span>HONOR NIC-LX1 (MagicOS 9.0 · MediaTek Helio G81 Ultra)</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>100% автономная работа</span>
            <span aria-hidden="true">·</span>
            <span>Без облачных серверов и API-ключей</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
