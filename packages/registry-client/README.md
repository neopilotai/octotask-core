# @octotask/registry-client

Shared NPM registry client utilities for OctoTask packages.

## Usage

```typescript
import {
  fetchPackageJson,
  batchFetchPackages,
  parsePackageSpec,
} from '@octotask/registry-client';
```

## Exports

- `DEFAULT_REGISTRY_URL` - Default NPM registry URL
- `fetchPackageJson(name, registryUrl?)` - Fetch package metadata
- `fetchPackageJsonSafe(name, registryUrl?)` - Fetch with error handling
- `batchFetchPackages(names, registryUrl?, cache?)` - Batch fetch multiple packages
- `parsePackageSpec(spec)` - Parse a package spec string
- `escapeName(name)` - Escape a package name for registry URLs
