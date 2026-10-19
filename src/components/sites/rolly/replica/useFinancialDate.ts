"use client";
import { useSyncExternalStore } from "react";
import { financialCalendarDate } from "../../../../lib/financial-calendar";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const refresh = () => listeners.forEach(listener => listener());
export function subscribeFinancialDate(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer); timer = undefined;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    }
  };
}

/** One shared clock for mounted views; no financial writes or background delivery. */
export function useFinancialDate(initialDate: string, timeZone?: string) {
  return useSyncExternalStore(subscribeFinancialDate, () => financialCalendarDate(new Date(), timeZone), () => initialDate);
}
