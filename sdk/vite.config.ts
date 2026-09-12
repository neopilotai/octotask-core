import ReplacePlugin from '@rollup/plugin-replace';
import bodyParser from 'body-parser';
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';
import type { Plugin, UserConfig, ViteDevServer } from 'vite';
import { defineConfig } from 'vite';
import TSConfigPaths from 'vite-tsconfig-paths';

// ----------------------------
// Root Vite Config
// ----------------------------
export default defineConfig(({ mode }) => {
  if (!['lib', 'dev', 'test', 'e2e'].includes(mode)) {
    throw new Error(`Expected --mode with value 'lib', 'dev', 'test' or 'e2e'`);
  }

  return mode === 'lib' ? libConfig() : testConfig(mode);
});

// ----------------------------
// Library Build Config
// ----------------------------
function libConfig(): UserConfig {
  return {
    plugins: [replaceOrigin()],
    build: {
      target: 'es2020',
      outDir: 'bundles',
      emptyOutDir: true,
      sourcemap: true,
      minify: 'esbuild',
      lib: {
        name: 'OctoTaskSDK',
        entry: 'src/index.ts',
        formats: ['cjs', 'es', 'umd'],
        fileName: (format) => {
          let suffix = '';
          if (format === 'es') {
            suffix = '.m';
          }
          if (format === 'umd') {
            suffix = '.umd';
          }
          return `sdk${suffix}.js`;
        },
      },
    },
    esbuild: {
      minifyIdentifiers: false,
      minifySyntax: false,
      minifyWhitespace: false,
    },
  };
}

// ----------------------------
// Test / Dev / E2E Config
// ----------------------------
function testConfig(mode: string): UserConfig {
  const isE2E = mode === 'e2e';
  const defaultOrigin = isE2E ? '/_embed/' : undefined;

  return {
    plugins: [
      replaceOrigin(process.env.OCTOTASK_SERVER_ORIGIN ?? defaultOrigin),
      { name: 'custom-server-config', configureServer },
      TSConfigPaths({
        loose: true,
        projects: [`${__dirname}/tsconfig.test.json`],
      }),
    ],
    build: {
      target: 'es2020',
      outDir: 'temp/build',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          sdk: 'src/index.ts',
          embed: 'test/embed/index.html',
          examples: 'examples/index.html',
          'example-github-project': 'examples/open-embed-github-project/index.html',
          'example-project-id': 'examples/open-embed-project-id/index.html',
        },
      },
    },
    server: {
      port: isE2E ? 4001 : 4000,
      hmr: !isE2E,
    },
    test: {
      dir: 'test',
      globals: false,
      include: ['**/unit/**/*.spec.ts'],
      exclude: ['**/node_modules/**'],
      coverage: {
        provider: 'c8',
        include: ['**/src/**/*.ts', '**/test/server/**/*.ts'],
        exclude: ['**/node_modules/**'],
        reportsDirectory: 'temp/coverage',
      },
    },
  };
}

// ----------------------------
// Replace Origin Plugin
// ----------------------------
function replaceOrigin(origin?: string): Plugin {
  return ReplacePlugin({
    preventAssignment: true,
    values: {
      __OCTOTASK_SERVER_ORIGIN__: JSON.stringify(origin),
    },
  });
}

// ----------------------------
// Custom Vite Dev Server Middleware
// ----------------------------
function configureServer(server: ViteDevServer) {
  //
  // Parse URL-encoded POST bodies
  //
  server.middlewares.use(bodyParser.urlencoded({ extended: true }));

  //
  // Handle /_embed/* requests
  //
  server.middlewares.use('/_embed', async (req, res, next) => {
    try {
      const pathname = new URL(req.url ?? '', 'http://localhost').pathname;
      const ext = path.parse(pathname).ext;

      if (ext === '' || ext === '.html') {
        const content = await fs.readFile(`${__dirname}/test/embed/index.html`);
        const html = content.toString().replace('{{PROJECT_DATA}}', getProjectDataString(req));

        res.statusCode = 200;
        res.end(html);
        return;
      }
    } catch (err) {
      console.error('Error handling /_embed request:', err);
    }

    next();
  });

  //
  // Handle /examples requests including corp=1 cross-origin headers
  //
  server.middlewares.use('/examples', (req, res, next) => {
    try {
      const url = new URL(req.originalUrl, `http://${req.headers.host}`);
      const corp = url.searchParams.get('corp');

      if (corp === '1') {
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      }
    } catch (err) {
      console.error('Middleware parse error:', err);
    }

    next();
  });
}

// ----------------------------
// Helpers
// ----------------------------
function getProjectDataString(req: any): string {
  if (req.method === 'POST' && req.body?.project) {
    const project = { ...req.body.project };

    if (typeof project.settings === 'string') {
      project.settings = JSON.parse(project.settings);
    }

    return JSON.stringify(project, null, 2);
  }

  return 'null';
}
