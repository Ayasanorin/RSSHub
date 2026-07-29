import { defineConfig } from 'tsdown';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);

// Bundling jsdom (necessary to fix @exodus/bytes ESM require() on Vercel's
// runtime) pulls in dependencies that resolve data/worker files via paths the
// bundler leaves as runtime requires with broken paths:
//   - jsdom reads default-stylesheet.css via fs.readFileSync(__dirname-relative)
//   - css-tree reads data/patch.json + mdn-data/css/*.json via require()
//   - jsdom require.resolve("./xhr-sync-worker.js") for sync XHR (never used at
//     runtime in RSSHub, but evaluated at module load)
// Inline/neutralize all three at build time.
const jsdomCssLiteral = JSON.stringify(
    readFileSync(require.resolve('jsdom/lib/jsdom/browser/default-stylesheet.css'), 'utf-8')
);

export default defineConfig({
    entry: ['./lib/server.ts'],
    // Wait for https://github.com/vercel/vercel/pull/14429
    // Then we can set outDir to outputDirectory in vercel.json
    outDir: 'src',
    minify: true,
    shims: true,
    clean: true,
    // copy: [{ from: 'lib/assets', to: 'dist' }],
    deps: {
        onlyBundle: false,
        // Vercel's Node.js runtime bridge does not support require() of ESM modules,
        // and nft (node-file-trace) misses some conditional-export variants of
        // externalized packages. Bundling these deps lets tsdown resolve them at
        // build time, avoiding both problems.
        //   - jsdom: CJS that requires ESM-only @exodus/bytes at runtime
        //   - lru-cache: ESM with conditional exports; nft skips the commonjs variant
        //     needed by path-scurry (via glob). Bundling RSSHub's reference lets nft
        //     cleanly trace the commonjs variant for the CJS consumer.
        alwaysBundle: ['jsdom', 'lru-cache'],
    },
    plugins: [
        {
            name: 'inline-bundled-data-files',
            enforce: 'pre',
            transform(code, id) {
                if (!/(jsdom|css-tree|@csstools|@exodus\/bytes|@asamuzakjp)/.test(id)) {
                    return null;
                }
                let result = code;
                // jsdom's default-stylesheet.css is read via fs.readFileSync at
                // module load; bundling breaks the __dirname-relative path.
                if (id.endsWith('computed-style.js')) {
                    result = result.replace(
                        /const defaultStyleSheet = fs\.readFileSync\([\s\S]*?\);/,
                        `const defaultStyleSheet = ${jsdomCssLiteral};`
                    );
                }
                // jsdom resolves a sync-XHR worker file at module load. The worker
                // is only spawned for synchronous XMLHttpRequest (never used in
                // RSSHub), so neutralize the resolve to avoid a runtime ENOENT.
                if (id.endsWith('XMLHttpRequest-impl.js')) {
                    result = result.replace(
                        /require\.resolve\(\s*(['"])\.\/xhr-sync-worker\.js\1\s*\)/g,
                        '"xhr-sync-worker.js"'
                    );
                }
                // Inline static require('...json') data files (e.g. css-tree's
                // data/patch.json and mdn-data/css/*.json) that the bundler would
                // otherwise leave as runtime requires with broken paths.
                result = result.replace(
                    /\brequire\(\s*(['"])([^'"]+\.json)\1\s*\)/g,
                    (_match, _quote, spec) => {
                        try {
                            const resolved = require.resolve(spec, { paths: [dirname(id)] });
                            return `JSON.parse(${JSON.stringify(readFileSync(resolved, 'utf-8'))})`;
                        } catch {
                            return _match;
                        }
                    }
                );
                return result === code ? null : result;
            },
        },
    ],
});
