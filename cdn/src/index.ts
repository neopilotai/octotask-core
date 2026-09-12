import { Router } from 'express';
import semver from 'semver';
import stringify from 'json-stable-stringify';
import {
  fetchChildDefinitions,
  fetchChildDependencies,
  fetchDirList,
  fetchPackageJson,
  JSDELIVR_URL,
} from './fetchers';
import packageURL from './packageURLMiddleware';

function normalizePath(p: string): string {
  return p.replace(/\/\//g, '/').replace(/\/$/, '');
}

const router = Router();
router.use(packageURL as any);

function turboHandler(req: any, res: any, next: () => void): void {
  const packageVersion = req.packageVersion || 'latest';
  if (packageVersion === 'latest' || !semver.valid(packageVersion)) {
    return res.status(400).send({ error: 'Must specify exact version' });
  }

  const { packageSlug } = req;
  const vendorFiles: Record<string, string> = {};

  const pkgJsonPromise = fetchPackageJson(packageSlug).then((pkg: any) => pkg);

  Promise.all([fetchDirList(packageSlug), pkgJsonPromise])
    .then(([fileList, packageJson]) => {
      const entryPoint = (packageJson as Record<string, any>).main || 'index.js';
      const typesEntry = (packageJson as Record<string, any>).types || (packageJson as Record<string, any>).typings || 'index.d.ts';

      return Promise.all([
        fetchChildDependencies(`${JSDELIVR_URL}/${packageSlug}`, normalizePath(entryPoint), fileList.concat(), vendorFiles),
        fetchChildDefinitions(`${JSDELIVR_URL}/${packageSlug}`, normalizePath(typesEntry), fileList.concat(), vendorFiles),
      ]).then(() => {
        res.setHeader('Cache-Control', 'public, max-age=31557600, immutable');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.send(stringify({ vendorFiles, dirCache: { [packageSlug]: fileList } }));
      });
    })
    .catch((error: any) => {
      console.error(error);
      res.sendStatus(400);
    });
}

router.get('/:package@:version', turboHandler);
router.get('/@:scoped/:package@:version', turboHandler);

export default router;
