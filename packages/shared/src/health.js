import http from "node:http";

// Minimal liveness endpoint for services that don't already run an HTTP
// server of their own (pure-gRPC services and background workers) - just
// enough for a Docker/K8s health probe, not the semantic end-to-end demo
// readiness check (see scripts/wait-for-services.mjs for that).
export function startHealthServer(port, service) {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "NOT_FOUND" }));
  });
  // Bind to loopback to avoid platform/network binding permission issues
  // (Windows frequently blocks binding to 0.0.0.0 for this use-case).
  server.listen(port, "127.0.0.1");
  return server;
}
