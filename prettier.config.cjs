/**
 * Prettier 3.x – configuração oficial do projeto
 * Alinhado ao ESLint 9 (e regra prettier/prettier: error)
 */
module.exports = {
  $schema: 'https://json.schemastore.org/prettierrc',

  // Estilo geral
  printWidth: 100,
  tabWidth: 2,
  useTabs: true,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'avoid',
  endOfLine: 'lf',

  // Plugin - Prettier 3.x requer array de strings
  plugins: ['@trivago/prettier-plugin-sort-imports'],

  // Configurações do plugin de ordenação de imports
  importOrder: [
    // 1. Imports de node modules (terceiros)
    '^@?\\w',
    '^n8n-workflow',
    '^java$',
    '^uuid$',
    
    // 2. Imports relativos a Oracle/JDBC
    '^./types/(.*)$',
    '^../types/(.*)$',
    '^./core/(.*)$', 
    '^../core/(.*)$',
    '^./utils/(.*)$',
    '^../utils/(.*)$',
    
    // 3. Imports relativos locais (mesmo diretório)
    '^[./]',
  ],
  
  // Separar grupos de imports com linha em branco
  importOrderSeparation: true,
  
  // Ordenar especificadores dentro dos imports (ex: { a, b, c })
  importOrderSortSpecifiers: true,
  
  // Agrupar imports do mesmo módulo
  importOrderGroupNamespaceSpecifiers: true,
  
  // Preservar diretivas como 'use strict'
  importOrderKeepUnusedImports: false,
};