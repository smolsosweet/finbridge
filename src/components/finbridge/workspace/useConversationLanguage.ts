"use client";

import { useEffect, useRef, useState } from "react";
import { APP_UI_COPY, appUiText } from "@/lib/app-ui-copy";
import { finnChatCopy } from "@/lib/finn-voice";
import { conversationTranslationKey, splitConversationText } from "@/lib/conversation-translation";
import type { AppLanguage } from "@/lib/i18n";

function localTranslation(text: string, language: AppLanguage): string | null {
  for (const key of Object.keys(finnChatCopy.en) as Array<keyof typeof finnChatCopy.en>) {
    if (Object.values(finnChatCopy).some(copy => copy[key] === text)) return finnChatCopy[language][key];
  }
  const entry = Object.entries(APP_UI_COPY).find(([vi, translations]) => vi === text.trim() || translations.includes(text.trim()));
  if (entry) return language === "vi" ? entry[0] : entry[1][language === "zh" ? 1 : 0];
  if (/^Xin chào!👋 Hãy mô tả giao dịch; (tôi|Finn) sẽ tạo bản nháp để bạn kiểm tra trước khi lưu\.$/.test(text)) return finnChatCopy[language].greeting;
  return null;
}

export function needsConversationTranslation(text: string, language: AppLanguage, names: string[]) {
  let prose = text;
  for (const name of names) if (name.length > 1) prose = prose.split(name).join("");
  const source = /[à-ỹđÀ-ỸĐ]/.test(prose) ? "vi" : /[\u3400-\u9fff]/.test(prose) ? "zh" : /[a-z]{2}/i.test(prose) ? "en" : null;
  return source !== null && source !== language;
}

/** Ephemeral, account-scoped display cache. Originals remain the only saved/tool input. */
export function useConversationLanguage(texts: string[], language: AppLanguage, owner: string | null, names: string[]) {
  const cache = useRef(new Map<string, string>());
  const failures = useRef(new Set<string>());
  const account = useRef(owner);
  const [revision, setRevision] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"idle" | "pending" | "failed">("idle");
  const sourceKey = JSON.stringify([...new Set(texts.filter(Boolean).flatMap(text => splitConversationText(text)))]);
  const namesKey = JSON.stringify([...new Set(names.filter(name => typeof name === "string" && name.length > 1))].slice(0, 200));
  useEffect(() => {
    if (account.current !== owner) { cache.current.clear(); failures.current.clear(); account.current = owner; }
    const sources: string[] = JSON.parse(sourceKey);
    const protectedNames: string[] = JSON.parse(namesKey);
    const eligible = sources.filter(text => text.length <= 12000 && !localTranslation(text, language) && needsConversationTranslation(text, language, protectedNames) && !cache.current.has(conversationTranslationKey(text, language)));
    const missing = eligible.filter(text => !failures.current.has(conversationTranslationKey(text, language)));
    if (!missing.length) {
      const scheduled = setTimeout(() => setStatus(eligible.length ? "failed" : "idle"), 0);
      return () => clearTimeout(scheduled);
    }
    const controller = new AbortController();
    let active = true;
    async function translate() {
      setStatus("pending");
      try {
        for (let offset = 0; offset < missing.length;) {
          const batch: string[] = []; let size = 0;
          while (offset < missing.length && batch.length < 12 && size + missing[offset].length <= 16000) { const text = missing[offset++]; batch.push(text); size += text.length; }
          const response = await fetch("/api/ai/translate-conversation", {
            method: "POST", headers: { "content-type": "application/json", ...(owner ? { "x-finbridge-workspace-owner": owner } : {}) },
            body: JSON.stringify({ language, names: protectedNames, texts: batch.map((text, index) => ({ id: String(index), text })) }), signal: controller.signal,
          });
          if (!response.ok) throw new Error("TRANSLATION_UNAVAILABLE");
          const result: unknown = await response.json();
          if (!active) return;
          if (!result || typeof result !== "object" || !("texts" in result) || !Array.isArray(result.texts) || result.texts.length !== batch.length) throw new Error("INVALID_TRANSLATION");
          const translated = new Map<string, string>();
          for (const item of result.texts) {
            if (!item || typeof item.id !== "string" || typeof item.text !== "string" || !batch[Number(item.id)] || translated.has(item.id)) throw new Error("INVALID_TRANSLATION");
            translated.set(item.id, item.text);
          }
          batch.forEach((text, index) => { const value = translated.get(String(index)); if (!value) throw new Error("MISSING_TRANSLATION"); cache.current.set(conversationTranslationKey(text, language), value); });
          setRevision(value => value + 1);
        }
        if (active) setStatus("idle");
      } catch {
        if (active) {
          missing.forEach(text => failures.current.add(conversationTranslationKey(text, language)));
          setStatus("failed");
        }
      }
    }
    // Strict-mode remount cleanup cancels before a provider request is sent.
    const scheduled = setTimeout(() => void translate(), 150);
    return () => { active = false; clearTimeout(scheduled); controller.abort(); };
  }, [sourceKey, namesKey, language, owner, attempt]);
  const displayPart = (text: string) => {
    void revision;
    return localTranslation(text, language) || (account.current === owner ? cache.current.get(conversationTranslationKey(text, language)) : null) || appUiText(text, language);
  };
  const displayText = (text: string) => {
    const chunks = splitConversationText(text);
    return chunks.length === 1 ? displayPart(text) : chunks.map(displayPart).join("\n\n");
  };
  return { displayText, status, retry: () => { failures.current.clear(); setAttempt(value => value + 1); } };
}
