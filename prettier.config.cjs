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
    // 1. Node.js built-ins
    '^node:(.*)$',
    
    // 2. External dependencies
    '^@?\\w',
    '^java$',
    '^uuid$',
    '^n8n-workflow$',
    '^sql-formatter$',
    
    // 3. Internal imports - types first
    '^@/types/(.*)$',
    '^../types/(.*)$',
    '^./types/(.*)$',
    
    // 4. Internal imports - core functionality
    '^@/core/(.*)$',
    '^../core/(.*)$',
    '^./core/(.*)$',
    
    // 5. Internal imports - utils
    '^@/utils/(.*)$',
    '^../utils/(.*)$',
    '^./utils/(.*)$',
    
    // 6. Internal imports - credentials & nodes
    '^@/credentials/(.*)$',
    '^@/nodes/(.*)$',
    '^../credentials/(.*)$',
    '^../nodes/(.*)$',
    
    // 7. Relative imports (same directory)
    '^[./]',
  ],
  
  // Separar grupos de imports com linha em branco
  importOrderSeparation: true,
  
  // Ordenar especificadores dentro dos imports (ex: { a, b, c })
  importOrderSortSpecifiers: true,
  
  // Agrupar imports do mesmo módulo
  importOrderGroupNamespaceSpecifiers: true,
  
  // Manter imports não utilizados (para evitar quebrar a funcionalidade)
  importOrderKeepUnusedImports: false,
  
  // Tratar como módulos separados
  importOrderMergeDuplicateImports: true,
  
  // Combinar imports do tipo "type" e "value"
  importOrderCombineTypeAndValueImports: true,
};
