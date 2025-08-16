export class SqlParser {
  static splitStatements(sql: string): string[] {
    return sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
  }

  static isSelectStatement(sql: string): boolean {
    return sql.trim().toLowerCase().startsWith('select');
  }

  static isDDLStatement(sql: string): boolean {
    const ddlKeywords = ['create', 'alter', 'drop', 'truncate'];
    const firstWord = sql.trim().toLowerCase().split(' ')[0];
    return ddlKeywords.includes(firstWord);
  }

  static extractTableName(sql: string): string | null {
    const match = sql.match(/(?:from|into|update|table)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    return match ? match[1] : null;
  }
}
