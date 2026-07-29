import { defineConfig } from 'tsdown';

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
});
