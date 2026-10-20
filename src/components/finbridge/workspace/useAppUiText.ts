"use client";

import { appUiText } from "@/lib/app-ui-copy";
import { useAppState } from "./store";

export function useAppUiText() {
  const language = useAppState().settings.language;
  return (text: string) => appUiText(text, language);
}
