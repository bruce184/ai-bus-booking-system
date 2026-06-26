import http from "node:http";
import { publishKafkaEvent } from "@bus/shared/events.js";

const port = Number(process.env.PAYMENT_SERVICE_PORT || 5010);

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "payment-service" }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/simulate") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "NOT_FOUND" }));
    return;
  }

  try {
    const body = await readJson(request);
    if (!body.bookingCode) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "VALIDATION_ERROR", message: "bookingCode is required" }));
      return;
    }

    const eventName = body.success ? "payment.simulated_success" : "payment.simulated_failure";
    await publishKafkaEvent("payment-events", eventName, {
      bookingCode: body.bookingCode,
      amount: Number(body.amount || 0)
    });

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ bookingCode: body.bookingCode, success: Boolean(body.success) }));
  } catch (error) {
    console.error("[payment-service]", error);
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "INTERNAL_ERROR" }));
  }
});

server.listen(port, () => {
  console.log(`[payment-service] HTTP listening on http://localhost:${port}`);
});
