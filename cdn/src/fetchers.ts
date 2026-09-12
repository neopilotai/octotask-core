import _ from 'lodash';
import request from 'superagent';
import parseImports from './parseImports';

export const JSDELIVR_URL =
  process.env.CDN_BASE_URL || 'https://cdn.jsdelivr.net/npm';
export const RESOLVED_EXTENSIONS = ['.js', '.json', '/index.js', '/index.json'];

const REQUEST_TIMEOUT = parseInt(
  process.env.CDN_REQUEST_TIMEOUT || '60000',
  10,
);

export interface FetchResult {
  text: string;
  status: number;
  headers: any;
}

export async function fetchUrl(
  url: string,
  buffer = false,
): Promise<string | object> {
  return request
    .get(url)
    .timeout(REQUEST_TIMEOUT)
    .buffer(!!buffer)
    .catch((error: any) => {
      if (error.status === 503 || error.status === 504) {
        return fetchUrl(url, !!buffer);
      }
      return Promise.reject(error);
    });
}

export async function fetchDirList(packageSlug: string): Promise<string[]> {
  const res = await fetchUrl(
    `https://data.jsdelivr.com/v1/package/npm/${packageSlug}/flat`,
  );
  return (res as any).body.files.map((file: any) => file.name);
}

export async function fetchPackageJson(packageSlug: string): Promise<object> {
  const res = await fetchUrl(`${JSDELIVR_URL}/${packageSlug}/package.json`);
  return (res as any).body;
}

function normalizePath(p: string): string {
  return p.replace(/\/\//g, '/').replace(/\/$/, '');
}

async function fetchChild(
  baseUrl: string,
  path: string,
  fileList: string[],
  vendorFiles: Record<string, string>,
): Promise<void> {
  let resPath = '';
  let index = 0;
  let found = false;

  if (
    ['.js', '.json'].some((ext) => _.endsWith(path, ext)) &&
    (index = fileList.indexOf(`/${path}`)) !== -1
  ) {
    resPath = `/${path}`;
    found = true;
  } else if (
    !RESOLVED_EXTENSIONS.some((ext) => {
      const potPath = `/${path}${ext}`;
      const i = fileList.indexOf(potPath);
      if (i !== -1) {
        resPath = potPath;
        index = i;
        return true;
      }
      return false;
    })
  ) {
    return;
  }

  if (!found && resPath === '') {
    return;
  }

  fileList.splice(index, 1);
  const url = `${baseUrl}${resPath}`;

  const result: FetchResult = (await fetchUrl(url, true)) as any;
  const text = result.text;
  vendorFiles[url.replace(JSDELIVR_URL, '')] = text;

  const segments = url.replace(baseUrl, '').split('/');
  const cwd = segments.slice(0, segments.length - 1).join('/');

  const results = parseImports(text).map((child) => {
    let childPath = normalizePath(`${cwd}${cwd === '' ? '' : '/'}${child}`);
    if (childPath.charAt(0) === '/') {
      childPath = childPath.substring(1);
    }
    return fetchChild(baseUrl, childPath, fileList, vendorFiles);
  });

  await Promise.all(results);
}

export async function fetchChildDependencies(
  baseUrl: string,
  path: string,
  fileList: string[],
  vendorFiles: Record<string, string>,
): Promise<void> {
  await fetchChild(baseUrl, path, fileList, vendorFiles);
}

export async function fetchChildDefinitions(
  baseUrl: string,
  path: string,
  fileList: string[],
  vendorFiles: Record<string, string>,
): Promise<void> {
  await fetchChild(baseUrl, path, fileList, vendorFiles);
}
