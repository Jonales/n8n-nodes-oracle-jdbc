const gulp = require('gulp');
const del = require('del');

// Copia arquivos estáticos
function copyAssets() {
  return gulp.src([
    'icons/**/*',
    'lib/**/*'
  ], { base: '.' })
    .pipe(gulp.dest('dist'));
}

// Limpa diretório dist
function cleanDist() {
  return del(['dist/**', '!dist']);
}

// Build completo
const buildComplete = gulp.series(copyAssets);

// Watch para desenvolvimento
function watchFiles() {
  gulp.watch(['icons/**/*', 'lib/**/*'], copyAssets);
}

// Exports
exports.build = buildComplete;
exports['build:complete'] = buildComplete;
exports['build:assets'] = copyAssets;
exports['cleanup:dist'] = cleanDist;
exports.watch = watchFiles;
exports.default = buildComplete;
