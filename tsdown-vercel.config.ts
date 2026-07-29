import { defineConfig } from 'tsdown';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);

// jsdom reads its default-stylesheet.css via __dirname at runtime. Bundling
// jsdom (necessary to fix @exodus/bytes ESM require() on Vercel's runtime)
// breaks that path resolution, so inline the CSS at build time instead.
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
            name: 'inline-jsdom-default-stylesheet',
            transform(code, id) {
                if (!id.includes('jsdom') || !id.endsWith('computed-style.js')) {
                    return null;
                }
                const replaced = code.replace(
                    /const defaultStyleSheet = fs\.readFileSync\([\s\S]*?\);/,
                    `const defaultStyleSheet = ${jsdomCssLiteral};`
                );
                return replaced === code ? null : replaced;
            },
        },
    ],
});
