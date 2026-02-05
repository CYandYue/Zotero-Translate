/**
 * Custom Translation Engine
 * Supports OpenAI GPT and DeepSeek API for local PDF translation
 */

import { getPref } from "../utils/prefs";

export type TranslationProvider = "openai" | "deepseek";

export interface TranslationConfig {
  provider: TranslationProvider;
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

/**
 * Get API configuration based on provider
 */
function getAPIConfig(provider: TranslationProvider): {
  baseURL: string;
  defaultModel: string;
} {
  switch (provider) {
    case "openai":
      return {
        baseURL: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini", // Cost-effective model for translation
      };
    case "deepseek":
      return {
        baseURL: "https://api.deepseek.com/v1",
        defaultModel: "deepseek-chat",
      };
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Translate text using custom API
 */
export async function translateText(
  request: TranslationRequest,
): Promise<string> {
  const provider = getPref("customProvider") as TranslationProvider;
  const apiKey = getPref("customApiKey") as string;
  const customModel = getPref("customModel") as string;

  if (!provider || !apiKey) {
    throw new Error(
      "Translation provider and API key must be configured in settings",
    );
  }

  const config = getAPIConfig(provider);
  const model = customModel || config.defaultModel;

  const systemPrompt = `You are a professional academic translator. Translate the following text to ${request.targetLanguage}.
Rules:
1. Maintain the original formatting and structure
2. Preserve all technical terms and academic terminology appropriately
3. Keep mathematical formulas, citations, and references unchanged
4. Only output the translated text, no explanations
5. If the text is already in ${request.targetLanguage}, return it as is`;

  const userPrompt = request.text;

  try {
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent translation
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}\n${errorText}`,
      );
    }

    const data: any = await response.json();

    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error("Invalid response format from API");
    }

    return data.choices[0].message.content.trim();
  } catch (error: any) {
    ztoolkit.log("Translation API Error:", error);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

/**
 * Batch translate multiple text segments
 * Useful for translating PDF pages or paragraphs
 */
export async function batchTranslate(
  texts: string[],
  targetLanguage: string,
  onProgress?: (current: number, total: number) => void,
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];

    // Skip empty strings
    if (!text || text.trim().length === 0) {
      results.push("");
      continue;
    }

    try {
      const translated = await translateText({
        text,
        targetLanguage,
      });
      results.push(translated);

      // Report progress
      if (onProgress) {
        onProgress(i + 1, texts.length);
      }

      // Add delay to avoid rate limiting (adjust based on your API limits)
      if (i < texts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error: any) {
      ztoolkit.log(`Failed to translate segment ${i + 1}:`, error);
      // Keep original text on error
      results.push(text);
    }
  }

  return results;
}

/**
 * Test API connection and configuration
 */
export async function testAPIConnection(
  provider: TranslationProvider,
  apiKey: string,
  model?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const config = getAPIConfig(provider);
    const testModel = model || config.defaultModel;

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: testModel,
        messages: [
          { role: "user", content: "Hello" },
        ],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `API Error: ${response.status} ${response.statusText}\n${errorText}`,
      };
    }

    return {
      success: true,
      message: "API connection successful!",
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
    };
  }
}
