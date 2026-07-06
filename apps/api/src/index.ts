import bearer from "@elysiajs/bearer";
import { openapi } from "@elysiajs/openapi";
import { prisma } from "db";
import { Elysia, t } from "elysia";
import { Conversation } from "./types";
import { Gemini } from "./llms/Gemini";
import { OpenAi } from "./llms/OpenAi";
import { Claude } from "./llms/Claude";
import { LlmResponse, LlmStream, StreamChunk } from "./llms/Base";

type ResolveError = { status: number; body: { message: string } };
type ResolveSuccess = {
  apiKeyDb: { id: number; user: { id: number } };
  provider: {
    id: number;
    inputTokenCost: number;
    outputTokenCost: number;
    provider: { name: string };
  };
  providerModelName: string;
};
type ResolveResult =
  | { ok: false; error: ResolveError }
  | { ok: true; data: ResolveSuccess };

async function resolveProvider(model: string, apiKey: string): Promise<ResolveResult> {
  const apiKeyDb = await prisma.apiKey.findFirst({
    where: {
      apiKey,
      disabled: false,
      deleted: false
    },
    select: {
      id: true,
      user: true
    }
  });

  if (!apiKeyDb) {
    return { ok: false, error: { status: 401, body: { message: "Invalid api key" } } };
  }

  if (apiKeyDb.user.credits <= 0) {
    return { ok: false, error: { status: 403, body: { message: "You dont have enough credits in your db" } } };
  }

  const modelDb = await prisma.model.findFirst({
    where: {
      slug: model
    }
  });

  if (!modelDb) {
    return { ok: false, error: { status: 400, body: { message: "This is an invalid model we dont support" } } };
  }

  const providers = await prisma.modelProviderMapping.findMany({
    where: {
      modelId: modelDb.id
    },
    include: {
      provider: true
    }
  });

  const provider = providers[Math.floor(Math.random() * providers.length)];

  if (!provider) {
    return { ok: false, error: { status: 404, body: { message: "No provider found for this model" } } };
  }

  return {
    ok: true,
    data: {
      apiKeyDb,
      provider,
      providerModelName: model.split("/").slice(1).join("/")
    }
  };
}

function callProvider(model: string, messages: any[], providerName: string): Promise<LlmResponse> {
  if (providerName === "Google API" || providerName === "Google Vertex") {
    return Gemini.chat(model, messages);
  }
  if (providerName === "OpenAI") {
    return OpenAi.chat(model, messages);
  }
  if (providerName === "Claude API") {
    return Claude.chat(model, messages);
  }
  throw new Error("Unsupported provider");
}

function streamProvider(model: string, messages: any[], providerName: string): LlmStream {
  if (providerName === "Google API" || providerName === "Google Vertex") {
    return Gemini.stream(model, messages);
  }
  if (providerName === "OpenAI") {
    return OpenAi.stream(model, messages);
  }
  if (providerName === "Claude API") {
    return Claude.stream(model, messages);
  }
  throw new Error("Unsupported provider");
}

async function recordUsage(
  apiKeyDb: { id: number; user: { id: number } },
  apiKey: string,
  provider: { id: number; inputTokenCost: number; outputTokenCost: number },
  inputTokens: number,
  outputTokens: number,
  input: string,
  output: string
) {
  const creditsUsed = (inputTokens * provider.inputTokenCost + outputTokens * provider.outputTokenCost) / 10;

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: apiKeyDb.user.id
      },
      data: {
        credits: {
          decrement: creditsUsed
        }
      }
    }),
    prisma.apiKey.update({
      where: {
        apiKey: apiKey
      },
      data: {
        creditsConsumed: {
          increment: creditsUsed
        },
        lastUsed: new Date()
      }
    }),
    prisma.conversation.create({
      data: {
        userId: apiKeyDb.user.id,
        apiKeyId: apiKeyDb.id,
        modelProviderMappingId: provider.id,
        input,
        output,
        inputTokenCount: inputTokens,
        outputTokenCount: outputTokens
      }
    })
  ]);
}

const app = new Elysia()
  .use(bearer())
  .use(openapi())
  .post("/api/v1/chat/completions", async ({ status, bearer: apiKey, body }) => {
    const model = body.model;
    const resolved = await resolveProvider(model, apiKey ?? "");

    if (!resolved.ok) {
      return status(resolved.error.status, resolved.error.body);
    }

    const { apiKeyDb, provider, providerModelName } = resolved.data;

    if (body.stream) {
      const { stream, usage } = streamProvider(providerModelName, body.messages, provider.provider.name);

      const encoder = new TextEncoder();
      const lastUserMessage = [...body.messages].reverse().find(m => m.role === "user")?.content ?? "";
      let fullContent = "";
      let inputTokens = 0;
      let outputTokens = 0;

      const sseStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              if (chunk.usage) {
                inputTokens = chunk.usage.prompt_tokens;
                outputTokens = chunk.usage.completion_tokens;
              }

              const deltaContent = chunk.choices[0]?.delta?.content;
              if (deltaContent) {
                fullContent += deltaContent;
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();

            const finalUsage = await usage;
            await recordUsage(
              apiKeyDb,
              apiKey ?? "",
              provider,
              inputTokens || finalUsage.inputTokens,
              outputTokens || finalUsage.outputTokens,
              lastUserMessage,
              fullContent
            );
          } catch (e) {
            controller.error(e);
          }
        }
      });

      return new Response(sseStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }

    let response: LlmResponse | null = null;
    try {
      response = await callProvider(providerModelName, body.messages, provider.provider.name);
    } catch {
      return status(404, {
        message: "No provider found for this model"
      });
    }

    const creditsUsed = (response.inputTokensConsumed * provider.inputTokenCost + response.outputTokensConsumed * provider.outputTokenCost) / 10;
    const lastUserMessage = [...body.messages].reverse().find(m => m.role === "user")?.content ?? "";
    const assistantContent = response.completions.choices[0]?.message.content ?? "";

    await recordUsage(
      apiKeyDb,
      apiKey ?? "",
      provider,
      response.inputTokensConsumed,
      response.outputTokensConsumed,
      lastUserMessage,
      assistantContent
    );

    return response;
  }, {
    body: Conversation
  }).listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
