"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { GoogleIcon, AppleIcon } from "./Icons";

interface AuthCardProps {
  initialMode?: "login" | "signup";
  onSuccess: () => void;
  onBack: () => void;
}

export function AuthCard({ initialMode = "login", onSuccess, onBack }: AuthCardProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess();
    }, 600);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 bg-[#e8faf7] relative">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-teal-700 bg-white/70 hover:bg-white px-3 py-1.5 rounded-lg border border-teal-600/10 shadow-sm transition-all cursor-pointer z-20"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Floating Mascot Header */}
      <div className="relative w-24 h-24 mb-2 z-10 animate-in fade-in zoom-in-95 duration-200">
        <Image
          src="/sites/rolly/images/Welcome_Icon.png"
          alt="FinBridge assistant"
          width={96}
          height={96}
          priority
          className="w-full h-full object-contain drop-shadow-md"
        />
      </div>

      {/* Main Auth White Card */}
      <div className="w-full max-w-[420px] bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-teal-950/5 border border-slate-100/80 z-10 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1e293b] tracking-tight">
            {mode === "login" ? "Log in now" : "Sign up now"}
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1.5 leading-relaxed">
            {mode === "login"
              ? "Let's continue on your journey by filling out the form below."
              : "Get started on your financial freedom by creating an account."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Email input */}
          <div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all"
            />
          </div>

          {/* Password input */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Confirm password (signup only) */}
          {mode === "signup" && (
            <div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all"
              />
            </div>
          )}

          {/* Main Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#00bebc] hover:bg-[#00abaa] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg transition-all cursor-pointer mt-1"
          >
            {loading ? "Processing..." : mode === "login" ? "Log In" : "Sign Up"}
          </button>
        </form>

        {/* Forgot password */}
        {mode === "login" && (
          <div className="text-center mt-3">
            <span className="text-slate-500 text-xs">Forget Password? </span>
            <button
              type="button"
              onClick={() => alert("Password reset link sent to your email.")}
              className="text-[#00bebc] hover:text-teal-700 font-semibold text-xs transition-colors"
            >
              Reset here
            </button>
          </div>
        )}

        {/* Divider OR */}
        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200/80" />
          </div>
          <span className="relative bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            OR
          </span>
        </div>

        {/* Social Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onSuccess}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            onClick={onSuccess}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <AppleIcon className="text-black" />
            <span>Continue with Apple</span>
          </button>
        </div>

        {/* Newsletter Checkbox */}
        <label className="flex items-start gap-2.5 mt-5 cursor-pointer text-left select-none">
          <input
            type="checkbox"
            checked={subscribeNewsletter}
            onChange={(e) => setSubscribeNewsletter(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-[11px] text-slate-500 leading-normal">
            I would like to subscribe to the newsletter and receive updates, tips, and exclusive offers.
          </span>
        </label>

        {/* Switch mode */}
        <div className="text-center mt-5 pt-3 border-t border-slate-100">
          <span className="text-slate-500 text-xs">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-[#00bebc] hover:text-teal-700 font-bold text-xs transition-colors cursor-pointer"
          >
            {mode === "login" ? "Sign Up here" : "Log In here"}
          </button>
        </div>
      </div>
    </div>
  );
}
