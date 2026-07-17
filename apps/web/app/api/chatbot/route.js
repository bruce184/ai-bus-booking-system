import { generateText, stepCountIs, tool } from "ai";
import { google } from "@ai-sdk/google";
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
    // Nếu gọi kiểu "direct tool actions" (intent) thì không cần OPENAI.
    // Chỉ khi request có message (model chat) mới bắt buộc OPENAI.
    if (body.intent) {
      // Route tool actions first: ensures UI buttons work even when OPENAI_API_KEY is missing.
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
          "I can use searchTrips, getBookingStatus, cancellation policy, or check-in policy."
      });
    }

    // Model chat (message/messages) path: AI provider optional.
    if (body.message || Array.isArray(body.messages)) {
      return Response.json(await handleAiSdkChat(body, body.correlationId));
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


async function handleAiSdkChat(body, correlationId) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error("[chatbot] AI_PROVIDER_UNCONFIGURED", {
      correlationId,
      model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash"
    });
    

    return {
      answer:
        "Thiếu GOOGLE_GENERATIVE_AI_API_KEY. Vui lòng dùng các nút: “Tìm chuyến”, “Hủy vé”, “Check-in”, hoặc “Tra cứu booking” (chế độ gọi tool trực tiếp).",
      error: "AI_PROVIDER_UNCONFIGURED"
    };
  }


  const modelName = process.env.GOOGLE_MODEL ?? "gemini-2.5-flash";
  const startedAt = Date.now();
  try {
    const { text, toolCalls, toolResults } = await generateText({
      model: google(modelName),

      system: `
You are EcoBus AI for an intercity bus booking demo.  


Always use tools whenever possible.

Available tools:

- searchTrips
- getBookingStatus
- getPolicyResource

Rules:

- Never invent trips.
- Never invent booking status.
- Never invent payment status.
- Never invent seat availability.
- Booking lookup requires BOTH bookingCode and email.
- Use policy tool for cancellation/check-in questions.
- Respond in Vietnamese unless the user explicitly asks another language.

When calling searchTrips:

Normalize locations:

- hcm
- tphcm
- hồ chí minh
- ho chi minh
- sài gòn
- sai gon

=> TP.HCM

Normalize:

- dalat
- đà lạt

=> Da Lat

If the user asks for 18/7 and no year is provided, use 2026-07-18.

Always use YYYY-MM-DD.
`,

    messages: normalizeMessages(body),

    tools: {
      searchTrips: tool({
        description: "Search public demo trips.",
        inputSchema: z.object({
          origin: z.string(),
          destination: z.string(),
          departureDate: z.string(),
          minAvailableSeats: z.number().optional()
        }),
        execute: executeSearchTrips
      }),

      getBookingStatus: tool({
        description: "Lookup booking status.",
        inputSchema: z.object({
          bookingCode: z.string(),
          email: z.string().email()
        }),
        execute: executeGetBookingStatus
      }),

      getPolicyResource: tool({
        description: "Read EcoBus policy.",
        inputSchema: z.object({
          policy: z.enum([
            "cancellation",
            "checkin"
          ])
        }),
        execute: ({ policy }) =>
          readPolicyResource(policy)
      })
    },

    stopWhen: stepCountIs(5)
  });

  const trips =
    toolResults?.find(
      (t) => t.toolName === "searchTrips"
    )?.result?.searchTrips?.trips ?? [];

  return {
    answer: text,
    trips,
    toolCalls,
    toolResults
  };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    console.error("[chatbot] AI_TIMEOUT_OR_ERROR", {
      correlationId,
      model: modelName,
      latencyMs,
      name: error?.name,
      code: error?.code,
      message: error?.message,
      stack: error?.stack
    });

    throw error;
  }
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
