# TODO

- [ ] Add structured logging in apps/web/app/api/chatbot/route.js when AI (generateText) times out or errors.
- [ ] Ensure logs include request payload (sanitized), provider/model, latency, and error code/message/stack.
- [ ] Add client-side correlation id + include it in request body from ChatbotPanel.jsx.
- [ ] Add server-side correlation id logging to connect client/server logs.
- [ ] Test by triggering AI call from ChatbotPanel and forcing a timeout (or using slow network) to verify logs appear.

