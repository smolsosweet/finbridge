"use client";

import React from "react";

interface CheerleaderMascotProps {
  greetingText?: string;
}

export function CheerleaderMascot({ greetingText = "Chào 👋" }: CheerleaderMascotProps) {
  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* Speech Bubble */}
      <div className="absolute -top-7 left-1/2 translate-x-4 z-20 animate-bounce duration-1000">
        <div className="relative bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100 text-xs font-semibold text-slate-800 flex items-center gap-1">
          <span>{greetingText}</span>
          {/* Bubble tail */}
          <div className="absolute -bottom-1 left-2.5 w-2 h-2 bg-white border-b border-r border-slate-100 rotate-45 transform" />
        </div>
      </div>

      {/* Mascot Graphic */}
      <div className="relative w-36 h-28 flex items-center justify-center">
        <svg
          viewBox="0 0 160 140"
          className="w-full h-full drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Shadow underneath */}
          <ellipse cx="80" cy="132" rx="36" ry="6" fill="#000000" fillOpacity="0.08" />

          {/* Pom-Pom Left (Pink fluff) */}
          <g transform="translate(18, 54)">
            <circle cx="16" cy="16" r="13" fill="#f472b6" />
            <circle cx="10" cy="12" r="7" fill="#fbcfe8" />
            <circle cx="22" cy="10" r="6" fill="#f472b6" />
            <circle cx="20" cy="22" r="7" fill="#ec4899" />
            <circle cx="9" cy="20" r="6" fill="#f472b6" />
            <circle cx="15" cy="15" r="5" fill="#fdf2f8" />
          </g>

          {/* Pom-Pom Right (Pink fluff) */}
          <g transform="translate(108, 54)">
            <circle cx="16" cy="16" r="13" fill="#f472b6" />
            <circle cx="10" cy="12" r="7" fill="#fbcfe8" />
            <circle cx="22" cy="10" r="6" fill="#f472b6" />
            <circle cx="20" cy="22" r="7" fill="#ec4899" />
            <circle cx="9" cy="20" r="6" fill="#f472b6" />
            <circle cx="15" cy="15" r="5" fill="#fdf2f8" />
          </g>

          {/* Robot Body */}
          <ellipse cx="80" cy="105" rx="22" ry="20" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2.5" />
          <path d="M72 108 C76 112 84 112 88 108" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />

          {/* Head Left Ear / Muff (Pink) */}
          <rect x="42" y="55" width="8" height="20" rx="4" fill="#f472b6" />
          <rect x="44" y="58" width="4" height="14" rx="2" fill="#fbcfe8" />

          {/* Head Right Ear / Muff (Pink) */}
          <rect x="110" y="55" width="8" height="20" rx="4" fill="#f472b6" />
          <rect x="112" y="58" width="4" height="14" rx="2" fill="#fbcfe8" />

          {/* Head Outer Shell */}
          <rect
            x="48"
            y="40"
            width="64"
            height="48"
            rx="24"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="2.5"
          />

          {/* Head Top Band */}
          <path d="M60 41 Q80 37 100 41" stroke="#f472b6" strokeWidth="3" strokeLinecap="round" />

          {/* Visor Screen (Dark slate) */}
          <rect x="56" y="48" width="48" height="32" rx="16" fill="#1e293b" />

          {/* Glowing Eyes (Cyan Blue) */}
          <ellipse cx="68" cy="64" rx="4.5" ry="7" fill="#38bdf8" />
          <ellipse cx="92" cy="64" rx="4.5" ry="7" fill="#38bdf8" />
          <circle cx="69" cy="62" r="1.5" fill="#ffffff" />
          <circle cx="93" cy="62" r="1.5" fill="#ffffff" />
        </svg>
      </div>
    </div>
  );
}
