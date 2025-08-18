// eslint.config.js
const { defineFlatConfig } = require('eslint-define-config');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const stylisticPlugin = require('@stylistic/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const prettierPlugin = require('eslint-plugin-prettier');
const n8nPlugin = require('eslint-plugin-n8n-nodes-base');
const globals = require('globals');

module.exports = defineFlatConfig([
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: ['./tsconfig.json'],
				tsconfigRootDir: __dirname,
				sourceType: 'module',
			},
			globals: {
				...globals.node,
				...globals.es2023,
				java: 'readonly',
				Buffer: 'readonly',
				process: 'readonly',
				console: 'readonly',
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
			// Type safety
			'@typescript-eslint/no-unsafe-assignment': ['error', { ignoreRestArgs: true }],
			'@typescript-eslint/no-unsafe-call': 'error',
			'@typescript-eslint/no-unsafe-member-access': 'warn',
			'@typescript-eslint/no-unsafe-return': 'error',
			'@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }],

			// Naming
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'property',
					format: null,
					filter: {
						regex: '^(oracle\\.|javax\\.|java\\.)',
						match: true,
					},
				},
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

			// Prettier
			'prettier/prettier': [
				'error',
				{
					singleQuote: true,
					trailingComma: 'es5',
					semi: true,
					printWidth: 100,
					endOfLine: 'lf',
					arrowParens: 'avoid',
					tabWidth: 2,
					bracketSpacing: true,
				},
			],

			// Style
			'@stylistic/comma-dangle': ['error', 'always-multiline'],
			'@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
			'@stylistic/semi': ['error', 'always'],

			// Import
			'import/order': [
				'error',
				{
					groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
					'newlines-between': 'always',
					alphabetize: {
						order: 'asc',
						caseInsensitive: true,
					},
				},
			],
			'import/no-default-export': 'error',
			'import/no-duplicates': 'error',

			// Node/Credentials rules
			'n8n-nodes-base/node-class-description-inputs-wrong-regular-count': 'error',
			'n8n-nodes-base/node-class-description-outputs-wrong-regular-count': 'error',
			'n8n-nodes-base/node-param-description-lowercase-first-char': 'warn',
			'n8n-nodes-base/node-param-display-name-lowercase-first-char': 'warn',
			'n8n-nodes-base/node-param-description-missing-final-period': 'warn',
			'n8n-nodes-base/node-param-display-name-miscased': 'warn',
		},
	},

	// ✅ Test files
	{
		files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: ['./tsconfig.json'],
			},
			globals: {
				...globals.jest,
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
			},
		},
		rules: {
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'import/no-default-export': 'off',
		},
	},

	// ✅ JS config files
	{
		files: ['*.config.js', '*.cjs', '*.mjs'],
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
			'import/no-default-export': 'off',
			'no-console': 'off',
		},
	},
]);
