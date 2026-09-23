# syntax=docker/dockerfile:1.4
# Security: Pin to a specific Node LTS patch release for reproducible builds.
# For maximum supply chain security in CI, pin to a digest:
#   FROM node:22.16-slim@sha256:<digest>
# Run `docker pull node:22.16-slim && docker inspect --format='{{index .RepoDigests 0}}' node:22-slim`
# to get the current digest.
FROM node:22-slim AS base

# 1. Install dependencies only when needed
FROM base AS deps
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

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 3000

CMD ["node", "server.js"]
