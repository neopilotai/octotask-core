import async from 'async';
import semver from 'semver';
import { Graph } from 'graphlib';
import NpmHttpRegistry from './registries/npm-http';

const packageJsonProps = [
  'main',
  'browser',
  'module',
  'types',
  'typings',
  'js:next',
  'unpkg',
];

export interface ResolverOptions {
  validatePeers?: boolean;
  registry?: NpmHttpRegistry;
  packageJsonProps?: string[];
  timeout?: number;
  concurrency?: number;
}

interface RegistryPackage {
  name: string;
  'dist-tags'?: Record<string, string>;
  versions: Record<string, any>;
}

export default class Resolver {
  validatePeers: boolean = true;
  registry: NpmHttpRegistry = new NpmHttpRegistry();
  packageJsonProps: string[] = packageJsonProps;
  timeout: number = 10000;
  concurrency: number = 4;
  graph: Graph;
  invalidPeers: Record<string, any>;
  missingPeers: Record<string, any>;
  requestedPeers: Record<string, any>;
  jpack: {
    appDependencies: Record<string, any>;
    resDependencies: Record<string, any>;
    warnings: any;
  };
  error: any;
  queue: any;
  startTime: number = 0;

  constructor(options: ResolverOptions = {}) {
    Object.assign(
      this,
      {
        validatePeers: true,
        registry: new NpmHttpRegistry(),
        packageJsonProps,
        timeout: 10000,
        concurrency: 4,
      },
      options,
    );

    this.graph = new Graph();
    this.invalidPeers = {};
    this.missingPeers = {};
    this.requestedPeers = {};
    this.jpack = { appDependencies: {}, resDependencies: {}, warnings: {} };
    this.error = null;
    this.queue = async.queue(
      (
        task: { name: string; version: string; parentNode: string },
        done: () => void,
      ) => {
        if (Date.now() - this.startTime > this.timeout || this.error) {
          if (!this.error) {
            this.error = { error: 'TIMEOUT' };
          }
          return done();
        }
        this.loadRegistryPackage(task, done);
      },
      this.concurrency,
    );
    this.queue.pause();
  }

  loadRegistryPackage(
    task: { name: string; version: string; parentNode: string },
    done: () => void,
  ): void {
    const name = task.name;
    this.registry.fetch(
      name,
      (err: boolean, registryPackage: RegistryPackage) => {
        if (err) {
          this.error = { error: 'PACKAGE_NOT_FOUND', data: { name } };
          return done();
        }
        this.resolveDependencies(task, registryPackage, done);
      },
    );
  }

  resolveDependencies(
    task: { name: string; version: string; parentNode: string },
    registryPackage: RegistryPackage,
    done: () => void,
  ): void {
    const version = this.resolveVersion(task.version, registryPackage);
    if (this.error || !version) {
      return done();
    }

    const fullName = `${registryPackage.name}@${version}`;
    const versionPackageJson = registryPackage.versions[version];
    const isRootDependency = task.parentNode === 'root';
    const subDepsResolved = this.graph.hasNode(fullName);

    if (isRootDependency) {
      this.graph.setNode(registryPackage.name, { version, fullName });
      this.graph.setNode(fullName);
      this.graph.setEdge(task.parentNode, registryPackage.name);
    } else {
      this.graph.setEdge(task.parentNode, fullName);
    }

    if (subDepsResolved) {
      return done();
    }

    const dependencies = Object.assign(
      {},
      versionPackageJson.dependencies,
      isRootDependency ? {} : versionPackageJson.peerDependencies,
    );

    if (
      isRootDependency &&
      versionPackageJson.hasOwnProperty('peerDependencies') &&
      Object.keys(versionPackageJson.peerDependencies).length > 0
    ) {
      this.requestedPeers[fullName] = Object.assign(
        {},
        versionPackageJson.peerDependencies,
      );
      Object.keys(versionPackageJson.peerDependencies).forEach(
        (peerName: string) => this.graph.setEdge(fullName, peerName),
      );
    }

    const depNames = Object.keys(dependencies);
    this.registry.batchFetch(depNames, () => {
      depNames.forEach((name: string) =>
        this.queue.push({
          name,
          version: dependencies[name],
          parentNode: fullName,
        }),
      );
      done();
    });
  }

  resolveVersion(
    requestedVersion: string,
    registryPackage: RegistryPackage,
  ): string | null {
    if (
      registryPackage['dist-tags'] &&
      registryPackage['dist-tags'].hasOwnProperty(requestedVersion)
    ) {
      return registryPackage['dist-tags'][requestedVersion];
    }

    const availableVersions = Object.keys(registryPackage.versions || {});
    let requested = requestedVersion;
    if (requestedVersion === '') {
      requested = '*';
    }

    let version = semver.maxSatisfying(availableVersions, requested, true);

    if (
      !version &&
      requested === '*' &&
      availableVersions.every((v: string) => {
        try {
          return !!semver.prerelease(v)?.length;
        } catch {
          return false;
        }
      })
    ) {
      version = registryPackage['dist-tags']?.latest || null;
    }

    if (!version) {
      this.error = {
        error: 'UNSATISFIED_RANGE',
        data: { name: registryPackage.name, range: requestedVersion },
      };
      return null;
    }
    return version;
  }

  validatePeerDependencies(): void {
    const topDeps = this.graph.successors('root') || [];

    Object.keys(this.requestedPeers).forEach((fullName: string) => {
      const peers = this.requestedPeers[fullName];
      Object.keys(peers).forEach((peerName: string) => {
        const requestedPeerVersion = peers[peerName];
        if (!topDeps.some((name: string) => name === peerName)) {
          if (!this.missingPeers[peerName]) {
            this.missingPeers[peerName] = {};
          }
          this.missingPeers[peerName][fullName] = requestedPeerVersion;
        } else if (
          !semver.satisfies(
            this.graph.node(peerName).version,
            requestedPeerVersion,
          )
        ) {
          if (!this.invalidPeers[fullName]) {
            this.invalidPeers[fullName] = {};
          }
          this.invalidPeers[fullName][peerName] = requestedPeerVersion;
        }
      });
    });

    if (Object.keys(this.missingPeers).length > 0) {
      this.error = { error: 'MISSING_PEERS', data: this.missingPeers };
    }
  }

  fillJpackDep(fullName: string, versionPkg: any, dep: any): void {
    (this.graph.successors(fullName) || []).forEach((name: string) => {
      if (name.substring(1).indexOf('@') === -1) {
        const peerDep = this.graph.node(name);
        if (peerDep) {
          dep.dependencies[name] = `${name}@${peerDep.version}`;
        }
      } else {
        dep.dependencies[name.substring(0, name.lastIndexOf('@'))] = name;
        this.addJpackResDep(name);
      }
    });

    if (versionPkg) {
      this.packageJsonProps.forEach((prop: string) => {
        if (versionPkg.hasOwnProperty(prop)) {
          dep[prop] = versionPkg[prop];
        }
      });
    }
  }

  addJpackResDep(fullName: string): void {
    if (!this.jpack.resDependencies.hasOwnProperty(fullName)) {
      const atIndex = fullName.lastIndexOf('@');
      if (atIndex <= 0) {
        this.fillJpackDep(fullName, null, this.jpack.appDependencies[fullName]);
      } else {
        const depName = fullName.substring(0, atIndex);
        const version = fullName.substring(atIndex + 1);
        const versionPkg = this.registry.cache[depName]?.versions[version];
        const resDep = (this.jpack.resDependencies[fullName] = {
          dependencies: {},
        });
        this.fillJpackDep(fullName, versionPkg, resDep);
      }
    }
  }

  renderJpack(): void {
    (this.graph.successors('root') || []).forEach((depName: string) => {
      const { version, fullName } = this.graph.node(depName);
      const versionPkg = this.registry.cache[depName]?.versions[version];
      const appDep = (this.jpack.appDependencies[depName] = {
        version,
        dependencies: {},
      });
      this.fillJpackDep(fullName, versionPkg, appDep);
    });

    if (Object.keys(this.invalidPeers).length > 0) {
      this.jpack.warnings.invalidPeers = this.invalidPeers;
    }
  }

  resolve(dependencies: Record<string, string>): Promise<any> {
    return new Promise(
      (resolve: (value: any) => void, reject: (reason: any) => void) => {
        const depNames = Object.keys(dependencies);
        if (depNames.length === 0) {
          return resolve(this.jpack);
        }

        depNames.forEach((name: string) =>
          this.queue.push({
            name,
            version: dependencies[name],
            parentNode: 'root',
          }),
        );

        this.queue.drain = () => {
          if (this.error) {
            return reject(this.error);
          }
          if (this.validatePeers) {
            this.validatePeerDependencies();
          }
          if (this.error) {
            return reject(this.error);
          }
          this.renderJpack();
          return resolve(this.jpack);
        };

        this.startTime = Date.now();
        this.registry.batchFetch(depNames, this.queue.resume);
      },
    );
  }
}
