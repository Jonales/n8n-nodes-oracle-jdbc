export interface ParsedStatement {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL' | 'PLSQL' | 'UNKNOWN';
  original: string;
  cleaned: string;
  parameters: string[]; // Positional or named placeholders
  tables: string[];
  isPLSQL: boolean;
  isTransactional: boolean;
}

/**
 * Utilitário robusto para análise, divisão, classificação e extração de metadados SQL/PLSQL.
 */
export class SqlParser {
  /** Divide scripts SQL levando em conta delimitadores, ignore comentários e PL/SQL blocks. */
  static splitStatements(sql: string, delimiter = ';'): string[] {
    const statements: string[] = [];
    let buffer = '';
    let inString = false;
    let inPlsqlBlock = false;
    let stringChar = '';
    let lastChar = '';
    let parenLevel = 0;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];

      // Detect begin/end para PL/SQL (simples)
      if (char === "'" || char === '"') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && lastChar !== '\\') {
          inString = false;
        }
      }

      // Comentários linha -- ... ou bloco /* ... */
      if (!inString && char === '-' && sql[i+1] === '-') {
        // skip to next newline
        while (i < sql.length && sql[i] !== '\n') i++;
        continue;
      }
      if (!inString && char === '/' && sql[i+1] === '*') {
        // skip to */
        i += 2;
        while (i < sql.length && !(sql[i] === '*' && sql[i+1] === '/')) i++;
        i++;
        continue;
      }

      // Detecta começo PL/SQL (simplificado)
      if (!inString && buffer.trim().toLowerCase().startsWith('begin')) {
        inPlsqlBlock = true;
        parenLevel = 0;
      }
      if (inPlsqlBlock) {
        if (char === '(') parenLevel++;
        if (char === ')') parenLevel--;
      }

      // Trata o delimitador (pode ser custom e ignora dentro de strings/PLSQL)
      if (!inString && !inPlsqlBlock && char === delimiter) {
        if (buffer.trim().length > 0) {
          statements.push(buffer.trim());
          buffer = '';
        }
      } else {
        buffer += char;
      }

      // Detecta final de bloco PL/SQL por "end;" ou "/"
      if (inPlsqlBlock && buffer.trim().toLowerCase().endsWith('end;')) {
        statements.push(buffer.trim());
        buffer = '';
        inPlsqlBlock = false;
      }

      lastChar = char;
    }
    if (buffer.trim().length > 0) {
      statements.push(buffer.trim());
    }
    return statements.filter(stmt => stmt.length > 0);
  }

  /** Detecta se é SELECT (robusto, ignora comentários e espaços) */
  static isSelectStatement(sql: string): boolean {
    const cleaned = this.cleanSql(sql);
    return cleaned.toLowerCase().startsWith('select');
  }

  /** Detecta se é DDL: CREATE, ALTER, DROP, TRUNCATE (ignora comentários) */
  static isDDLStatement(sql: string): boolean {
    const cleaned = this.cleanSql(sql);
    const ddlKeywords = ['create', 'alter', 'drop', 'truncate', 'rename'];
    const firstWord = cleaned.toLowerCase().split(/\s+/)[0];
    return ddlKeywords.includes(firstWord);
  }

  /** Identifica se é bloco/sentença PL/SQL */
  static isPLSQLBlock(sql: string): boolean {
    const cleaned = this.cleanSql(sql);
    return /^begin\b|^declare\b|^exception\b|^end\b|procedure\b|function\b/.test(cleaned.toLowerCase());
  }

  /** Limpa o SQL removendo comentários e espaços extras */
  static cleanSql(sql: string): string {
    // Remove comentários linha e bloco
    let cleaned = sql.replace(/--.*?[\r\n]/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
    // Normaliza espaços
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  }

  /** Extrai nome(s) de tabela de forma robusta (FROM, INTO, UPDATE etc) */
  static extractTableNames(sql: string): string[] {
    const cleaned = this.cleanSql(sql);
    const names: string[] = [];
    // FROM table, INTO table, UPDATE table, DELETE FROM table, etc.
    const tableRegex = /\b(?:from|into|update|table|join)\s+([a-zA-Z_][a-zA-Z0-9_$.]*)/gi;
    let match;
    while ((match = tableRegex.exec(cleaned)) !== null) {
      names.push(match[1]);
    }
    return [...new Set(names.filter(Boolean))];
  }

  /** Extrai todos placeholders (? ou :named) do SQL */
  static extractPlaceholders(sql: string): string[] {
    const cleaned = this.cleanSql(sql);
    const positional = [...cleaned.matchAll(/\?/g)].map((_, idx) => '?'+(idx+1));
    const named = [...cleaned.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(m => ':'+m[1]);
    return positional.concat(named);
  }

  /** Classifica a sentença SQL */
  static getStatementType(sql: string): ParsedStatement['type'] {
    const cleaned = this.cleanSql(sql).toLowerCase();
    if (cleaned.startsWith('select')) return 'SELECT';
    if (cleaned.startsWith('insert')) return 'INSERT';
    if (cleaned.startsWith('update')) return 'UPDATE';
    if (cleaned.startsWith('delete')) return 'DELETE';
    if (this.isDDLStatement(sql)) return 'DDL';
    if (this.isPLSQLBlock(sql)) return 'PLSQL';
    return 'UNKNOWN';
  }

  /** Faz parsing completo, retornando metadados relevantes do SQL */
  static parseStatement(sql: string): ParsedStatement {
    const cleaned = this.cleanSql(sql);
    const type = this.getStatementType(sql);
    const parameters = this.extractPlaceholders(sql);
    const tables = this.extractTableNames(sql);
    const isPLSQL = this.isPLSQLBlock(sql);
    const isTransactional = ['UPDATE', 'INSERT', 'DELETE', 'PLSQL'].includes(type);

    return {
      type,
      original: sql,
      cleaned,
      parameters,
      tables,
      isPLSQL,
      isTransactional
    };
  }
}
