# ==========================================
# STAGE 1: Build & Dependencies
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm 9 (matches lockfile 9.0)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy package manifests and Prisma schema
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies including devDependencies for build
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm run prisma:generate

# Copy source code and build config
COPY tsconfig.json ./
COPY src ./src/

# Compile TypeScript
RUN pnpm run build

# Prune devDependencies to keep image lean
RUN pnpm prune --prod

# ==========================================
# STAGE 2: Production Runtime
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install openssl for Prisma runtime
RUN apk add --no-cache openssl

# Create non-root system user
RUN addgroup -S tedx && adduser -S tedx -G tedx

# Create uploads directory with appropriate permissions
RUN mkdir -p /app/uploads && chown -R tedx:tedx /app/uploads

# Copy built artifacts and production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

USER tedx

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["node", "dist/index.js"]

