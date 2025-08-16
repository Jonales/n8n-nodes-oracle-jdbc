import { OracleDataTypes, OracleTypeMapping, OracleTypeUtils } from '../types/OracleTypes';
import { ColumnMetadata, QueryResult } from '../types/JdbcTypes';

export interface ResultMappingOptions {
  convertTypes?: boolean;
  trimStrings?: boolean;
  formatDates?: 'iso' | 'local' | 'epoch' | 'custom';
  customDateFormat?: string;
  formatNumbers?: boolean;
  decimalPlaces?: number;
  handleNulls?: 'null' | 'empty' | 'default';
  convertClobToString?: boolean;
  convertBlobToBase64?: boolean;
  maxClobSize?: number;
  maxBlobSize?: number;
  timezone?: string;
  booleanTrueValues?: string[];
  booleanFalseValues?: string[];
  arrayHandling?: 'json' | 'string' | 'array';
  objectHandling?: 'json' | 'string' | 'flatten';
  caseSensitive?: boolean;
  columnNameCase?: 'upper' | 'lower' | 'camel' | 'snake' | 'original';
}

export interface ColumnTransformation {
  columnName: string;
  transformer: (value: any, row: any, metadata?: ColumnMetadata) => any;
  condition?: (value: any, row: any) => boolean;
}

export interface ResultTransformationPipeline {
  name: string;
  transformations: ColumnTransformation[];
  rowFilter?: (row: any, index: number) => boolean;
  rowTransformer?: (row: any, index: number) => any;
  postProcessor?: (results: any[]) => any[];
}

export interface MappingResult {
  data: any[];
  metadata: {
    totalRows: number;
    transformedColumns: string[];
    skippedRows: number;
    errors: MappingError[];
    performance: {
      mappingTime: number;
      transformationTime: number;
      totalTime: number;
    };
  };
}

export interface MappingError {
  row: number;
  column: string;
  error: string;
  originalValue: any;
  fallbackValue: any;
}

export class ResultMapper {
  private static readonly DEFAULT_OPTIONS: ResultMappingOptions = {
    convertTypes: true,
    trimStrings: true,
    formatDates: 'iso',
    formatNumbers: true,
    decimalPlaces: 2,
    handleNulls: 'null',
    convertClobToString: true,
    convertBlobToBase64: false,
    maxClobSize: 1048576, // 1MB
    maxBlobSize: 10485760, // 10MB
    timezone: 'UTC',
    booleanTrueValues: ['1', 'Y', 'YES', 'TRUE', 'T'],
    booleanFalseValues: ['0', 'N', 'NO', 'FALSE', 'F'],
    arrayHandling: 'json',
    objectHandling: 'json',
    caseSensitive: false,
    columnNameCase: 'original'
  };

  static mapOracleTypes(
    value: any, 
    columnType: string, 
    options: ResultMappingOptions = {}
  ): any {
    if (value === null || value === undefined) {
      return this.handleNull(options.handleNulls || 'null', columnType);
    }

    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const normalizedType = columnType.toUpperCase();

    try {
      switch (normalizedType) {
        case 'VARCHAR2':
        case 'NVARCHAR2':
        case 'CHAR':
        case 'NCHAR':
          return this.mapStringType(value, opts);

        case 'NUMBER':
        case 'NUMERIC':
        case 'DECIMAL':
        case 'FLOAT':
        case 'BINARY_FLOAT':
        case 'BINARY_DOUBLE':
          return this.mapNumberType(value, opts);

        case 'INTEGER':
        case 'INT':
        case 'SMALLINT':
          return this.mapIntegerType(value, opts);

        case 'DATE':
          return this.mapDateType(value, opts);

        case 'TIMESTAMP':
        case 'TIMESTAMP WITH TIME ZONE':
        case 'TIMESTAMP WITH LOCAL TIME ZONE':
          return this.mapTimestampType(value, opts);

        case 'CLOB':
        case 'NCLOB':
          return this.mapClobType(value, opts);

        case 'BLOB':
          return this.mapBlobType(value, opts);

        case 'RAW':
        case 'LONG RAW':
          return this.mapRawType(value, opts);

        case 'ROWID':
        case 'UROWID':
          return this.mapRowIdType(value, opts);

        case 'XMLTYPE':
          return this.mapXmlType(value, opts);

        case 'JSON':
          return this.mapJsonType(value, opts);

        case 'BOOLEAN':
          return this.mapBooleanType(value, opts);

        case 'INTERVAL YEAR TO MONTH':
        case 'INTERVAL DAY TO SECOND':
          return this.mapIntervalType(value, opts);

        default:
          return this.mapGenericType(value, normalizedType, opts);
      }
    } catch (error) {
      console.warn(`Error mapping Oracle type ${columnType}:`, error);
      return this.handleMappingError(value, columnType, error, opts);
    }
  }

  static transformResultSet(
    rows: any[], 
    transformations: { [column: string]: (value: any) => any },
    options: ResultMappingOptions = {}
  ): any[] {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    return rows.map((row, index) => {
      const transformedRow: any = {};
      
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = this.normalizeColumnName(key, opts);
        const transformedValue = transformations[key] ? 
                               transformations[key](value) : value;
        transformedRow[normalizedKey] = transformedValue;
      }
      
      return transformedRow;
    });
  }

  static transformWithPipeline(
    queryResult: QueryResult,
    pipeline: ResultTransformationPipeline,
    options: ResultMappingOptions = {}
  ): MappingResult {
    const startTime = Date.now();
    const mappingStartTime = Date.now();
    
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: MappingError[] = [];
    const transformedColumns: string[] = [];
    let skippedRows = 0;

    // Initial mapping phase
    let mappedData = queryResult.rows.map(row => {
      const mappedRow: any = {};
      
      for (const [columnName, value] of Object.entries(row)) {
        const normalizedName = this.normalizeColumnName(columnName, opts);
        const columnMeta = queryResult.metadata?.columns?.find(
          col => col.name.toUpperCase() === columnName.toUpperCase()
        );
        
        try {
          mappedRow[normalizedName] = this.mapOracleTypes(
            value, 
            columnMeta?.type || 'VARCHAR2', 
            opts
          );
        } catch (error) {
          errors.push({
            row: -1, // Will be set later
            column: columnName,
            error: error.message,
            originalValue: value,
            fallbackValue: value
          });
          mappedRow[normalizedName] = value;
        }
      }
      
      return mappedRow;
    });

    const mappingTime = Date.now() - mappingStartTime;
    const transformationStartTime = Date.now();

    // Apply transformations
    mappedData = mappedData.map((row, rowIndex) => {
      try {
        // Apply column transformations
        for (const transformation of pipeline.transformations) {
          const { columnName, transformer, condition } = transformation;
          const normalizedColumnName = this.normalizeColumnName(columnName, opts);
          
          if (row.hasOwnProperty(normalizedColumnName)) {
            const originalValue = row[normalizedColumnName];
            
            if (!condition || condition(originalValue, row)) {
              try {
                const columnMeta = queryResult.metadata?.columns?.find(
                  col => this.normalizeColumnName(col.name, opts) === normalizedColumnName
                );
                
                row[normalizedColumnName] = transformer(originalValue, row, columnMeta);
                
                if (!transformedColumns.includes(normalizedColumnName)) {
                  transformedColumns.push(normalizedColumnName);
                }
              } catch (error) {
                errors.push({
                  row: rowIndex,
                  column: columnName,
                  error: error.message,
                  originalValue,
                  fallbackValue: originalValue
                });
              }
            }
          }
        }

        // Apply row transformer
        if (pipeline.rowTransformer) {
          row = pipeline.rowTransformer(row, rowIndex) || row;
        }

        return row;
      } catch (error) {
        errors.push({
          row: rowIndex,
          column: '*',
          error: `Row transformation failed: ${error.message}`,
          originalValue: row,
          fallbackValue: row
        });
        return row;
      }
    });

    // Apply row filter
    if (pipeline.rowFilter) {
      const originalLength = mappedData.length;
      mappedData = mappedData.filter(pipeline.rowFilter);
      skippedRows = originalLength - mappedData.length;
    }

    // Apply post processor
    if (pipeline.postProcessor) {
      try {
        mappedData = pipeline.postProcessor(mappedData) || mappedData;
      } catch (error) {
        errors.push({
          row: -1,
          column: '*',
          error: `Post processing failed: ${error.message}`,
          originalValue: mappedData,
          fallbackValue: mappedData
        });
      }
    }

    const transformationTime = Date.now() - transformationStartTime;
    const totalTime = Date.now() - startTime;

    return {
      data: mappedData,
      metadata: {
        totalRows: mappedData.length,
        transformedColumns,
        skippedRows,
        errors,
        performance: {
          mappingTime,
          transformationTime,
          totalTime
        }
      }
    };
  }

  // Specialized mapping methods
  private static mapStringType(value: any, options: ResultMappingOptions): string {
    let result = String(value);
    
    if (options.trimStrings) {
      result = result.trim();
    }
    
    return result;
  }

  private static mapNumberType(value: any, options: ResultMappingOptions): number {
    if (typeof value === 'number') {
      return options.formatNumbers && options.decimalPlaces !== undefined ? 
             Number(value.toFixed(options.decimalPlaces)) : value;
    }
    
    const numValue = parseFloat(String(value));
    if (isNaN(numValue)) {
      throw new Error(`Cannot convert "${value}" to number`);
    }
    
    return options.formatNumbers && options.decimalPlaces !== undefined ? 
           Number(numValue.toFixed(options.decimalPlaces)) : numValue;
  }

  private static mapIntegerType(value: any, options: ResultMappingOptions): number {
    if (typeof value === 'number') {
      return Math.round(value);
    }
    
    const intValue = parseInt(String(value), 10);
    if (isNaN(intValue)) {
      throw new Error(`Cannot convert "${value}" to integer`);
    }
    
    return intValue;
  }

  private static mapDateType(value: any, options: ResultMappingOptions): any {
    const date = value instanceof Date ? value : new Date(value);
    
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date value: ${value}`);
    }
    
    switch (options.formatDates) {
      case 'iso':
        return date.toISOString();
      case 'local':
        return date.toLocaleString();
      case 'epoch':
        return date.getTime();
      case 'custom':
        return this.formatCustomDate(date, options.customDateFormat || 'YYYY-MM-DD');
      default:
        return date;
    }
  }

  private static mapTimestampType(value: any, options: ResultMappingOptions): any {
    return this.mapDateType(value, options);
  }

  private static mapClobType(value: any, options: ResultMappingOptions): any {
    if (!options.convertClobToString) {
      return value;
    }
    
    let result = String(value);
    
    if (options.maxClobSize && result.length > options.maxClobSize) {
      result = result.substring(0, options.maxClobSize) + '...';
    }
    
    return options.trimStrings ? result.trim() : result;
  }

  private static mapBlobType(value: any, options: ResultMappingOptions): any {
    if (!options.convertBlobToBase64) {
      return value;
    }
    
    try {
      const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
      
      if (options.maxBlobSize && buffer.length > options.maxBlobSize) {
        throw new Error(`BLOB size ${buffer.length} exceeds maximum ${options.maxBlobSize}`);
      }
      
      return buffer.toString('base64');
    } catch (error) {
      throw new Error(`Failed to convert BLOB to base64: ${error.message}`);
    }
  }

  private static mapRawType(value: any, options: ResultMappingOptions): string {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
    return buffer.toString('hex').toUpperCase();
  }

  private static mapRowIdType(value: any, options: ResultMappingOptions): string {
    return String(value);
  }

  private static mapXmlType(value: any, options: ResultMappingOptions): any {
    const xmlString = String(value);
    
    if (options.objectHandling === 'json') {
      try {
        // Basic XML to JSON conversion (you might want to use a proper XML parser)
        return this.xmlToJson(xmlString);
      } catch (error) {
        console.warn('Failed to parse XML to JSON:', error);
        return xmlString;
      }
    }
    
    return xmlString;
  }

  private static mapJsonType(value: any, options: ResultMappingOptions): any {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        console.warn('Failed to parse JSON string:', error);
        return value;
      }
    }
    
    return value;
  }

  private static mapBooleanType(value: any, options: ResultMappingOptions): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    
    const stringValue = String(value).toUpperCase();
    
    if (options.booleanTrueValues?.includes(stringValue)) {
      return true;
    }
    
    if (options.booleanFalseValues?.includes(stringValue)) {
      return false;
    }
    
    // Default boolean conversion
    return Boolean(value);
  }

  private static mapIntervalType(value: any, options: ResultMappingOptions): string {
    // Oracle intervals are complex, return as string for now
    return String(value);
  }

  private static mapGenericType(
    value: any, 
    type: string, 
    options: ResultMappingOptions
  ): any {
    // Try to use Oracle type utils for mapping
    if (OracleTypeUtils.isCharacterType(type)) {
      return this.mapStringType(value, options);
    }
    
    if (OracleTypeUtils.isNumericType(type)) {
      return this.mapNumberType(value, options);
    }
    
    if (OracleTypeUtils.isDateTimeType(type)) {
      return this.mapDateType(value, options);
    }
    
    if (OracleTypeUtils.isBinaryType(type)) {
      return this.mapBlobType(value, options);
    }
    
    return value;
  }

  private static handleNull(
    nullHandling: string, 
    columnType: string
  ): any {
    switch (nullHandling) {
      case 'empty':
        if (OracleTypeUtils.isCharacterType(columnType)) return '';
        if (OracleTypeUtils.isNumericType(columnType)) return 0;
        if (OracleTypeUtils.isDateTimeType(columnType)) return new Date(0);
        return null;
      case 'default':
        return this.getDefaultValue(columnType);
      default:
        return null;
    }
  }

  private static handleMappingError(
    value: any,
    columnType: string,
    error: Error,
    options: ResultMappingOptions
  ): any {
    console.warn(`Mapping error for type ${columnType}:`, error);
    return value; // Return original value as fallback
  }

  private static normalizeColumnName(
    columnName: string,
    options: ResultMappingOptions
  ): string {
    let result = columnName;
    
    if (!options.caseSensitive) {
      switch (options.columnNameCase) {
        case 'upper':
          result = result.toUpperCase();
          break;
        case 'lower':
          result = result.toLowerCase();
          break;
        case 'camel':
          result = this.toCamelCase(result);
          break;
        case 'snake':
          result = this.toSnakeCase(result);
          break;
        default:
          // Keep original case
          break;
      }
    }
    
    return result;
  }

  private static toCamelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
  }

  private static toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  private static formatCustomDate(date: Date, format: string): string {
    // Simple date formatting (you might want to use a proper date library)
    return format
      .replace('YYYY', date.getFullYear().toString())
      .replace('MM', (date.getMonth() + 1).toString().padStart(2, '0'))
      .replace('DD', date.getDate().toString().padStart(2, '0'))
      .replace('HH', date.getHours().toString().padStart(2, '0'))
      .replace('mm', date.getMinutes().toString().padStart(2, '0'))
      .replace('ss', date.getSeconds().toString().padStart(2, '0'));
  }

  private static xmlToJson(xml: string): any {
    // Very basic XML to JSON conversion
    // In production, use a proper XML parser like xml2js
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      return this.xmlNodeToJson(doc.documentElement);
    } catch (error) {
      throw new Error(`Failed to parse XML: ${error.message}`);
    }
  }

  private static xmlNodeToJson(node: any): any {
    if (node.nodeType === 3) { // Text node
      return node.nodeValue;
    }
    
    const result: any = {};
    
    if (node.attributes) {
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        result[`@${attr.nodeName}`] = attr.nodeValue;
      }
    }
    
    if (node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child.nodeType === 1) { // Element node
          const childJson = this.xmlNodeToJson(child);
          if (result[child.nodeName]) {
            if (!Array.isArray(result[child.nodeName])) {
              result[child.nodeName] = [result[child.nodeName]];
            }
            result[child.nodeName].push(childJson);
          } else {
            result[child.nodeName] = childJson;
          }
        } else if (child.nodeType === 3 && child.nodeValue.trim()) {
          result['#text'] = child.nodeValue;
        }
      }
    }
    
    return result;
  }

  private static getDefaultValue(columnType: string): any {
    if (OracleTypeUtils.isCharacterType(columnType)) return '';
    if (OracleTypeUtils.isNumericType(columnType)) return 0;
    if (OracleTypeUtils.isDateTimeType(columnType)) return new Date();
    if (columnType === 'BOOLEAN') return false;
    return null;
  }

  // Static utility methods
  static createTransformation(
    columnName: string,
    transformer: (value: any) => any,
    condition?: (value: any) => boolean
  ): ColumnTransformation {
    return { columnName, transformer, condition };
  }

  static createPipeline(
    name: string,
    transformations: ColumnTransformation[] = []
  ): ResultTransformationPipeline {
    return { name, transformations };
  }

  static getCommonTransformations(): { [name: string]: ColumnTransformation } {
    return {
      upperCase: this.createTransformation('*', value => 
        typeof value === 'string' ? value.toUpperCase() : value),
      
      lowerCase: this.createTransformation('*', value => 
        typeof value === 'string' ? value.toLowerCase() : value),
      
      trim: this.createTransformation('*', value => 
        typeof value === 'string' ? value.trim() : value),
      
      nullToEmpty: this.createTransformation('*', value => 
        value === null ? '' : value),
      
      emptyToNull: this.createTransformation('*', value => 
        value === '' ? null : value),
      
      roundNumber: this.createTransformation('*', value => 
        typeof value === 'number' ? Math.round(value) : value),
      
      formatCurrency: this.createTransformation('*', value => 
        typeof value === 'number' ? `$${value.toFixed(2)}` : value),
      
      formatDate: this.createTransformation('*', value => 
        value instanceof Date ? value.toISOString().split('T')[0] : value)
    };
  }
}
