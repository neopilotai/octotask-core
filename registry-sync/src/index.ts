import follower from 'concurrent-couch-follower';
import Redis from 'ioredis';
import request from 'request-promise';
import npa from 'npm-package-arg';

const REDIS_URL = process.env.REDIS_URL;
const REGISTRY_URL = 'https://registry.npmjs.org';
const COUCH_URL = 'https://replicate.npmjs.com/_changes';

const redis = new Redis(REDIS_URL);

const SEQ_KEY = 'seq';
const PKG_KEY_PREFIX = 'p/';
const STALE_SET_KEY = 'srq';
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const REGISTRY_RETRY_DELAY = parseInt(process.env.REGISTRY_RETRY_DELAY || '5000', 10);
const REGISTRY_TIMEOUT_MINUTES = parseInt(process.env.REGISTRY_TIMEOUT_MINUTES || '10', 10);
const STALE_RETRY_INTERVAL_MINUTES = parseInt(process.env.STALE_RETRY_INTERVAL_MINUTES || '6', 10);
const CAUGHT_UP_DELAY_MS = parseInt(process.env.CAUGHT_UP_DELAY_MS || '7500', 10);
const STALE_PACKAGE_HOURS = parseInt(process.env.STALE_PACKAGE_HOURS || '1', 10);

function getLastSeq(): Promise<string> { return redis.get(SEQ_KEY); }
function setLastSeq(seq: string): Promise<any> { return redis.set(SEQ_KEY, seq); }
function getPackage(name: string): Promise<any> { return redis.get(PKG_KEY_PREFIX + name).then(pkg => JSON.parse(pkg)); }
function setPackage(name: string, value: any): Promise<any> { return redis.set(PKG_KEY_PREFIX + name, JSON.stringify(value)); }
function deletePackage(name: string): Promise<any> { return redis.del(PKG_KEY_PREFIX + name); }
function enqueueStaleRetry(name: string): Promise<any> { return redis.sadd(STALE_SET_KEY, name); }
function dequeueStaleRetry(name: string): Promise<any> { return redis.srem(STALE_SET_KEY, name); }

function getRegPackage(name: string): Promise<any> {
  const escapedName = npa(name).escapedName;
  return request.get({ url: `${REGISTRY_URL}/${escapedName}`, json: true }).catch((error: any) => {
    if (error && error.statusCode === 503) {
      console.warn(`503 Registry response fetching ${name}, retrying in 5s`);
      return new Promise((resolve, reject) => setTimeout(() => resolve(getRegPackage(name)), REGISTRY_RETRY_DELAY));
    }
    throw error;
  });
}

async function retryStalePackages(): Promise<void> {
  const pkgs = await redis.smembers(STALE_SET_KEY);
  console.info('Refetching potentially stale packages', pkgs);

  await Promise.all((pkgs as string[]).map((pkgName: string) => {
    return getRegPackage(pkgName).then((pkg: any) => {
      console.info('ADDING:', pkgName);
      return setPackage(pkgName, slimPackage(pkg)).then(() => dequeueStaleRetry(pkgName)).catch((error: any) => {
        if (error && error.statusCode !== 404) {
          console.warn('ERROR fetching stale package:', pkgName, error.message, error.stack);
        } else {
          return dequeueStaleRetry(pkgName);
        }
      });
    });
  }));
}

function getLastRegSeq(): Promise<number> {
  return request.get({ url: `${COUCH_URL}?descending=true&limit=1`, json: true }).then((r: any) => r.last_seq);
}

const packageKeys = ['_rev', 'name', 'dist-tags', 'versions'];
const versionKeys = ['name', 'version', 'main', 'browser', 'unpkg', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'module', 'jsnext:main', 'types', 'typings'];

function slimPackage(pkg: any): any {
  const newPkg: any = {};
  packageKeys.forEach((key) => { if (pkg.hasOwnProperty(key)) { newPkg[key] = pkg[key]; } });

  if (pkg.hasOwnProperty('versions')) {
    newPkg.versions = {};
    Object.keys(pkg.versions).forEach((version) => {
      newPkg.versions[version] = {};
      versionKeys.forEach((key) => {
        if (pkg.versions[version].hasOwnProperty(key)) { newPkg.versions[version][key] = pkg.versions[version][key]; }
      });
    });
  }
  return newPkg;
}

let lastTouch = new Date();
function touchTimeout(): void { lastTouch = new Date(); }
function checkTimeout(): void {
  if (new Date().getTime() - lastTouch.getTime() > REGISTRY_TIMEOUT_MINUTES * MINUTE_MS) {
    console.warn(`Haven't received data from registry in ${REGISTRY_TIMEOUT_MINUTES} minutes, exiting`);
    process.exit(1);
  }
}

setInterval(checkTimeout, MINUTE_MS);

Promise.all([getLastSeq(), getLastRegSeq()]).then(([since, bootRegSeq]) => {
  const startSeq = Number(since) || 0;
  const bootSeq = Number(bootRegSeq) || 0;
  console.info('RESUMING SINCE', startSeq);

  setInterval(retryStalePackages, STALE_RETRY_INTERVAL_MINUTES * MINUTE_MS);

  follower(function (change: any, done: () => void) {
    touchTimeout();
    if (!change) { console.warn('WARNING: invalid change'); return done(); }
    if (!change.id) { console.info('SKIP:', change); return done(); }

    const caughtUp = change.seq > bootSeq;
    const promise = !caughtUp ? Promise.resolve() : new Promise((resolve: any, reject: any) => setTimeout(resolve, CAUGHT_UP_DELAY_MS));

    promise.then(() => getRegPackage(change.id).then((pkg: any) => {
      console.info('ADDING:', change.id);
      if (caughtUp) {
        const pkgMod = new Date(pkg.time.modified);
        if (new Date().getTime() - pkgMod.getTime() > STALE_PACKAGE_HOURS * HOUR_MS) {
          console.warn(`WARNING: Registry data for ${change.id} may be stale, will retry later.`);
          enqueueStaleRetry(change.id);
        }
      }
      return setPackage(change.id, slimPackage(pkg));
    }).catch((error: any) => {
      if (error && error.statusCode !== 404) {
        console.warn('ERROR:', change, error.message, error.stack);
        console.warn(`Queueing ${change.id} for retry.`);
        return enqueueStaleRetry(change.id);
      }
    }).finally(() => done()) as any, {
      db: COUCH_URL,
      include_docs: false,
      since,
      sequence: (seq: string, done: () => void) => setLastSeq(seq).then(done),
      concurrency: 8,
    } as any);
  });
});
