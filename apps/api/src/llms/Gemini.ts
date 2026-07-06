import { Messages } from "../types";
import { BaseLlm, LlmResponse, LlmStream, StreamChunk } from "./Base";
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;
function getClient() {
  if (!ai) {
    ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY
    });
  }
  return ai;
}

export class Gemini extends BaseLlm {
  static async chat(model: string, messages: Messages): Promise<LlmResponse> {
    const response = await getClient().models.generateContent({
      model: model,
      contents: messages.map(message => ({
        text: message.content,
        role: message.role
      }))
    });

    return {
      outputTokensConsumed: response.usageMetadata?.candidatesTokenCount!,
      inputTokensConsumed: response.usageMetadata?.promptTokenCount!,
      completions: {
        choices: [{
          message: {
            content: response.text!
          }
        }]
      }
    }
  }

  static stream(model: string, messages: Messages): LlmStream {
    const geminiStreamPromise = getClient().models.generateContentStream({
      model: model,
      contents: messages.map(message => ({
        text: message.content,
        role: message.role
      }))
    });

    let resolveUsage: (value: { inputTokens: number; outputTokens: number }) => void;
    const usage = new Promise<{ inputTokens: number; outputTokens: number }>(resolve => {
      resolveUsage = resolve;
    });

    const id = `chatcmpl_${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    async function* generator(): AsyncGenerator<StreamChunk> {
      let inputTokens = 0;
      let outputTokens = 0;
      let previousText = "";
      const geminiStream = await geminiStreamPromise;

      for await (const chunk of geminiStream) {
        const currentText = chunk.text ?? "";
        const deltaText = currentText.slice(previousText.length);
        previousText = currentText;

        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
          outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
        }

        if (deltaText) {
          yield {
            id,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [{
              index: 0,
              delta: {
                content: deltaText
              },
              finish_reason: null
            }]
          };
        }
      }

      resolveUsage({ inputTokens, outputTokens });
    }

    return {
      stream: generator(),
      usage
    };
  }
}
