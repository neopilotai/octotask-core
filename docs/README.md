# OctoTask Core — Documentation

## Overview

This repository contains the core packages for OctoTask, a browser-based development environment.

## Packages

| Package | Description |
|---|---|
| `@octotask/sdk` | Browser SDK for embedding OctoTask projects |
| `@octotask/resolver` | NPM dependency resolver with graph-based resolution |
| `@octotask/cdn` | CDN proxy for fetching packages from jsDelivr |
| `@octotask/registry-sync` | Real-time NPM registry sync to Redis |
| `hyperdeploy` | Firebase Cloud Functions deployment tool |

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start dev mode
pnpm dev
```

## Architecture

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the full dependency graph and package overview.

## Development

- All TypeScript packages share `tsconfig.base.json`
- ESLint and Prettier configs are managed at the root
- CI/CD uses `turbo` for parallel task execution
- Dependencies are managed via pnpm workspaces
