import npa from 'npm-package-arg';
import request from 'superagent';
import async from 'async';

export const DEFAULT_REGISTRY_URL =
  process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';

export default class NpmHttpRegistry {
  registryUrl: string;
  cache: Record<string, any>;
  fetching: string[];

  constructor(options: { registryUrl?: string } = {}) {
    this.registryUrl = options.registryUrl || DEFAULT_REGISTRY_URL;
    this.cache = {};
    this.fetching = [];
  }

  fetch(name: string, cb: (err: boolean, result?: any) => void): void {
    const escapedName = name && npa(name).escapedName;

    if (this.cache[name]) {
      cb(false, this.cache[name]);
    } else {
      request
        .get(`${this.registryUrl}/${escapedName}`)
        .end((err: any, res: any) => {
          if (err || res.statusCode < 200 || res.statusCode >= 400) {
            const message = res
              ? `Status: ${res.statusCode}`
              : `Error: ${err.message}`;
            console.warn(`Could not load ${name}`);
            console.warn(message);
            return cb(true);
          }
          this.cache[name] = res.body;
          cb(false, this.cache[name]);
        });
    }
  }

  batchFetch(keys: string[], cb: () => void): void {
    const fetchKeys = keys.filter(
      (key) =>
        !this.cache.hasOwnProperty(key) && this.fetching.indexOf(key) === -1,
    );

    if (fetchKeys.length) {
      this.fetching = this.fetching.concat(fetchKeys);
      async.parallel(
        fetchKeys.map((key: string) => {
          const escapedName = key && npa(key).escapedName;
          return (done: () => void) =>
            request
              .get(`${this.registryUrl}/${escapedName}`)
              .end((err: any, res: any) => {
                if (err || res.statusCode < 200 || res.statusCode >= 400) {
                  return done();
                }
                this.cache[key] = res.body;
                done();
              });
        }),
        cb,
      );
    } else {
      cb();
    }
  }
}
