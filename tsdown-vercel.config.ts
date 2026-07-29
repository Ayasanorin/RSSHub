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
        // Vercel's Node.js runtime bridge does not support require() of ESM modules.
        // jsdom (CJS) internally requires @exodus/bytes (ESM-only), which fails on
        // Vercel at runtime. Bundling jsdom lets tsdown resolve its ESM deps at build time.
        alwaysBundle: ['jsdom'],
    },
});
