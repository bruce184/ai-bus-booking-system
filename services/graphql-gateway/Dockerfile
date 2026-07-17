# Build from the repo root (npm workspaces need the root lockfile + the
# @bus/shared workspace member): docker build -f services/graphql-gateway/Dockerfile -t bus-graphql-gateway .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/graphql-gateway/package.json services/graphql-gateway/package.json
RUN npm ci --workspace=@intercity-bus/graphql-gateway --include-workspace-root --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY services/graphql-gateway services/graphql-gateway
COPY proto proto
EXPOSE 4000
CMD ["node", "services/graphql-gateway/src/index.js"]
