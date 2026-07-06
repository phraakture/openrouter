import { Messages } from "../types";
import { BaseLlm, LlmResponse, LlmStream, StreamChunk } from "./Base";
import OpenAI from "openai";
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class OpenAi extends BaseLlm {
  static async chat(model: string, messages: Messages): Promise<LlmResponse> {
    const response = await client.responses.create({
      model: model,
      input: messages.map(message => ({
        role: message.role,
        content: message.content
      }))
    });

    return {
      inputTokensConsumed: response.usage?.input_tokens!,
      outputTokensConsumed: response.usage?.output_tokens!,
      completions: {
        choices: [{
          message: {
            content: response.output_text
          }
        }]
      }
    }
  }

  static stream(model: string, messages: Messages): LlmStream {
    const openaiStreamPromise = client.chat.completions.create({
      model,
      messages: messages.map(message => ({
        role: message.role,
        content: message.content
      })),
      stream: true,
      stream_options: {
        include_usage: true
      }
    });

    let resolveUsage: (value: { inputTokens: number; outputTokens: number }) => void;
    const usage = new Promise<{ inputTokens: number; outputTokens: number }>(resolve => {
      resolveUsage = resolve;
    });

    async function* generator(): AsyncGenerator<StreamChunk> {
      let inputTokens = 0;
      let outputTokens = 0;
      const openaiStream = await openaiStreamPromise;

      for await (const chunk of openaiStream) {
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }

        yield {
          id: chunk.id,
          object: "chat.completion.chunk",
          created: chunk.created,
          model: chunk.model,
          choices: chunk.choices.map((choice: OpenAI.Chat.Completions.ChatCompletionChunk.Choice) => ({
            index: choice.index,
            delta: {
              role: choice.delta.role,
              content: choice.delta.content ?? undefined
            },
            finish_reason: choice.finish_reason
          }))
        };
      }

      resolveUsage({ inputTokens, outputTokens });
    }

    return {
      stream: generator(),
      usage
    };
  }
}
