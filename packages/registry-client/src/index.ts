import npa from 'npm-package-arg';
import request from 'superagent';

export const DEFAULT_REGISTRY_URL =
  (process.env.NPM_REGISTRY_URL ?? '') || 'https://registry.npmjs.org';

export interface RegistryPackage {
  name: string;
  'dist-tags'?: Record<string, string>;
  versions: Record<string, PackageVersion>;
}

export interface PackageVersion {
  name: string;
  version: string;
  main?: string;
  browser?: string;
  unpkg?: string;
  module?: string;
  'jsnext:main'?: string;
  types?: string;
  typings?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export function escapeName(name: string): string {
  const result = npa(name);
  return result.escapedName || name;
}

export function fetchPackageJson(
  name: string,
  registryUrl: string = DEFAULT_REGISTRY_URL,
): Promise<RegistryPackage> {
  const escapedName = escapeName(name);
  return request
    .get(`${registryUrl}/${escapedName}`)
    .then((res) => res.body as RegistryPackage);
}

export function fetchPackageJsonSafe(
  name: string,
  registryUrl: string = DEFAULT_REGISTRY_URL,
): Promise<RegistryPackage | null> {
  const escapedName = escapeName(name);
  return request
    .get(`${registryUrl}/${escapedName}`)
    .then((res: { body: RegistryPackage }) => res.body as RegistryPackage)
    .catch(() => null);
}

export function batchFetchPackages(
  names: string[],
  registryUrl: string = DEFAULT_REGISTRY_URL,
  cache: Record<string, RegistryPackage> = {},
): Promise<void> {
  const fetchKeys = names.filter((key) => !cache.hasOwnProperty(key));
  if (fetchKeys.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    fetchKeys.map((name) =>
      fetchPackageJson(name, registryUrl).then((pkg) => {
        cache[name] = pkg;
      }),
    ),
  ).then(() => {});
}

export function parsePackageSpec(spec: string): {
  name: string;
  range: string;
} {
  const parsed = npa(spec);
  return { name: parsed.name || spec, range: parsed.raw || '' };
}
