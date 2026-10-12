"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";

interface OnboardingFlowProps {
  onComplete: () => void;
  onBackToWelcome: () => void;
}

const CATEGORY_OPTIONS = [
  { id: "food", name: "Food & Drinks", emoji: "🍔", desc: "Dining out, coffee, groceries" },
  { id: "shopping", name: "Shopping", emoji: "👕", desc: "Clothes, gadgets, personal items" },
  { id: "transport", name: "Transportation", emoji: "🚕", desc: "Gas, ride-hailing, public transit" },
  { id: "home", name: "Home & Bills", emoji: "🏠", desc: "Rent, utilities, internet" },
  { id: "leisure", name: "Fun & Leisure", emoji: "🎮", desc: "Movies, games, travel" },
  { id: "health", name: "Health & Fitness", emoji: "🏋️", desc: "Gym, medical, wellness" },
];

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "VND", symbol: "₫", label: "VND (₫)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "SGD", symbol: "S$", label: "SGD (S$)" },
];

export function OnboardingFlow({ onComplete, onBackToWelcome }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["food", "shopping", "transport"]);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [goal, setGoal] = useState("Save more money");

  const totalSteps = 5;

  const slides = [
    {
      title: "Money Disappears Before You Know It?",
      description: "You forget to track expenses, bills pile up, and you’re never sure where your money really goes.",
      image: "/sites/rolly/images/Confused_people-removebg-preview.png",
      imgWidth: 260,
      imgHeight: 260,
    },
    {
      title: "Smart Expense Tracking with AI",
      description: "Text, voice or image. Rolly understands and records your expenses into the most suitable category you created.",
      image: "/sites/rolly/images/intro1-removebg-preview.png",
      imgWidth: 280,
      imgHeight: 280,
    },
    {
      title: "Achieve Your Goal With Rolly",
      description: "Track your debts, set monthly budgets, and build your savings steadily toward financial freedom.",
      image: "/sites/rolly/images/Financial_Freedom-removebg.png",
      imgWidth: 270,
      imgHeight: 270,
    },
    {
      title: "Build A 365-Day Daily Streak",
      description: "Enter transactions every day to maintain your streak! Unlock achievement badges and build lasting habits.",
      image: "/sites/rolly/images/Rolly-365-streak-removebg-preview.png",
      imgWidth: 280,
      imgHeight: 280,
    },
  ];

  const toggleCategory = (id: string) => {
    if (selectedCategories.includes(id)) {
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter((c) => c !== id));
      }
    } else {
      setSelectedCategories([...selectedCategories, id]);
    }
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      onBackToWelcome();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center px-5 py-6 sm:py-8 bg-[#f5f8f8] relative select-none">
      {/* Background delicate wave pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#22c3ce15_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-40" />

      {/* Top Bar with Back and Skip */}
      <div className="w-full max-w-md flex items-center justify-between z-10">
        <button
          type="button"
          onClick={handlePrev}
          className="p-2 rounded-full hover:bg-slate-200/60 text-slate-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {step < totalSteps - 1 && (
          <button
            type="button"
            onClick={() => setStep(totalSteps - 1)}
            className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide Content */}
      <div className="w-full max-w-md flex flex-col items-center text-center my-auto z-10 px-2 animate-in fade-in duration-200">
        {step < 4 ? (
          <>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight max-w-sm mb-3">
              {slides[step].title}
            </h2>
            <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-xs sm:max-w-sm mb-6">
              {slides[step].description}
            </p>

            <div className="relative my-4 flex items-center justify-center h-64 sm:h-72">
              <Image
                key={slides[step].image}
                src={slides[step].image}
                alt={slides[step].title}
                width={slides[step].imgWidth}
                height={slides[step].imgHeight}
                priority
                className="max-h-full w-auto object-contain drop-shadow-sm transition-all"
              />
            </div>
          </>
        ) : (
          /* Step 5: Questionnaire */
          <div className="w-full text-left space-y-5 animate-in fade-in duration-200">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-slate-900">Set up your finance assistant</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                Customize Rolly to match your spending and goals
              </p>
            </div>

            {/* Currency */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Primary Currency
              </label>
              <div className="flex flex-wrap gap-2">
                {CURRENCIES.map((curr) => (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => setSelectedCurrency(curr.code)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedCurrency === curr.code
                        ? "bg-[#00bebc] text-white shadow-sm"
                        : "bg-white text-slate-700 border border-slate-200 hover:border-teal-300"
                    }`}
                  >
                    {curr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Categories */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Select your main categories
                </label>
                <span className="text-[11px] text-teal-600 font-semibold">
                  {selectedCategories.length} selected
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {CATEGORY_OPTIONS.map((cat) => {
                  const active = selectedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        active
                          ? "bg-[#e5f8f7] border-[#00bebc] text-slate-900 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-xl shrink-0">{cat.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{cat.name}</p>
                      </div>
                      {active && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Goal */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                What is your main financial goal?
              </label>
              <div className="space-y-1.5">
                {[
                  "Save more money each month",
                  "Cut down on unnecessary dining & shopping",
                  "Pay off debt systematically",
                  "Keep track of multiple wallets & travel expenses",
                ].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGoal(g)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      goal === g
                        ? "bg-[#e5f8f7] border-[#00bebc] text-teal-900 font-semibold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation & Indicator */}
      <div className="w-full max-w-md flex items-center justify-between z-10 pt-4 pb-2">
        {/* Step Indicators: 5 horizontal dash pills */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-8 bg-slate-800"
                  : i < step
                  ? "w-3 bg-teal-500"
                  : "w-3 bg-slate-300"
              }`}
            />
          ))}
        </div>

        {/* Circular Next Button or Finish button */}
        {step < totalSteps - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="w-13 h-13 rounded-full bg-[#355b6c] hover:bg-[#284755] active:scale-95 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
            aria-label="Next slide"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="px-6 py-3 rounded-2xl bg-[#00bebc] hover:bg-[#00abaa] active:scale-95 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            Start Tracking →
          </button>
        )}
      </div>
    </div>
  );
}
