import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";

const DEFAULT_GEMINI_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

function getGeminiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  )?.trim() || undefined;
}

export function isAIConfigured(): boolean {
  return Boolean(getGeminiKey() || process.env.OPENAI_API_KEY?.trim());
}

/**
 * Returns the primary configured AI language model, or null if no API key is set.
 */
export function getAIModel(): LanguageModel | null {
  const geminiKey = getGeminiKey();
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return google(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODELS[0]!);
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return openai(process.env.OPENAI_MODEL || "gpt-4o-mini");
  }

  return null;
}

/**
 * Generates text with automatic Gemini model fallback on transient capacity errors (503).
 */
export async function generateAIText(options: {
  system: string;
  prompt: string;
}): Promise<string> {
  const geminiKey = getGeminiKey();
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    const models = process.env.GEMINI_MODEL
      ? [process.env.GEMINI_MODEL]
      : DEFAULT_GEMINI_MODELS;

    let lastError: unknown;
    for (const modelId of models) {
      try {
        const { text } = await generateText({
          model: google(modelId),
          system: options.system,
          prompt: options.prompt,
          maxRetries: 1,
        });
        return text;
      } catch (error: any) {
        lastError = error;
        const status = error?.statusCode ?? error?.lastError?.statusCode;
        // Try the next Gemini model on transient overload/not-found errors
        if (status === 503 || status === 404 || status === 429) {
          console.warn(`[AI] Model ${modelId} failed (${status}), trying next fallback...`);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    const { text } = await generateText({
      model: openai(process.env.OPENAI_MODEL || "gpt-4o-mini"),
      system: options.system,
      prompt: options.prompt,
    });
    return text;
  }

  throw new Error("No AI API key configured");
}
