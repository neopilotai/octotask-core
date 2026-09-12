import validateNPMPackageName from 'validate-npm-package-name';
import * as url from 'url';

const URLFormat = /^\/((?:@[^\/@]+\/)?[^\/@]+)(?:@([^\/]+))?(\/.*)?$/;

export interface PackageURLRequest {
  url: string;
  pathname: string;
  search: string;
  query: Record<string, string>;
  packageName: string;
  packageVersion: string;
  packageSlug: string;
  filename?: string;
}

export default function packageURL(req: PackageURLRequest, res: any, next: () => void): void {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '';
  const search = parsed.search || '';
  const query: Record<string, string> = Object.fromEntries(
    Object.entries(parsed.query as Record<string, string | string[]>).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );

  const match = URLFormat.exec(pathname);

  if (match === null) {
    return res.status(400).type('text').send(`Invalid URL: ${req.url}`);
  }

  const packageName = match[1];
  const packageVersion = tryDecode(match[2]) || 'latest';
  const filename = tryDecode(match[3]);
  const errors = validateNPMPackageName(packageName).errors;

  if (errors) {
    return res.status(400).type('text').send(`Invalid package name: ${packageName} (${errors.join(', ')})`);
  }

  req.packageName = packageName;
  req.packageVersion = packageVersion;
  req.packageSlug = `${packageName}@${packageVersion}`;
  req.pathname = pathname;
  req.filename = filename;
  req.search = search;
  req.query = query;

  next();
}

function tryDecode(param: string | null): string {
  if (param) {
    try {
      return decodeURIComponent(param);
    } catch (_error) {
      // ignore decode errors
    }
  }
  return '';
}
