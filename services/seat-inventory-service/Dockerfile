# Build from the repo root (npm workspaces need the root lockfile + the
# @bus/shared workspace member): docker build -f services/seat-inventory-service/Dockerfile -t bus-seat-inventory-service .
#
# This runs the gRPC server only (src/server.js, matches the "dev" script).
# The service's separate booking-expired consumer process
# (npm run consume:booking-expired) is not containerized by this image -
# it would need its own CMD/container if the demo runs fully containerized.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/seat-inventory-service/package.json services/seat-inventory-service/package.json
RUN npm ci --workspace=@bus/seat-inventory-service --include-workspace-root --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY services/seat-inventory-service services/seat-inventory-service
COPY proto proto
EXPOSE 50052 50152
CMD ["node", "services/seat-inventory-service/src/server.js"]
