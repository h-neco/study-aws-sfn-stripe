const esbuild = require('esbuild');
const { zip } = require('zip-a-folder');

(async () => {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    minify: false,
    platform: 'node',
    target: 'es2021',
    outfile: 'dist/index.js',
  });

  await zip('dist', '../../../terraform/lambda/payment_invoke.zip');
})();
