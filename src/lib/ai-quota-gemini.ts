import { GoogleGenAI } from "@google/genai";
import { database } from "@/lib/database";
import { aiQuotaRepository } from "./ai-quota-repository";
import { AiQuotaError, createQuotaFetch, readAiQuotaConfig, type AiRoute } from "./ai-quota";

/** Every SDK transport attempt passes through the shared PostgreSQL quota. No RAM fallback. */
export function createQuotaGemini(apiKey: string, owner: string, route: AiRoute) {
  return new GoogleGenAI({ apiKey, httpOptions: {
    retryOptions: { attempts: 1 },
    fetch: async (input, init) => {
      const config = readAiQuotaConfig();
      let repository;
      try { repository = aiQuotaRepository(database()); }
      catch { throw new AiQuotaError("AI_QUOTA_UNAVAILABLE"); }
      const quotaFetch = createQuotaFetch({ owner, route, config, repository });
      return quotaFetch(input, init);
    },
  } });
}
