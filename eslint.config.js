// eslint.config.js - Configuração Enterprise Oracle JDBC Advanced N8N
const globals = require('globals');
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const stylisticPlugin = require('@stylistic/eslint-plugin-js');
const importPlugin = require('eslint-plugin-import');
const n8nPlugin = require('eslint-plugin-n8n-nodes-base');
const prettierPlugin = require('eslint-plugin-prettier');

// ==========================================
// 🗃️ CACHE & PERFORMANCE CONFIGURATION
// ==========================================

const CACHE_CONFIG = {
	// Cache location optimized for CI/CD
	cacheLocation: '.cache/eslint/',

	// Cache strategy: metadata (dev) vs content (CI)
	cacheStrategy: process.env.CI ? 'content' : 'metadata',

	// Performance settings
	allowInlineConfig: true,
	reportUnusedDisableDirectives: 'error',

	// Memory optimization
	maxWarnings: 50,
	errorOnUnmatchedPattern: false,
};

// ==========================================
// 📁 PROJECT STRUCTURE PATHS
// ==========================================

const PROJECT_PATHS = {
	// Core TypeScript files
	typescript: [
		'nodes/**/*.ts',
		'credentials/**/*.ts',
		'core/**/*.ts',
		'types/**/*.ts',
		'utils/**/*.ts',
	],

	// Test files
	tests: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts'],

	// Configuration files
	configs: [
		'*.config.js',
		'*.config.cjs',
		'*.config.mjs',
		'gulpfile.js',
		'jest.config.js',
		'.eslintrc.cjs',
	],

	// N8N specific files
	nodes: ['nodes/**/*.node.ts'],
	credentials: ['credentials/**/*.credentials.ts'],

	// Definition files
	definitions: ['**/*.d.ts'],

	// Scripts
	scripts: ['scripts/**/*.js', 'scripts/**/*.ts'],
};

const IGNORE_PATTERNS = [
	// Build outputs
	'dist/**',
	'build/**',
	'lib/**',

	// Dependencies
	'node_modules/**',

	// Coverage and test outputs
	'coverage/**',
	'.nyc_output/**',

	// Cache directories
	'.cache/**',
	'.eslintcache',

	// TypeScript build info
	'**/*.tsbuildinfo',
	'tsconfig.tsbuildinfo',

	// Logs and temporary files
	'**/*.log',
	'scripts/verification-test/**',
	'benchmark-results/**',
	'verification-report.json',

	// Generated files
	'**/*.min.js',
	'**/*.bundle.js',

	// IDE and OS files
	'.vscode/**',
	'.idea/**',
	'**/.DS_Store',
];

// ==========================================
// 🎯 ORACLE JDBC SPECIFIC RULES
// ==========================================

const ORACLE_JDBC_RULES = {
	// Java bridge specific allowances
	'no-undef': 'off', // java global is provided by node-java bridge
	'@typescript-eslint/no-explicit-any': [
		'error',
		{
			ignoreRestArgs: true,
			fixToUnknown: false,
		},
	],

	// Oracle property naming conventions
	'@typescript-eslint/naming-convention': [
		'error',
		// Oracle JDBC properties (keep original format)
		{
			selector: 'property',
			format: null,
			filter: {
				regex: '^(oracle\\.|javax\\.|java\\.)',
				match: true,
			},
		},
		// Standard TypeScript naming
		{
			selector: 'typeLike',
			format: ['PascalCase'],
		},
		{
			selector: 'interface',
			format: ['PascalCase'],
			custom: {
				regex: '^I[A-Z]',
				match: false,
			},
		},
	],
};

// ==========================================
// 🏗️ MAIN CONFIGURATION
// ==========================================

module.exports = [
	// Global ignores
	{
		ignores: IGNORE_PATTERNS,
	},

	// JavaScript base configuration
	js.configs.recommended,

	// ==========================================
	// 📝 TYPESCRIPT CORE CONFIGURATION
	// ==========================================
	{
		files: PROJECT_PATHS.typescript,
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 'latest',
			sourceType: 'module',
			parserOptions: {
				project: ['./tsconfig.json'],
				tsconfigRootDir: __dirname,
				extraFileExtensions: ['.json'],
				warnOnUnsupportedTypeScriptVersion: false,
			},
			globals: {
				...globals.node,
				...globals.es2023,
				// Java bridge globals for Oracle JDBC
				java: 'readonly',
				Buffer: 'readonly',
				console: 'readonly',
				process: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
			},
		},

		plugins: {
			'@typescript-eslint': tsPlugin,
			'@stylistic': stylisticPlugin,
			import: importPlugin,
			prettier: prettierPlugin,
			'n8n-nodes-base': n8nPlugin,
		},

		rules: {
			// ==========================================
			// 💅 PRETTIER INTEGRATION
			// ==========================================
			'prettier/prettier': [
				'error',
				{
					singleQuote: true,
					trailingComma: 'es5',
					tabWidth: 2,
					semi: true,
					printWidth: 100,
					endOfLine: 'lf',
					arrowParens: 'avoid',
					bracketSpacing: true,
				},
			],

			// ==========================================
			// ⚡ PERFORMANCE OPTIMIZATIONS
			// ==========================================
			'@typescript-eslint/prefer-readonly': 'warn',
			'@typescript-eslint/prefer-readonly-parameter-types': 'off', // Too strict for JDBC

			// ==========================================
			// 🔒 TYPE SAFETY - ORACLE JDBC OPTIMIZED
			// ==========================================
			...ORACLE_JDBC_RULES,

			'@typescript-eslint/no-unsafe-assignment': [
				'error',
				{
					ignoreRestArgs: true,
				},
			],
			'@typescript-eslint/no-unsafe-call': 'error',
			'@typescript-eslint/no-unsafe-member-access': 'warn', // Relaxed for Java objects
			'@typescript-eslint/no-unsafe-return': 'error',

			// Code Quality
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					caughtErrors: 'none',
				},
			],
			'@typescript-eslint/no-inferrable-types': 'error',
			'@typescript-eslint/prefer-nullish-coalescing': 'error',
			'@typescript-eslint/prefer-optional-chain': 'error',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'@typescript-eslint/no-unnecessary-condition': 'warn',

			// Function and Method Rules
			'@typescript-eslint/explicit-function-return-type': [
				'warn',
				{
					allowExpressions: true,
					allowTypedFunctionExpressions: true,
					allowHigherOrderFunctions: true,
					allowDirectConstAssertionInArrowFunctions: true,
				},
			],
			'@typescript-eslint/explicit-member-accessibility': [
				'error',
				{
					accessibility: 'explicit',
					overrides: {
						constructors: 'off',
					},
				},
			],

			// Type Definitions
			'@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					prefer: 'type-imports',
					disallowTypeAnnotations: false,
					fixStyle: 'separate-type-imports',
				},
			],
			'@typescript-eslint/consistent-type-exports': 'error',

			// Array and Object Rules
			'@typescript-eslint/array-type': [
				'error',
				{
					default: 'array',
				},
			],
			'@typescript-eslint/consistent-type-assertions': [
				'error',
				{
					assertionStyle: 'as',
					objectLiteralTypeAssertions: 'never',
				},
			],

			// ==========================================
			// 📦 IMPORT/EXPORT RULES - N8N OPTIMIZED
			// ==========================================
			'import/order': [
				'error',
				{
					groups: [
						'builtin',
						'external',
						'internal',
						['parent', 'sibling', 'index'],
						'object',
						'type',
					],
					'newlines-between': 'always',
					alphabetize: {
						order: 'asc',
						caseInsensitive: true,
					},
					pathGroups: [
						{
							pattern: 'n8n-workflow',
							group: 'external',
							position: 'before',
						},
						{
							pattern: './core/**',
							group: 'internal',
							position: 'before',
						},
						{
							pattern: './types/**',
							group: 'internal',
							position: 'before',
						},
					],
					pathGroupsExcludedImportTypes: ['type'],
				},
			],
			'import/no-duplicates': [
				'error',
				{
					considerQueryString: true,
					'prefer-inline': false,
				},
			],
			'import/no-unresolved': [
				'error',
				{
					ignore: ['^java$'], // Ignore java bridge imports
				},
			],
			'import/no-default-export': 'error',
			'import/consistent-type-specifier-style': ['error', 'prefer-inline'],

			// ==========================================
			// 🏆 CODE QUALITY RULES
			// ==========================================
			'prefer-const': [
				'error',
				{
					destructuring: 'all',
					ignoreReadBeforeAssign: false,
				},
			],
			'no-var': 'error',
			'object-shorthand': [
				'error',
				'always',
				{
					avoidQuotes: true,
					ignoreConstructors: false,
					avoidExplicitReturnArrows: true,
				},
			],
			'prefer-arrow-callback': [
				'error',
				{
					allowNamedFunctions: false,
					allowUnboundThis: true,
				},
			],
			'arrow-body-style': [
				'error',
				'as-needed',
				{
					requireReturnForObjectLiteral: false,
				},
			],
			curly: ['error', 'multi-line', 'consistent'],
			eqeqeq: ['error', 'smart'],
			'guard-for-in': 'error',
			'no-caller': 'error',
			'no-debugger': 'error',
			'no-new-wrappers': 'error',
			'no-throw-literal': 'error',
			radix: ['error', 'as-needed'],
			'use-isnan': 'error',
			'no-console': 'off', // Allowed for Oracle JDBC logging
			'no-empty': [
				'error',
				{
					allowEmptyCatch: true,
				},
			],

			// ==========================================
			// 🎯 N8N SPECIFIC RULES
			// ==========================================
			'n8n-nodes-base/node-class-description-inputs-wrong-regular-count': 'error',
			'n8n-nodes-base/node-class-description-outputs-wrong-regular-count': 'error',
			'n8n-nodes-base/node-param-description-lowercase-first-char': 'warn',
			'n8n-nodes-base/node-param-display-name-lowercase-first-char': 'warn',
			'n8n-nodes-base/node-param-description-missing-final-period': 'warn',
			'n8n-nodes-base/node-param-display-name-miscased': 'warn',

			// ==========================================
			// 🎨 STYLISTIC RULES (PERFORMANCE OPTIMIZED)
			// ==========================================
			'@stylistic/comma-dangle': ['error', 'always-multiline'],
			'@stylistic/quotes': [
				'error',
				'single',
				{
					avoidEscape: true,
					allowTemplateLiterals: true,
				},
			],
			'@stylistic/semi': ['error', 'always'],
		},

		settings: {
			'import/resolver': {
				typescript: {
					alwaysTryTypes: true,
					project: ['./tsconfig.json'],
					cache: true,
				},
				node: {
					extensions: ['.ts', '.js', '.json'],
				},
			},
			'import/cache': {
				lifetime: '∞',
			},
		},
	},

	// ==========================================
	// 🧪 TEST FILES CONFIGURATION
	// ==========================================
	{
		files: PROJECT_PATHS.tests,
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: ['./tsconfig.json'],
			},
			globals: {
				...globals.node,
				...globals.jest,
				...globals.es2023,
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				beforeAll: 'readonly',
				afterAll: 'readonly',
			},
		},

		plugins: {
			'@typescript-eslint': tsPlugin,
			import: importPlugin,
		},

		rules: {
			// Relaxed rules for tests
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-any': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'import/no-default-export': 'off',
			'prefer-const': 'warn',
			'no-console': 'off',
		},
	},

	// ==========================================
	// 🚀 N8N NODES CONFIGURATION
	// ==========================================
	{
		files: PROJECT_PATHS.nodes,
		rules: {
			'import/no-default-export': 'off', // N8N nodes require default export
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-member-accessibility': 'off',
			'n8n-nodes-base/node-param-description-lowercase-first-char': 'error',
			'n8n-nodes-base/node-param-display-name-lowercase-first-char': 'error',
		},
	},

	// ==========================================
	// 🔐 N8N CREDENTIALS CONFIGURATION
	// ==========================================
	{
		files: PROJECT_PATHS.credentials,
		rules: {
			'import/no-default-export': 'off', // N8N credentials require default export
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-member-accessibility': 'off',
		},
	},

	// ==========================================
	// ⚙️ CONFIGURATION FILES
	// ==========================================
	{
		files: PROJECT_PATHS.configs,
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'script',
			globals: {
				...globals.node,
				module: 'writable',
				require: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
			},
		},

		rules: {
			'@typescript-eslint/no-var-requires': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'import/no-default-export': 'off',
			'no-console': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
		},
	},

	// ==========================================
	// 📜 SCRIPTS CONFIGURATION
	// ==========================================
	{
		files: PROJECT_PATHS.scripts,
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'script',
			globals: {
				...globals.node,
				console: 'readonly',
				process: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
			},
		},

		rules: {
			'no-console': 'off',
			'@typescript-eslint/no-var-requires': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'import/no-default-export': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'prefer-const': 'warn',
		},
	},

	// ==========================================
	// 📋 DEFINITION FILES
	// ==========================================
	{
		files: PROJECT_PATHS.definitions,
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/ban-types': 'off',
			'@typescript-eslint/no-empty-interface': 'off',
			'@typescript-eslint/consistent-type-definitions': 'off',
			'import/no-default-export': 'off',
		},
	},

	// ==========================================
	// 📄 JAVASCRIPT FILES
	// ==========================================
	{
		files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.node,
				...globals.es2023,
			},
		},

		rules: {
			'no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],
			'no-undef': 'error',
			'no-console': 'off',
			'prefer-const': 'error',
			'no-var': 'error',
			'object-shorthand': 'error',
			'prefer-arrow-callback': 'warn',
		},
	},
];

// ==========================================
// 📊 EXPORT CACHE CONFIGURATION FOR CLI
// ==========================================
module.exports.meta = {
	name: 'n8n-nodes-oracle-jdbc-eslint-config',
	version: '1.0.0',
	cache: CACHE_CONFIG,
};
