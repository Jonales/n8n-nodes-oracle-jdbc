const gulp = require('gulp');
const del = require('del');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;

// ==========================================
// CONFIGURAÇÕES E CONSTANTES
// ==========================================

const PATHS = {
	// Source paths
	src: {
		icons: 'icons/**/*',
		lib: 'lib/**/*',
		assets: 'assets/**/*',
		docs: 'docs/**/*',
		scripts: 'scripts/**/*.js',
		configs: ['*.json', '*.js', '*.md'],
		packageFiles: ['package.json', 'README.md', 'LICENSE.md', 'CHANGELOG.md'],
	},

	// Distribution paths
	dist: {
		base: 'dist',
		icons: 'dist/icons',
		lib: 'dist/lib',
		assets: 'dist/assets',
		docs: 'dist/docs',
		scripts: 'dist/scripts',
	},

	// Watch patterns
	watch: {
		typescript: [
			'nodes/**/*.ts',
			'credentials/**/*.ts',
			'core/**/*.ts',
			'types/**/*.ts',
			'utils/**/*.ts',
		],
		assets: ['icons/**/*', 'lib/**/*', 'assets/**/*'],
		configs: ['*.json', '*.js', '*.md', 'scripts/**/*.js'],
		docs: 'docs/**/*',
	},

	// Clean patterns
	clean: [
		'dist/**/*',
		'!dist',
		'tsconfig.tsbuildinfo',
		'coverage',
		'.nyc_output',
		'scripts/verification-test',
		'*.log',
	],
};

const CONFIG = {
	// Build configuration
	build: {
		parallel: true,
		sourceMaps: process.env.NODE_ENV !== 'production',
		minify: process.env.NODE_ENV === 'production',
	},

	// Oracle JDBC specific
	oracle: {
		requiredDrivers: ['ojdbc11.jar', 'ucp.jar'],
		optionalDrivers: ['orai18n.jar', 'osdt_cert.jar', 'osdt_core.jar'],
	},

	// Watch options
	watch: {
		ignoreInitial: false,
		ignored: ['node_modules/**', 'dist/**', 'coverage/**'],
	},
};

// ==========================================
// TAREFAS DE LIMPEZA
// ==========================================

// Limpeza básica do diretório dist
function cleanDist() {
	console.log('🧹 Cleaning dist directory...');
	return del(PATHS.clean);
}

// Limpeza completa (inclui cache e temporários)
function cleanAll() {
	console.log('🧹 Deep cleaning all generated files...');
	return del([
		...PATHS.clean,
		'node_modules/.cache',
		'.eslintcache',
		'**/*.log',
		'benchmark-results.json',
		'verification-report.json',
	]);
}

// Limpeza de arquivos de desenvolvimento
function cleanDev() {
	console.log('🧹 Cleaning development files...');
	return del([
		'scripts/verification-test',
		'*.log',
		'benchmark-results.json',
		'verification-report.json',
	]);
}

// ==========================================
// TAREFAS DE CÓPIA E ASSETS
// ==========================================

// Copia ícones (Oracle SVG, etc.)
function copyIcons() {
	console.log('📋 Copying icons...');
	return gulp.src(PATHS.src.icons, { base: '.' }).pipe(gulp.dest(PATHS.dist.base));
}

// Copia bibliotecas JDBC (com validação)
async function copyLibraries() {
	console.log('📦 Copying Oracle JDBC libraries...');

	// Verificar se os drivers obrigatórios existem
	const libDir = 'lib';
	try {
		const files = await fs.readdir(libDir);
		const missingDrivers = CONFIG.oracle.requiredDrivers.filter(driver => !files.includes(driver));

		if (missingDrivers.length > 0) {
			console.warn('⚠️  Missing required Oracle JDBC drivers:', missingDrivers.join(', '));
			console.warn('   Run: npm run download:jdbc');
		}

		const optionalMissing = CONFIG.oracle.optionalDrivers.filter(driver => !files.includes(driver));

		if (optionalMissing.length > 0) {
			console.log('ℹ️  Optional drivers not found:', optionalMissing.join(', '));
		}
	} catch (error) {
		console.warn('⚠️  lib directory not found, creating...');
		await fs.mkdir(libDir, { recursive: true });
	}

	return gulp.src(PATHS.src.lib, { base: '.' }).pipe(gulp.dest(PATHS.dist.base));
}

// Copia assets gerais
function copyAssets() {
	console.log('📄 Copying general assets...');
	return gulp.src(PATHS.src.assets, { base: '.' }).pipe(gulp.dest(PATHS.dist.base));
}

// Copia documentação
function copyDocs() {
	console.log('📚 Copying documentation...');
	return gulp.src(PATHS.src.docs, { base: '.' }).pipe(gulp.dest(PATHS.dist.base));
}

// Copia scripts JavaScript (setup, verificação, etc.)
function copyScripts() {
	console.log('🔧 Copying JavaScript scripts...');
	return gulp.src(PATHS.src.scripts, { base: '.' }).pipe(gulp.dest(PATHS.dist.base));
}

// Copia arquivos do package (README, LICENSE, etc.)
function copyPackageFiles() {
	console.log('📝 Copying package files...');
	return gulp.src(PATHS.src.packageFiles, { base: '.' }).pipe(gulp.dest(PATHS.dist.base));
}

// ==========================================
// TAREFAS DE VALIDAÇÃO
// ==========================================

// Valida setup do ambiente Oracle JDBC
async function validateOracleSetup() {
	console.log('🔍 Validating Oracle JDBC setup...');

	return new Promise((resolve, reject) => {
		const child = spawn('node', ['scripts/verify-setup.js'], {
			stdio: 'inherit',
			shell: true,
		});

		child.on('close', code => {
			if (code === 0) {
				console.log('✅ Oracle JDBC setup validation passed');
				resolve();
			} else {
				console.error('❌ Oracle JDBC setup validation failed');
				reject(new Error(`Validation failed with code ${code}`));
			}
		});

		child.on('error', error => {
			console.error('❌ Failed to run setup validation:', error.message);
			reject(error);
		});
	});
}

// Valida drivers JDBC
async function validateJdbcDrivers() {
	console.log('🔍 Validating JDBC drivers...');

	const libPath = path.join(process.cwd(), 'lib');

	try {
		const files = await fs.readdir(libPath);
		const requiredDrivers = CONFIG.oracle.requiredDrivers;
		const foundDrivers = files.filter(file => file.endsWith('.jar'));

		console.log(`Found ${foundDrivers.length} JAR files:`, foundDrivers);

		const missing = requiredDrivers.filter(driver => !foundDrivers.includes(driver));

		if (missing.length > 0) {
			throw new Error(`Missing required drivers: ${missing.join(', ')}`);
		}

		console.log('✅ All required JDBC drivers found');
	} catch (error) {
		console.error('❌ JDBC driver validation failed:', error.message);
		throw error;
	}
}

// ==========================================
// TAREFAS DE BUILD E COMPILAÇÃO
// ==========================================

// Compila TypeScript
function compileTypeScript() {
	console.log('🔧 Compiling TypeScript...');

	return new Promise((resolve, reject) => {
		const child = spawn('npx', ['tsc', '-p', 'tsconfig.json'], {
			stdio: 'inherit',
			shell: true,
		});

		child.on('close', code => {
			if (code === 0) {
				console.log('✅ TypeScript compilation completed');
				resolve();
			} else {
				console.error('❌ TypeScript compilation failed');
				reject(new Error(`TypeScript compilation failed with code ${code}`));
			}
		});
	});
}

// ==========================================
// TAREFAS COMPOSTAS
// ==========================================

// Copia todos os assets
const copyAllAssets = gulp.parallel(
	copyIcons,
	copyLibraries,
	copyAssets,
	copyDocs,
	copyScripts,
	copyPackageFiles,
);

// Build completo com validação
const buildComplete = gulp.series(cleanDist, copyAllAssets, compileTypeScript, validateJdbcDrivers);

// Build para produção
const buildProduction = gulp.series(
	cleanAll,
	copyAllAssets,
	compileTypeScript,
	validateOracleSetup,
);

// Build para desenvolvimento
const buildDevelopment = gulp.series(cleanDist, copyAllAssets, compileTypeScript);

// ==========================================
// TAREFAS DE WATCH E DESENVOLVIMENTO
// ==========================================

// Watch para arquivos TypeScript
function watchTypeScript() {
	console.log('👀 Watching TypeScript files...');
	return gulp.watch(PATHS.watch.typescript, { ignoreInitial: false }, compileTypeScript);
}

// Watch para assets
function watchAssets() {
	console.log('👀 Watching asset files...');
	return gulp.watch(PATHS.watch.assets, { ignoreInitial: false }, copyAllAssets);
}

// Watch para configurações
function watchConfigs() {
	console.log('👀 Watching configuration files...');
	return gulp.watch(PATHS.watch.configs, { ignoreInitial: false }, copyPackageFiles);
}

// Watch completo para desenvolvimento
function watchAll() {
	console.log('👀 Starting development watch mode...');

	// Watch TypeScript files
	gulp.watch(PATHS.watch.typescript, { ignoreInitial: false }, gulp.series(compileTypeScript));

	// Watch assets
	gulp.watch(PATHS.watch.assets, { ignoreInitial: false }, copyAllAssets);

	// Watch configs
	gulp.watch(PATHS.watch.configs, { ignoreInitial: false }, copyPackageFiles);

	console.log('✅ All watchers active. Press Ctrl+C to stop.');
}

// ==========================================
// TAREFAS DE QUALIDADE E TESTES
// ==========================================

// Executa linting
function runLint() {
	console.log('🔍 Running ESLint...');

	return new Promise((resolve, reject) => {
		const child = spawn('npx', ['eslint', '.', '--ext', '.ts,.js', '--cache'], {
			stdio: 'inherit',
			shell: true,
		});

		child.on('close', code => {
			if (code === 0) {
				console.log('✅ Linting completed successfully');
				resolve();
			} else {
				console.warn('⚠️ Linting completed with warnings');
				resolve(); // Don't fail the build for linting warnings
			}
		});
	});
}

// Executa testes
function runTests() {
	console.log('🧪 Running tests...');

	return new Promise((resolve, reject) => {
		const child = spawn('npm', ['test'], {
			stdio: 'inherit',
			shell: true,
		});

		child.on('close', code => {
			if (code === 0) {
				console.log('✅ Tests completed successfully');
				resolve();
			} else {
				console.error('❌ Tests failed');
				reject(new Error(`Tests failed with code ${code}`));
			}
		});
	});
}

// ==========================================
// TAREFAS UTILITÁRIAS
// ==========================================

// Mostra informações do projeto
async function showInfo() {
	console.log('\n📊 Oracle JDBC Advanced N8N - Project Information');
	console.log('==================================================');

	try {
		const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
		console.log(`Name: ${packageJson.name}`);
		console.log(`Version: ${packageJson.version}`);
		console.log(`Description: ${packageJson.description}`);
		console.log(`Author: ${packageJson.author}`);

		// Check lib directory
		try {
			const libFiles = await fs.readdir('lib');
			const jarFiles = libFiles.filter(f => f.endsWith('.jar'));
			console.log(`\n📦 JDBC Drivers found: ${jarFiles.length}`);
			jarFiles.forEach(jar => console.log(`   - ${jar}`));
		} catch {
			console.log('\n⚠️ lib directory not found');
		}

		// Check dist directory
		try {
			const distStats = await fs.stat('dist');
			console.log(`\n🏗️ Build output: ${distStats.isDirectory() ? 'Ready' : 'Missing'}`);
		} catch {
			console.log('\n🏗️ Build output: Not built');
		}
	} catch (error) {
		console.error('Error reading project info:', error.message);
	}
}

// ==========================================
// EXPORTS
// ==========================================

// Tarefas principais
exports.build = buildComplete;
exports['build:complete'] = buildComplete;
exports['build:prod'] = buildProduction;
exports['build:dev'] = buildDevelopment;

// Tarefas de assets
exports['build:assets'] = copyAllAssets;
exports['copy:icons'] = copyIcons;
exports['copy:lib'] = copyLibraries;
exports['copy:assets'] = copyAssets;
exports['copy:docs'] = copyDocs;
exports['copy:scripts'] = copyScripts;
exports['copy:package'] = copyPackageFiles;

// Tarefas de limpeza
exports['clean'] = cleanDist;
exports['clean:all'] = cleanAll;
exports['clean:dev'] = cleanDev;
exports['cleanup:dist'] = cleanDist;

// Tarefas de compilação
exports['compile:ts'] = compileTypeScript;
exports['compile'] = compileTypeScript;

// Tarefas de validação
exports['validate:oracle'] = validateOracleSetup;
exports['validate:drivers'] = validateJdbcDrivers;
exports['validate'] = gulp.series(validateJdbcDrivers, validateOracleSetup);

// Tarefas de watch
exports.watch = watchAll;
exports['watch:ts'] = watchTypeScript;
exports['watch:assets'] = watchAssets;
exports['watch:config'] = watchConfigs;

// Tarefas de qualidade
exports.lint = runLint;
exports.test = runTests;
exports['quality'] = gulp.series(runLint, runTests);

// Tarefas utilitárias
exports.info = showInfo;

// Task padrão
exports.default = buildComplete;

// ==========================================
// CONFIGURAÇÃO DE ERRO E LOG
// ==========================================

// Handle uncaught errors
process.on('uncaughtException', error => {
	console.error('❌ Uncaught Exception:', error.message);
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
	process.exit(1);
});

// Log task completion
function logTaskCompletion(taskName) {
	return function (done) {
		console.log(`✅ ${taskName} completed successfully`);
		done();
	};
}

console.log('🚀 Oracle JDBC Advanced N8N - Gulp tasks loaded');
console.log('   Available tasks: build, build:prod, build:dev, watch, validate, clean, info');
