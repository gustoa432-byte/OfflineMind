import React, { useState } from 'react';
import { 
  FileCode, 
  Download, 
  Copy, 
  Check, 
  FolderTree, 
  Terminal, 
  Smartphone,
  ExternalLink,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import JSZip from 'jszip';
import { ANDROID_PROJECT_FILES, AndroidFile } from '../data/androidProjectFiles';

export const AndroidSourceViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<AndroidFile>(ANDROID_PROJECT_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Add all project files to zip
      for (const file of ANDROID_PROJECT_FILES) {
        zip.file(file.path, file.content);
      }

      // Add root README.md
      zip.file('README.md', `# Offline Knowledge — Android Studio Project
Целевое устройство: HONOR NIC-LX1 (Helio G81 Ultra, Android 15, 6GB RAM)
Архитектура: Kotlin + Jetpack Compose + llama.cpp ARM64 + SQLite/Room

Сборка:
1. Откройте этот каталог в Android Studio.
2. Клонируйте llama.cpp в app/src/main/cpp/llama.cpp
3. Запустите: ./gradlew assembleDebug
4. Установите: adb install app/build/outputs/apk/debug/app-debug.apk
`);

      // Add settings.gradle.kts
      zip.file('settings.gradle.kts', `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "OfflineKnowledge"
include(":app")
`);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'offline-knowledge-android-project.zip';
      a.click();
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex-1 flex flex-col justify-start">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <FileCode className="w-6 h-6 text-cyan-400" />
            <span>Исходный код Android-приложения (Kotlin + NDK)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Готовый проект для сборки в Android Studio: Jetpack Compose, Room (SQLite), llama.cpp JNI и возобновляемый загрузчик.
          </p>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={isZipping}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-cyan-950/50 shrink-0 active:scale-95"
        >
          {downloadSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Архив скачан!</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>{isZipping ? 'Упаковка в ZIP...' : 'Скачать весь проект (.zip)'}</span>
            </>
          )}
        </button>
      </div>

      {/* Target Spec Summary Strip */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span>Целевое устройство: <strong>HONOR NIC-LX1</strong> (MediaTek Helio G81 Ultra, ARM64-v8a)</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span>API 35 (Android 15)</span>
          <span className="text-slate-600">·</span>
          <span>NDK r26+</span>
          <span className="text-slate-600">·</span>
          <span>CMake 3.22</span>
          <span className="text-slate-600">·</span>
          <span>Compose BOM</span>
        </div>
      </div>

      {/* File Explorer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
        {/* File List Column */}
        <div className="md:col-span-4 space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-cyan-400" />
            <span>Структура файлов проекта:</span>
          </div>

          {ANDROID_PROJECT_FILES.map(file => (
            <button
              key={file.path}
              onClick={() => setSelectedFile(file)}
              className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-0.5 group ${
                selectedFile.path === file.path
                  ? 'bg-slate-850 border-cyan-500/60 shadow-md ring-1 ring-cyan-500/30'
                  : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-slate-200 group-hover:text-cyan-400 truncate max-w-[200px]">
                  {file.path.split('/').pop()}
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  {file.language}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono truncate">
                {file.path}
              </span>
              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                {file.description}
              </p>
            </button>
          ))}
        </div>

        {/* Code Content Column */}
        <div className="md:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col max-h-[640px]">
          {/* File Tab Header */}
          <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-400 font-semibold">
                {selectedFile.path}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                {selectedFile.description}
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5 text-xs"
              title="Скопировать содержимое"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Копировать'}</span>
            </button>
          </div>

          {/* Syntax Highlighted Code Viewer */}
          <div className="flex-1 overflow-auto p-4 bg-slate-950/80 font-mono text-xs text-slate-300 leading-relaxed select-text whitespace-pre">
            {selectedFile.content}
          </div>
        </div>
      </div>
    </div>
  );
};
