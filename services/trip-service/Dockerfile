# Build from the repo root (npm workspaces need the root lockfile + the
# @bus/shared workspace member): docker build -f services/trip-service/Dockerfile -t bus-trip-service .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/trip-service/package.json services/trip-service/package.json
RUN npm ci --workspace=@bus/trip-service --include-workspace-root --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY services/trip-service services/trip-service
COPY proto proto
EXPOSE 50051 50151
CMD ["node", "services/trip-service/src/index.js"]
