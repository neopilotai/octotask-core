# Docker Setup Guide

This repository includes comprehensive Docker support for easy development and deployment.

## Quick Start

### Development with Docker Compose

```bash
# Start all services (Redis + development environment)
docker-compose up -d dev

# View logs
docker-compose logs -f dev

# Stop all services
docker-compose down
```

### Production Services

```bash
# Start registry-sync and hyperdeploy
docker-compose up -d registry-sync hyperdeploy redis

# Check service status
docker-compose ps

# View logs
docker-compose logs -f registry-sync
docker-compose logs -f hyperdeploy
```

## Docker Images

### Hyperdeploy

Multi-stage optimized image for Firebase deployments from Cloud Functions.

```bash
# Build
docker build --target hyperdeploy -t octotask-hyperdeploy .

# Run
docker run -e NODE_ENV=production octotask-hyperdeploy

# With Docker Compose
docker-compose up -d hyperdeploy
```

### Registry Sync

Synchronizes NPM data in real-time from NPM Replicate into Redis.

```bash
# Build
docker build --target registry-sync -t octotask-registry-sync .

# Run (requires Redis)
docker run -e REDIS_URL=redis://redis:6379 octotask-registry-sync

# With Docker Compose
docker-compose up -d registry-sync redis
```

### Development

Includes all dependencies with hot-reload support.

```bash
# Build
docker build -f Dockerfile.dev -t octotask-dev .

# Run with volume mounting
docker run -v $(pwd):/app octotask-dev

# With Docker Compose
docker-compose up -d dev
```

## Environment Variables

### Registry Sync

- `REDIS_URL`: Redis connection URL (default: `redis://redis:6379`)
- `NODE_ENV`: Set to `production` for production deployments

### Hyperdeploy

- `NODE_ENV`: Set to `production` for production deployments
- `REDIS_URL`: Optional Redis URL for caching

## Docker Compose Services

### redis

- **Image**: `redis:7-alpine`
- **Port**: `6379`
- **Volume**: `redis_data` (persistent)
- **Health Check**: Built-in redis-cli ping

### registry-sync

- **Depends on**: `redis`
- **Environment**: Uses `REDIS_URL`
- **Restart Policy**: Unless stopped
- **Logging**: JSON file driver with 10MB rotation

### hyperdeploy

- **Ports**: `8080`
- **Depends on**: `redis`
- **Restart Policy**: Unless stopped
- **Logging**: JSON file driver with 10MB rotation

### dev

- **Ports**: `3000`, `8080`
- **Volumes**: Full source directory with node_modules exclusions
- **Command**: `npm run dev`

## Multi-Stage Build Benefits

1. **Smaller images**: Development dependencies not included in production
2. **Faster builds**: Layers are cached efficiently
3. **Better security**: Fewer attack vectors in production
4. **Flexibility**: Different targets for different use cases

## Container Registry

Images are automatically built and pushed to GitHub Container Registry (GHCR) on:

- Push to `master` or `main` branch
- Tagged releases (`v*`, `docker-*`)

### Pull Images

```bash
docker pull ghcr.io/octotask/core-hyperdeploy:latest
docker pull ghcr.io/octotask/core-registry-sync:latest
```

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs

# Verify images built correctly
docker images | grep octotask

# Rebuild images without cache
docker-compose build --no-cache
```

### Redis connection issues

```bash
# Check Redis health
docker-compose exec redis redis-cli ping

# View Redis logs
docker-compose logs redis
```

### Volume mount issues (Windows/Mac)

```bash
# Ensure Docker Desktop has adequate resources
# Increase CPU and memory in Docker Desktop settings

# Or use named volumes instead
docker volume ls
docker volume inspect octotask_app_data
```

## Performance Tips

1. Use Alpine-based images for smaller size
2. Multi-stage builds reduce final image size by ~70%
3. Docker layer caching significantly speeds up rebuilds
4. Use `.dockerignore` to exclude unnecessary files

## Security Considerations

- Non-root user execution (recommended in production)
- Alpine base images reduce vulnerability surface
- Secrets should use Docker secrets or environment management
- Health checks enable automatic container restart on failure

## CI/CD Integration

Docker images are automatically built and tested on:

- Every PR
- Every push to master/main
- Tagged releases

See `.github/workflows/docker-build.yml` for details.
