# Build from the repo root (npm workspaces need the root lockfile + the
# @bus/shared workspace member): docker build -f workers/ticket-worker/Dockerfile -t bus-ticket-worker .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY workers/ticket-worker/package.json workers/ticket-worker/package.json
RUN npm ci --workspace=ticket-worker --include-workspace-root --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY workers/ticket-worker workers/ticket-worker
EXPOSE 50161
CMD ["node", "workers/ticket-worker/src/index.js"]
