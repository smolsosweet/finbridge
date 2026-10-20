"use client";

import React, { useState, useEffect } from "react";
import { X, Mic, Check } from "lucide-react";

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitVoice: (transcript: string) => void;
}

const STATIC_WAVE_HEIGHTS = [8, 16, 24, 12, 28, 18, 10, 22, 14, 8];

export function VoiceInputModal({ isOpen, onClose, onSubmitVoice }: VoiceInputModalProps) {
  const [recording, setRecording] = useState(true);
  const transcript = "Coffee with team 15 dollars this morning";

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setRecording(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 mx-auto rounded-full bg-teal-50 flex items-center justify-center text-teal-600 mb-4 relative">
          <Mic className="w-7 h-7" />
          {recording && (
            <span className="absolute inset-0 rounded-full border-2 border-teal-500 animate-ping opacity-40" />
          )}
        </div>

        <h3 className="text-base font-bold text-slate-900 mb-1">
          {recording ? "Listening to your expense..." : "Expense Recorded!"}
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          {recording ? "Say something like: 'Dinner 50 last night'" : "Rolly transcribed your voice"}
        </p>

        {/* Audio Wave Bars */}
        <div className="flex items-center justify-center gap-1.5 h-8 mb-6">
          {STATIC_WAVE_HEIGHTS.map((h, i) => (
            <span
              key={i}
              className={`w-1 rounded-full bg-[#00bebc] transition-all duration-300 ${
                recording ? "animate-pulse" : "opacity-60"
              }`}
              style={{
                height: `${h}px`,
              }}
            />
          ))}
        </div>

        {/* Transcribed text box */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 mb-5 text-left">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Transcribed</p>
          <p className="text-sm font-semibold text-slate-800 leading-snug">
            &ldquo;{transcript}&rdquo;
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onSubmitVoice(transcript);
            onClose();
          }}
          className="w-full py-3 rounded-2xl bg-[#00bebc] hover:bg-[#00abaa] active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>Confirm & Record</span>
        </button>
      </div>
    </div>
  );
}
