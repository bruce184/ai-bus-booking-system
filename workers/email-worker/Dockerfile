# Build from the repo root (npm workspaces need the root lockfile + the
# @bus/shared workspace member): docker build -f workers/email-worker/Dockerfile -t bus-email-worker .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY workers/email-worker/package.json workers/email-worker/package.json
RUN npm ci --workspace=email-worker --include-workspace-root --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY workers/email-worker workers/email-worker
EXPOSE 50162
CMD ["node", "workers/email-worker/src/index.js"]
