// scripts/benchmark-lint.js
const { execSync } = require('child_process');

console.log('🧹 Cleaning cache...');
execSync('rimraf .cache/eslint', { stdio: 'inherit' });

console.log('🐌 First run (no cache):');
const start1 = Date.now();
execSync('npm run lint', { stdio: 'inherit' });
const time1 = Date.now() - start1;

console.log('⚡ Second run (with cache):');
const start2 = Date.now();
execSync('npm run lint', { stdio: 'inherit' });
const time2 = Date.now() - start2;

console.log(`📊 Performance improvement: ${Math.round((1 - time2 / time1) * 100)}%`);
