import Anthropic from "@anthropic-ai/sdk";
import { Messages } from "../types";
import { BaseLlm, LlmResponse, LlmStream, StreamChunk } from "./Base";
import { TextBlock } from "@anthropic-ai/sdk/resources";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});


export class Claude extends BaseLlm {
  static async chat(model: string, messages: Messages): Promise<LlmResponse> {

    const response = await client.messages.create({
      max_tokens: 2048,
      messages: messages.map(message => ({
        role: message.role,
        content: message.content
      })),
      model: model
    });

    return {
      outputTokensConsumed: response.usage.output_tokens,
      inputTokensConsumed: response.usage.input_tokens,
      completions: {
        choices: response.content.map(content => ({
          message: {
            content: (content as TextBlock).text
          }
        }))
      }
    }

  }

  static stream(model: string, messages: Messages): LlmStream {
    const anthropicStream = client.messages.stream({
      max_tokens: 2048,
      messages: messages.map(message => ({
        role: message.role,
        content: message.content
      })),
      model: model
    });

    let resolveUsage: (value: { inputTokens: number; outputTokens: number }) => void;
    const usage = new Promise<{ inputTokens: number; outputTokens: number }>(resolve => {
      resolveUsage = resolve;
    });

    const id = `msg_${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    async function* generator(): AsyncGenerator<StreamChunk> {
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of anthropicStream) {
        if (event.type === "message_start" && event.message.usage) {
          inputTokens = event.message.usage.input_tokens;
        }

        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield {
            id,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [{
              index: 0,
              delta: {
                content: event.delta.text
              },
              finish_reason: null
            }]
          };
        }

        if (event.type === "message_delta" && event.usage) {
          outputTokens = event.usage.output_tokens;
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
