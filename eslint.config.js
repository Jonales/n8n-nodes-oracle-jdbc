// eslint.config.js - Configuração Unificada Enterprise Oracle JDBC Advanced N8N
const globals = require('globals');
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const n8nPlugin = require('eslint-plugin-n8n-nodes-base');
const prettierPlugin = require('eslint-plugin-prettier');

// ==========================================
// CONFIGURAÇÕES GLOBAIS
// ==========================================

const PROJECT_PATHS = {
  // Core TypeScript files
  typescript: [
    'nodes/**/*.ts',
    'credentials/**/*.ts',
    'core/**/*.ts',
    'types/**/*.ts',
    'utils/**/*.ts'
  ],
  
  // Test files
  tests: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/__tests__/**/*.ts'
  ],
  
  // Configuration files
  configs: [
    '*.config.js',
    '*.config.cjs',
    'gulpfile.js',
    'jest.config.js',
    '.eslintrc.cjs'
  ],
  
  // N8N specific files
  nodes: ['nodes/**/*.node.ts'],
  credentials: ['credentials/**/*.credentials.ts'],
  
  // Definition files
  definitions: ['**/*.d.ts'],
  
  // Scripts
  scripts: ['scripts/**/*.js', 'scripts/**/*.ts']
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
  
  // TypeScript build info
  '**/*.tsbuildinfo',
  
  // Logs and temporary files
  '**/*.log',
  'scripts/verification-test/**',
  'benchmark-results.json',
  'verification-report.json',
  
  // Generated files
  '**/*.min.js',
  '**/*.bundle.js',
  
  // IDE and OS files
  '.vscode/**',
  '.idea/**',
  '**/.DS_Store'
];

// ==========================================
// CONFIGURAÇÃO PRINCIPAL
// ==========================================

module.exports = [
  // Ignores globais
  {
    ignores: IGNORE_PATTERNS
  },

  // ==========================================
  // CONFIGURAÇÃO PARA ARQUIVOS TYPESCRIPT CORE
  // ==========================================
  {
    files: PROJECT_PATHS.typescript,
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        extraFileExtensions: ['.json']
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
        // Java bridge globals for Oracle JDBC
        java: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly'
      }
    },
    
    plugins: {
      '@typescript-eslint': tsPlugin,
      'import': importPlugin,
      'prettier': prettierPlugin,
      'n8n-nodes-base': n8nPlugin
    },
    
    rules: {
      // ==========================================
      // PRETTIER INTEGRATION
      // ==========================================
      'prettier/prettier': ['error', {
        singleQuote: true,
        trailingComma: 'es5',
        tabWidth: 2,
        semi: true,
        printWidth: 100,
        endOfLine: 'lf'
      }],

      // ==========================================
      // TYPESCRIPT RULES - ENTERPRISE GRADE
      // ==========================================
      
      // Type Safety - Critical for Oracle JDBC
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      
      // Code Quality
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      
      // Function and Method Rules
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true
      }],
      '@typescript-eslint/explicit-member-accessibility': ['error', {
        accessibility: 'explicit',
        overrides: {
          constructors: 'off'
        }
      }],
      
      // Naming Conventions - Oracle JDBC Specific
      '@typescript-eslint/naming-convention': [
        'error',
        // Types
        {
          selector: 'typeLike',
          format: ['PascalCase']
        },
        // Interfaces (Oracle configs, connection types)
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z]',
            match: false
          }
        },
        // Classes (ConnectionPool, TransactionManager)
        {
          selector: 'class',
          format: ['PascalCase']
        },
        // Enums (Oracle specific types)
        {
          selector: 'enum',
          format: ['PascalCase']
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE']
        },
        // Methods and properties
        {
          selector: 'method',
          format: ['camelCase']
        },
        {
          selector: 'property',
          format: ['camelCase', 'PascalCase'],
          filter: {
            regex: '^(oracle\\.|javax\\.|java\\.)',
            match: false
          }
        },
        // Constants
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE']
        }
      ],
      
      // Type Definitions
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        disallowTypeAnnotations: false
      }],
      '@typescript-eslint/consistent-type-exports': 'error',
      
      // Array and Object Rules
      '@typescript-eslint/array-type': ['error', {
        default: 'array'
      }],
      '@typescript-eslint/consistent-type-assertions': ['error', {
        assertionStyle: 'as'
      }],

      // ==========================================
      // IMPORT/EXPORT RULES - N8N STRUCTURE
      // ==========================================
      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling', 'index'],
          'object',
          'type'
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }],
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'error',
      'import/no-default-export': 'error',
      
      // ==========================================
      // GENERAL CODE QUALITY RULES
      // ==========================================
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-arrow-callback': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'curly': ['error', 'multi-line'],
      'eqeqeq': ['error', 'smart'],
      'guard-for-in': 'error',
      'no-caller': 'error',
      'no-debugger': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
      'radix': 'error',
      'use-isnan': 'error',
      
      // Console - allowed for Oracle JDBC debugging
      'no-console': 'off',

      // ==========================================
      // N8N SPECIFIC RULES
      // ==========================================
      'n8n-nodes-base/node-class-description-inputs-wrong-regular-count': 'error',
      'n8n-nodes-base/node-class-description-outputs-wrong-regular-count': 'error',
      'n8n-nodes-base/node-param-description-lowercase-first-char': 'warn',
      'n8n-nodes-base/node-param-display-name-lowercase-first-char': 'warn',
      'n8n-nodes-base/node-param-description-missing-final-period': 'warn',
      'n8n-nodes-base/node-param-display-name-miscased': 'warn'
    },
    
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json'
        },
        node: {
          extensions: ['.ts', '.js', '.json']
        }
      }
    }
  },

  // ==========================================
  // CONFIGURAÇÃO PARA ARQUIVOS DE TESTE
  // ==========================================
  {
    files: PROJECT_PATHS.tests,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json'
      },
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.es2022
      }
    },
    
    plugins: {
      '@typescript-eslint': tsPlugin,
      'import': importPlugin
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
      'import/no-default-export': 'off',
      'n8n-nodes-base/node-param-description-lowercase-first-char': 'off',
      'n8n-nodes-base/node-param-display-name-lowercase-first-char': 'off'
    }
  },

  // ==========================================
  // CONFIGURAÇÃO PARA NODES N8N
  // ==========================================
  {
    files: PROJECT_PATHS.nodes,
    rules: {
      'import/no-default-export': 'off', // N8N nodes require default export
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },

  // ==========================================
  // CONFIGURAÇÃO PARA CREDENTIALS N8N
  // ==========================================
  {
    files: PROJECT_PATHS.credentials,
    rules: {
      'import/no-default-export': 'off', // N8N credentials require default export
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },

  // ==========================================
  // CONFIGURAÇÃO PARA ARQUIVOS DE CONFIGURAÇÃO
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
        __filename: 'readonly'
      }
    },
    
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-default-export': 'off',
      'no-console': 'off'
    }
  },

  // ==========================================
  // CONFIGURAÇÃO PARA SCRIPTS
  // ==========================================
  {
    files: PROJECT_PATHS.scripts,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.node,
        console: 'readonly',
        process: 'readonly'
      }
    },
    
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'import/no-default-export': 'off'
    }
  },

  // ==========================================
  // CONFIGURAÇÃO PARA ARQUIVOS DE DEFINIÇÃO
  // ==========================================
  {
    files: PROJECT_PATHS.definitions,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      'import/no-default-export': 'off'
    }
  },

  // ==========================================
  // CONFIGURAÇÃO PARA ARQUIVOS JAVASCRIPT
  // ==========================================
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-undef': 'warn',
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
];
