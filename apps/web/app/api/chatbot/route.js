import { generateText, stepCountIs, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import {
  executeGetBookingStatus,
  executeSearchTrips,
  readPolicyResource
} from "../../../lib/chatbot/tools.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  try {
    if (body.message || Array.isArray(body.messages)) {
      return Response.json(await handleAiSdkChat(body));
    }

    if (body.intent === "policy") {
      const policy = readPolicyResource(body.policy);
      return Response.json({
        answer: formatPolicyAnswer(policy),
        source: policy.source,
        data: policy
      });
    }

    if (body.intent === "searchTrips") {
      const data = await executeSearchTrips(body.input ?? {});
      return Response.json({
        answer: formatToolAnswer("searchTrips", data),
        data
      });
    }

    if (body.intent === "getBookingStatus") {
      const input = body.input ?? {};
      if (!input.bookingCode || !input.email) {
        return Response.json({
          answer: "Booking lookup requires both booking code and email.",
          error: "BOOKING_LOOKUP_REQUIRES_CODE_AND_EMAIL"
        });
      }

      const data = await executeGetBookingStatus(input);
      return Response.json({
        answer: formatToolAnswer("getBookingStatus", data),
        data
      });
    }

    return Response.json({
      answer:
        "I can use searchTrips, getBookingStatus, cancellation policy, or check-in policy. I will not invent trip inventory or private booking status."
    });
  } catch (error) {
    return Response.json(
      {
        answer: `Tool data is unavailable: ${error.message}. No fallback data was generated.`,
        error: error.code ?? "TOOL_UNAVAILABLE"
      },
      { status: error.code === "VALIDATION_ERROR" ? 400 : 502 }
    );
  }
}

async function handleAiSdkChat(body) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      answer:
        "OPENAI_API_KEY is not configured. Use the direct tool actions or configure a local AI key for model tool calling.",
      error: "AI_PROVIDER_UNCONFIGURED"
    };
  }

  const { text, toolCalls, toolResults } = await generateText({
    model: openai(process.env.OPENAI_MODEL || "gpt-4o-mini"),
    system:
      "You are EcoBus AI for an intercity bus booking demo. Use tools for trip inventory, booking status, and policy answers. Never invent seat availability, payment state, revenue, or private booking details. Booking status requires both booking code and email. Cite policy resource URIs when answering policy questions.",
    messages: normalizeMessages(body),
    tools: {
      searchTrips: tool({
        description: "Search public demo trips through the GraphQL Gateway.",
        inputSchema: z.object({
          origin: z.string(),
          destination: z.string(),
          departureDate: z.string(),
          minAvailableSeats: z.number().optional()
        }),
        execute: executeSearchTrips
      }),
      getBookingStatus: tool({
        description: "Lookup private booking status. Requires booking code and email.",
        inputSchema: z.object({
          bookingCode: z.string(),
          email: z.string().email()
        }),
        execute: executeGetBookingStatus
      }),
      getPolicyResource: tool({
        description: "Read cancellation or check-in policy source text.",
        inputSchema: z.object({
          policy: z.enum(["cancellation", "checkin"])
        }),
        execute: ({ policy }) => readPolicyResource(policy)
      })
    },
    stopWhen: stepCountIs(4)
  });

  return {
    answer: text,
    toolCalls,
    toolResults
  };
}

function normalizeMessages(body) {
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    return body.messages;
  }

  return [
    {
      role: "user",
      content: String(body.message ?? "")
    }
  ];
}

function formatPolicyAnswer(policy) {
  if (policy.error) {
    return policy.message;
  }

  return `${policy.source}: ${policy.text}`;
}

function formatToolAnswer(toolName, data) {
  return `${toolName} result:\n${JSON.stringify(data, null, 2)}`;
}
