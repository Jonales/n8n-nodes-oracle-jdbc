export class ResultMapper {
  static mapOracleTypes(value: any, columnType: string): any {
    if (value === null) return null;

    switch (columnType.toUpperCase()) {
      case 'NUMBER':
        return typeof value === 'number' ? value : parseFloat(String(value));
      case 'VARCHAR2':
      case 'CHAR':
        return String(value);
      case 'DATE':
      case 'TIMESTAMP':
        return value instanceof Date ? value : new Date(value);
      default:
        return value;
    }
  }

  static transformResultSet(rows: any[], transformations: { [column: string]: (value: any) => any }): any[] {
    return rows.map(row => {
      const transformedRow: any = {};
      for (const [key, value] of Object.entries(row)) {
        transformedRow[key] = transformations[key] ? transformations[key](value) : value;
      }
      return transformedRow;
    });
  }
}
