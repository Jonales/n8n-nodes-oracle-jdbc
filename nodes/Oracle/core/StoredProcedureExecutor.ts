import { java } from 'java';
import { JdbcConnection } from '../types/JdbcTypes';
import { ErrorHandler } from '../utils/ErrorHandler';

export interface ProcedureParameter {
  name: string;
  value?: any;
  type: 'IN' | 'OUT' | 'INOUT';
  dataType: string;
  size?: number;
}

export interface ProcedureResult {
  outputParameters: { [key: string]: any };
  resultSets: any[][];
  executionTime: number;
}

export class StoredProcedureExecutor {
  private connection: JdbcConnection;

  constructor(connection: JdbcConnection) {
    this.connection = connection;
  }

  async callProcedure(
    procedureName: string,
    parameters: ProcedureParameter[] = []
  ): Promise<ProcedureResult> {
    const startTime = Date.now();
    let callableStatement;

    try {
      // Construir chamada SQL
      const paramPlaceholders = parameters.map(() => '?').join(', ');
      const callSql = `{ call ${procedureName}(${paramPlaceholders}) }`;
      
      callableStatement = await this.connection.connection.prepareCall(callSql);

      // Registrar parâmetros
      await this.registerParameters(callableStatement, parameters);

      // Executar procedure
      const hasResultSet = await callableStatement.execute();

      // Extrair resultados
      const outputParameters = await this.extractOutputParameters(callableStatement, parameters);
      const resultSets = hasResultSet ? [await this.extractResultSet(callableStatement)] : [];

      return {
        outputParameters,
        resultSets,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, `Failed to execute procedure: ${procedureName}`);
    } finally {
      if (callableStatement) {
        await callableStatement.close();
      }
    }
  }

  async callFunction(
    functionName: string,
    returnType: string,
    parameters: ProcedureParameter[] = []
  ): Promise<ProcedureResult> {
    const startTime = Date.now();
    let callableStatement;

    try {
      // Construir chamada SQL para função
      const paramPlaceholders = parameters.length > 0 
        ? ', ' + parameters.map(() => '?').join(', ')
        : '';
      const callSql = `{ ? = call ${functionName}(${paramPlaceholders.substring(2)}) }`;
      
      callableStatement = await this.connection.connection.prepareCall(callSql);

      // Registrar parâmetro de retorno
      await this.registerReturnParameter(callableStatement, returnType);

      // Registrar outros parâmetros
      await this.registerParameters(callableStatement, parameters, 2); // Começar do índice 2

      // Executar função
      await callableStatement.execute();

      // Extrair resultado
      const returnValue = await callableStatement.getObject(1);
      const outputParameters = await this.extractOutputParameters(callableStatement, parameters, 2);
      
      outputParameters['RETURN_VALUE'] = this.convertJavaValue(returnValue);

      return {
        outputParameters,
        resultSets: [],
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, `Failed to execute function: ${functionName}`);
    } finally {
      if (callableStatement) {
        await callableStatement.close();
      }
    }
  }

  async callPackageProcedure(
    packageName: string,
    procedureName: string,
    parameters: ProcedureParameter[] = []
  ): Promise<ProcedureResult> {
    const fullProcedureName = `${packageName}.${procedureName}`;
    return this.callProcedure(fullProcedureName, parameters);
  }

  private async registerParameters(
    statement: any,
    parameters: ProcedureParameter[],
    startIndex = 1
  ): Promise<void> {
    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      const paramIndex = startIndex + i;

      if (param.type === 'IN' || param.type === 'INOUT') {
        // Registrar parâmetro de entrada
        await this.setInputParameter(statement, paramIndex, param);
      }

      if (param.type === 'OUT' || param.type === 'INOUT') {
        // Registrar parâmetro de saída
        await this.registerOutputParameter(statement, paramIndex, param);
      }
    }
  }

  private async registerReturnParameter(statement: any, returnType: string): Promise<void> {
    const sqlType = this.getSqlType(returnType);
    await statement.registerOutParameter(1, sqlType);
  }

  private async setInputParameter(
    statement: any,
    index: number,
    param: ProcedureParameter
  ): Promise<void> {
    const value = param.value;

    if (value === null || value === undefined) {
      const sqlType = this.getSqlType(param.dataType);
      await statement.setNull(index, sqlType);
      return;
    }

    switch (param.dataType.toUpperCase()) {
      case 'VARCHAR2':
      case 'CHAR':
      case 'NVARCHAR2':
      case 'NCHAR':
        await statement.setString(index, String(value));
        break;
      case 'NUMBER':
      case 'INTEGER':
        await statement.setBigDecimal(index, java.newInstanceSync('java.math.BigDecimal', String(value)));
        break;
      case 'DATE':
      case 'TIMESTAMP':
        const date = value instanceof Date ? value : new Date(value);
        const timestamp = java.newInstanceSync('java.sql.Timestamp', date.getTime());
        await statement.setTimestamp(index, timestamp);
        break;
      case 'CLOB':
        await statement.setClob(index, String(value));
        break;
      case 'BLOB':
        const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
        await statement.setBytes(index, bytes);
        break;
      default:
        await statement.setObject(index, value);
    }
  }

  private async registerOutputParameter(
    statement: any,
    index: number,
    param: ProcedureParameter
  ): Promise<void> {
    const sqlType = this.getSqlType(param.dataType);
    
    if (param.size) {
      await statement.registerOutParameter(index, sqlType, param.size);
    } else {
      await statement.registerOutParameter(index, sqlType);
    }
  }

  private async extractOutputParameters(
    statement: any,
    parameters: ProcedureParameter[],
    startIndex = 1
  ): Promise<{ [key: string]: any }> {
    const output: { [key: string]: any } = {};

    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      
      if (param.type === 'OUT' || param.type === 'INOUT') {
        const paramIndex = startIndex + i;
        const value = await statement.getObject(paramIndex);
        output[param.name] = this.convertJavaValue(value);
      }
    }

    return output;
  }

  private async extractResultSet(statement: any): Promise<any[]> {
    const resultSet = await statement.getResultSet();
    if (!resultSet) return [];

    const rows: any[] = [];
    const metaData = await resultSet.getMetaData();
    const columnCount = await metaData.getColumnCount();

    // Obter nomes das colunas
    const columnNames: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      columnNames.push(await metaData.getColumnName(i));
    }

    // Extrair dados
    while (await resultSet.next()) {
      const row: any = {};
      for (let i = 0; i < columnNames.length; i++) {
        const columnName = columnNames[i];
        const value = await resultSet.getObject(i + 1);
        row[columnName] = this.convertJavaValue(value);
      }
      rows.push(row);
    }

    await resultSet.close();
    return rows;
  }

  private getSqlType(dataType: string): any {
    const Types = java.import('java.sql.Types');
    
    switch (dataType.toUpperCase()) {
      case 'VARCHAR2':
      case 'CHAR':
      case 'NVARCHAR2':
      case 'NCHAR':
        return Types.VARCHAR;
      case 'NUMBER':
        return Types.NUMERIC;
      case 'INTEGER':
        return Types.INTEGER;
      case 'DATE':
        return Types.DATE;
      case 'TIMESTAMP':
        return Types.TIMESTAMP;
      case 'CLOB':
        return Types.CLOB;
      case 'BLOB':
        return Types.BLOB;
      case 'CURSOR':
        return Types.REF_CURSOR;
      default:
        return Types.OTHER;
    }
  }

  private convertJavaValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'object' && value.getClass) {
      const className = value.getClass().getName();
      
      switch (className) {
        case 'java.math.BigDecimal':
          return parseFloat(value.toString());
        case 'java.sql.Timestamp':
        case 'java.sql.Date':
        case 'java.sql.Time':
          return new Date(value.getTime());
        case 'oracle.sql.CLOB':
          return value.getSubString(1, value.length());
        case 'oracle.sql.BLOB':
          return Buffer.from(value.getBytes(1, value.length()));
        default:
          return value.toString();
      }
    }

    return value;
  }
}
