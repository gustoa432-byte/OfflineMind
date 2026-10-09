import React from 'react';
import { WifiOff, BatteryCharging, ShieldCheck, Sparkles, Smartphone } from 'lucide-react';

interface HonorDeviceFrameProps {
  children: React.ReactNode;
  isDeviceFrame: boolean;
}

export const HonorDeviceFrame: React.FC<HonorDeviceFrameProps> = ({ children, isDeviceFrame }) => {
  if (!isDeviceFrame) {
    return <div className="w-full min-h-[calc(100vh-4rem)] pb-12">{children}</div>;
  }

  return (
    <div className="w-full flex flex-col items-center justify-start py-4 sm:py-8 px-2 sm:px-4">
      {/* Device Specification Banner */}
      <div className="mb-4 text-center max-w-md">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          <span>HONOR NIC-LX1</span>
          <span className="text-slate-600">·</span>
          <span>Helio G81 Ultra</span>
          <span className="text-slate-600">·</span>
          <span>6 GB RAM</span>
          <span className="text-slate-600">·</span>
          <span>MagicOS 9.0</span>
        </div>
      </div>

      {/* Smartphone Casing */}
      <div className="relative w-full max-w-[420px] bg-slate-900 rounded-[44px] p-3 shadow-2xl shadow-cyan-950/20 border-4 border-slate-800 ring-1 ring-slate-700/50">
        {/* Dynamic Island / Punch Hole */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-slate-950 border border-slate-800/80 shadow-inner flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
          </div>
        </div>

        {/* Inner Screen */}
        <div className="relative w-full bg-slate-950 rounded-[34px] overflow-hidden flex flex-col border border-slate-800/80 min-h-[780px] max-h-[860px]">
          {/* MagicOS 9.0 Status Bar */}
          <div className="h-8 px-6 pt-1 flex items-center justify-between text-[11px] text-slate-400 select-none shrink-0 z-20 bg-slate-950/80 backdrop-blur-sm">
            <span className="font-medium text-slate-200">12:30</span>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                <WifiOff className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400">Офлайн</span>
              </span>
              <div className="flex items-center gap-1 text-slate-300">
                <span className="text-[10px]">98%</span>
                <div className="w-4 h-2 rounded-[2px] border border-slate-400 p-[1px] flex items-center">
                  <div className="w-full h-full bg-emerald-400 rounded-[1px]" />
                </div>
              </div>
            </div>
          </div>

          {/* Screen Content Container with internal scroll */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col">
            {children}
          </div>

          {/* Android 15 Gesture Bar */}
          <div className="h-5 flex items-center justify-center shrink-0 bg-slate-950">
            <div className="w-32 h-1 bg-slate-700 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
