import bearer from "@elysiajs/bearer";
import { openapi } from "@elysiajs/openapi";
import { prisma } from "db";
import { Elysia, t } from "elysia";
import { Conversation } from "./types";
import { Gemini } from "./llms/Gemini";
import { OpenAi } from "./llms/OpenAi";
import { Claude } from "./llms/Claude";
import { LlmResponse } from "./llms/Base";

const app = new Elysia()
  .use(bearer())
  .use(openapi())
  .post("/api/v1/chat/completions", async ({ status, bearer: apiKey, body }) => {
    const model = body.model;
    const providerModelName = model.split("/").slice(1).join("/");
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
    })

    if (!apiKeyDb) {
      return status(401, {
        message: "Invalid api key"
      })
    }

    if (apiKeyDb?.user.credits <= 0) {
      return status(403, {
        message: "You dont have enough credits in your db"
      })
    }

    const modelDb = await prisma.model.findFirst({
      where: {
        slug: model
      }
    })

    if (!modelDb) {
      return status(400, {
        message: "This is an invalid model we dont support"
      })
    }

    const providers = await prisma.modelProviderMapping.findMany({
      where: {
        modelId: modelDb.id
      },
      include: {
        provider: true
      }
    })

    const provider = providers[Math.floor(Math.random() * providers.length)];

    if (!provider) {
      return status(404, {
        message: "No provider found for this model"
      })
    }

    let response: LlmResponse | null = null
    if (provider.provider.name === "Google API") {
      response = await Gemini.chat(providerModelName, body.messages)
    }

    if (provider.provider.name === "Google Vertex") {
      response = await Gemini.chat(providerModelName, body.messages)
    }

    if (provider.provider.name === "OpenAI") {
      response = await OpenAi.chat(providerModelName, body.messages)
    }

    if (provider.provider.name === "Claude API") {
      response = await Claude.chat(providerModelName, body.messages)
    }

    if (!response) {
      return status(404, {
        message: "No provider found for this model"
      })
    }

    const creditsUsed = (response.inputTokensConsumed * provider.inputTokenCost + response.outputTokensConsumed * provider.outputTokenCost) / 10;
    const lastUserMessage = [...body.messages].reverse().find(m => m.role === "user")?.content ?? "";
    const assistantContent = response.completions.choices[0]?.message.content ?? "";

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
          input: lastUserMessage,
          output: assistantContent,
          inputTokenCount: response.inputTokensConsumed,
          outputTokenCount: response.outputTokensConsumed
        }
      })
    ]);

    return response;
  }, {
    body: Conversation
  }).listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
