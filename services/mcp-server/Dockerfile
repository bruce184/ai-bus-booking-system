# Build from the repo root (npm workspaces need the root lockfile + the
# @bus/shared workspace member): docker build -f services/mcp-server/Dockerfile -t bus-mcp-server .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/mcp-server/package.json services/mcp-server/package.json
RUN npm ci --workspace=@bus/mcp-server --include-workspace-root --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# The app defaults MCP_SERVER_HOST to 127.0.0.1 for local-dev safety; a
# container needs 0.0.0.0 or nothing outside the container can reach it.
ENV MCP_SERVER_HOST=0.0.0.0
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY services/mcp-server services/mcp-server
EXPOSE 4010
CMD ["node", "services/mcp-server/src/index.js"]
