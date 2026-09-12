# Multi-stage Dockerfile for OctoTask Core packages
# Uses pnpm workspaces for dependency management

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY pnpm-lock.yaml ./
COPY sdk/package.json ./sdk/
COPY hyperdeploy/package.json ./hyperdeploy/
COPY cdn/package.json ./cdn/
COPY resolver/package.json ./resolver/
COPY registry-sync/package.json ./registry-sync/

# Install dependencies via pnpm workspaces
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build packages
RUN pnpm turbo run build

# Stage 2: Runtime - Registry Sync
FROM node:20-alpine AS registry-sync

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app /app

COPY registry-sync/package.json ./registry-sync/
COPY pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod --filter=@octotask/registry-sync

EXPOSE 6379
ENV REDIS_URL=redis://redis:6379

ENTRYPOINT ["pnpm"]
CMD ["registry-sync"]

# Stage 3: Runtime - Hyperdeploy
FROM node:20-alpine AS hyperdeploy

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/hyperdeploy /app/hyperdeploy

ENV NODE_ENV=production

EXPOSE 8080

ENTRYPOINT ["node"]
CMD ["dist/hyperdeploy.js"]

# Stage 4: Development
FROM node:20-alpine AS development

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy all package files
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY pnpm-lock.yaml ./
COPY sdk/package.json ./sdk/
COPY hyperdeploy/package.json ./hyperdeploy/
COPY cdn/package.json ./cdn/
COPY resolver/package.json ./resolver/
COPY registry-sync/package.json ./registry-sync/

# Install all dependencies
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000 8080

ENV NODE_ENV=development

CMD ["pnpm", "run", "dev"]
