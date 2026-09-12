# OctoTask Core — Architecture

## Monorepo Structure

```
octotask-core/
├── packages/
│   └── registry-client/    # Shared NPM registry client (@octotask/registry-client)
├── sdk/                    # Browser SDK (@octotask/sdk) — TypeScript + Vite
├── hyperdeploy/            # Firebase Cloud Functions deploy tool
├── cdn/                    # CDN proxy/router (@octotask/cdn) — Express.js (TypeScript)
├── resolver/               # NPM dependency resolver (@octotask/resolver) (TypeScript)
├── registry-sync/          # NPM registry sync to Redis (@octotask/registry-sync) (TypeScript)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Dependency Graph

```
packages/registry-client ←── shared utilities
  ├── npm-package-arg
  └── superagent

registry-sync ──reads from──> NPM Registry (via concurrent-couch-follower, ioredis)
       │
       ├── feeds data into ──> resolver
       │                        ├── async
       │                        ├── graphlib
       │                        ├── semver
       │                        └── @octotask/registry-client
       │
       └── feeds data into ──> cdn
                                ├── express
                                ├── agentkeepalive
                                ├── lodash
                                ├── semver
                                └── @octotask/registry-client (via imports)

sdk (browser SDK) — standalone (Vite, Vitest, Playwright)
hyperdeploy — standalone (Firebase Tools, microbundle)
```

## Package Overview

### `@octotask/sdk`
Browser-side SDK for embedding OctoTask projects. Uses Vite for building
(CJS, ESM, UMD). TypeScript source in `src/`. Tests via Vitest + Playwright.

### `@octotask/resolver`
Dependency graph resolver for NPM packages. Uses `graphlib` for topological
sorting and `npm-package-arg` for parsing package specs. TypeScript source in `src/`.

### `@octotask/cdn`
Express-based CDN proxy that fetches packages from jsDelivr and serves
them with caching. Uses TypeScript AST parsing for import resolution.

### `@octotask/registry-sync`
Real-time sync of NPM registry data from CouchDB (replicate.npmjs.com)
into Redis. CLI tool with `dist/index.js` as entry point.

### `@octotask/registry-client`
Shared NPM registry client utilities used by `resolver` and `cdn`.
Provides `fetchPackageJson`, `batchFetchPackages`, `parsePackageSpec`.

### `hyperdeploy`
Firebase Cloud Functions utility for deploying static sites. Uses
microbundle for bundling.

## Build System

- **Package Manager**: pnpm workspaces
- **Task Runner**: turbo
- **TypeScript**: 5.x (all packages)
- **Linting**: ESLint + Prettier (root config)
- **Testing**: Jest (backend packages), Vitest + Playwright (SDK)

## Commands

```bash
pnpm install      # Install all dependencies across workspace
pnpm build        # Build all packages
pnpm test         # Test all packages (excluding SDK)
pnpm lint         # Lint all packages
pnpm dev          # Start dev mode in parallel
pnpm clean        # Clean all build outputs
pnpm turbo prune  # Prune workspace for CI
```

## CI/CD

- **test.yml**: Unit tests for backend packages via Jest
- **build-test.yml**: Build all packages via turbo
- **turbo-prune.yml**: Prune and build only changed packages
- **lint-format.yml**: ESLint and Prettier checks
- **docker-build.yml**: Multi-stage Docker builds
- **release.yml**: GitHub releases on version tags
- **docker-compose.yml**: Local development with Redis

## TypeScript Configuration

All packages use `tsconfig.base.json` as the base configuration:
- Target: ES2020
- Module: ESNext/CommonJS depending on package
- Strict mode enabled
- Declaration generation enabled
- Path mapping: `@octotask/*` resolves to workspace packages
