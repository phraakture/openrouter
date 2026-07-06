import { Messages } from "../types";

export type LlmResponse = {
  completions: {
    choices: {
      message: {
        content: string
      }
    }[]
  },
  inputTokensConsumed: number,
  outputTokensConsumed: number
}

export type StreamChunk = {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export type LlmStream = {
  stream: AsyncIterable<StreamChunk>;
  usage: Promise<{ inputTokens: number; outputTokens: number }>;
}

export class BaseLlm {
  static async chat(model: string, messages: Messages): Promise<LlmResponse> {
    throw new Error("Not implemented chat function")
  }

  static stream(model: string, messages: Messages): LlmStream {
    throw new Error("Not implemented stream function")
  }
}
