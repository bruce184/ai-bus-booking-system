# Build from the repo root (npm workspaces need the root lockfile + the
# @bus/shared workspace member): docker build -f services/analytics-service/Dockerfile -t bus-analytics-service .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/analytics-service/package.json services/analytics-service/package.json
RUN npm ci --workspace=@bus/analytics-service --include-workspace-root --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY services/analytics-service services/analytics-service
COPY proto proto
EXPOSE 50056
CMD ["node", "services/analytics-service/src/index.js"]
