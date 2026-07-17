# Build from the repo root (npm workspaces need the root lockfile + the
# @bus/shared workspace member): docker build -f services/booking-service/Dockerfile -t bus-booking-service .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/booking-service/package.json services/booking-service/package.json
RUN npm ci --workspace=booking-service --include-workspace-root --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY services/booking-service services/booking-service
COPY proto proto
EXPOSE 50053 50153
CMD ["node", "services/booking-service/src/index.js"]
