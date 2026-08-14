# syntax=docker/dockerfile:1.4
FROM node:22-slim AS base

# 1. Install dependencies only when needed
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# 2. Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# 3. Production image — minimal Debian base with only the Node binary
FROM debian:bookworm-slim AS runner
WORKDIR /app

# Copy just the Node.js binary (skip npm, yarn, corepack — we only need `node server.js`)
COPY --from=base /usr/local/bin/node /usr/local/bin/node
COPY --from=base /usr/local/lib/node_modules /usr/local/lib/node_modules

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server (includes only traced node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy static assets and public files
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy libonnxruntime.so to system libs to bypass dlopen path resolution issues
RUN find /app/node_modules/onnxruntime-node/bin -name "libonnxruntime.so*" -exec cp {} /usr/lib/ \; || true

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
