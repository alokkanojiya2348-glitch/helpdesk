import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Returns the active AI language model configured via environment variables.
 * Prefers free Google Gemini (GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY),
 * falling back to OpenAI (OPENAI_API_KEY) if present.
 */
export function getAIModel(): LanguageModel | null {
  const geminiKey = (
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  )?.trim();

  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return google(process.env.GEMINI_MODEL || "gemini-2.5-flash");
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return openai(process.env.OPENAI_MODEL || "gpt-4o-mini");
  }

  return null;
}

export function isAIConfigured(): boolean {
  return Boolean(
    (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.OPENAI_API_KEY
    )?.trim()
  );
}
