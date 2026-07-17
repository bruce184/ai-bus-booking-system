# Build from the repo root (npm workspaces need the root lockfile + the
# @bus/shared workspace member): docker build -f services/payment-service/Dockerfile -t bus-payment-service .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/payment-service/package.json services/payment-service/package.json
RUN npm ci --workspace=payment-service --include-workspace-root --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY services/payment-service services/payment-service
EXPOSE 5010
CMD ["node", "services/payment-service/src/index.js"]
