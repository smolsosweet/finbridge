"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ChevronDown, Globe } from "lucide-react";

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onLogIn: () => void;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
];

export function WelcomeScreen({ onGetStarted, onLogIn }: WelcomeScreenProps) {
  const [selectedLang, setSelectedLang] = useState("English");
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center px-4 py-6 sm:py-8 bg-[#e8faf7] overflow-hidden select-none">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/40 blur-[90px] rounded-full pointer-events-none" />

      {/* Top Header Bar / Language Selector */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10">
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangMenuOpen(!langMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-teal-600/20 bg-white/70 hover:bg-white text-slate-700 text-xs sm:text-sm font-medium shadow-sm transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-teal-600" />
            <span>{selectedLang}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {langMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-36 rounded-xl bg-white shadow-lg border border-slate-100 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setSelectedLang(lang.label);
                    setLangMenuOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors ${
                    selectedLang === lang.label
                      ? "text-teal-600 bg-teal-50/70 font-semibold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Small brand pill if desired */}
        <div className="flex items-center gap-1.5 text-teal-700/80 text-xs font-semibold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          Rolly AI
        </div>
      </div>

      {/* Main Hero Section */}
      <div className="w-full max-w-md flex flex-col items-center text-center my-auto z-10 px-2">
        <p className="text-slate-500 text-sm sm:text-base font-normal max-w-xs sm:max-w-sm leading-relaxed mb-6 sm:mb-8">
          Hello! My name is Rolly and I will be your money tracker assistant.
        </p>

        {/* Mascot Robot */}
        <div className="relative w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center my-2 transition-transform duration-300 hover:scale-105">
          <Image
            src="/sites/rolly/images/Welcome_Icon.png"
            alt="Rolly AI Robot Mascot"
            width={240}
            height={240}
            priority
            className="w-full h-full object-contain drop-shadow-sm"
          />
        </div>

        {/* Big Bold Headline */}
        <h1 className="mt-8 sm:mt-10 text-2xl sm:text-3xl md:text-4xl font-bold text-[#00b8b8] tracking-tight leading-tight">
          Track Smarter With AI Assistant
        </h1>
      </div>

      {/* Bottom CTA Actions */}
      <div className="w-full max-w-md flex flex-col items-center gap-3.5 z-10 pb-2">
        <button
          type="button"
          onClick={onGetStarted}
          className="w-full py-3.5 px-6 rounded-2xl bg-[#00bebc] hover:bg-[#00abaa] active:scale-[0.99] text-white font-bold text-base sm:text-lg shadow-md hover:shadow-lg transition-all cursor-pointer text-center"
        >
          Get Started
        </button>

        <button
          type="button"
          onClick={onLogIn}
          className="text-slate-700 hover:text-teal-700 text-sm font-medium underline underline-offset-4 transition-colors cursor-pointer"
        >
          Returning user? Log in here
        </button>
      </div>
    </div>
  );
}
