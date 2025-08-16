import { java } from 'java';
import { JdbcConnection, QueryResult, QueryOptions } from '../types/JdbcTypes';
import { ErrorHandler } from '../utils/ErrorHandler';

export class QueryExecutor {
  private connection: JdbcConnection;

  constructor(connection: JdbcConnection) {
    this.connection = connection;
  }

  async executeSelect(
    sql: string, 
    parameters: any[] = [], 
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const startTime = Date.now();
    let statement;
    let resultSet;

    try {
      if (parameters.length > 0) {
        statement = await this.connection.connection.prepareStatement(sql);
        await this.bindParameters(statement, parameters);
        resultSet = await statement.executeQuery();
      } else {
        statement = await this.connection.connection.createStatement();
        
        // Configurar fetch size se especificado
        if (options.fetchSize) {
          await statement.setFetchSize(options.fetchSize);
        }
        
        resultSet = await statement.executeQuery(sql);
      }

      const rows = await this.extractResultSet(resultSet);
      
      return {
        rows,
        rowCount: rows.length,
        executionTime: Date.now() - startTime,
        metadata: await this.extractMetadata(resultSet),
      };
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'SELECT execution failed');
    } finally {
      if (resultSet) await resultSet.close();
      if (statement) await statement.close();
    }
  }

  async executeDML(sql: string, parameters: any[] = []): Promise<QueryResult> {
    const startTime = Date.now();
    let statement;

    try {
      if (parameters.length > 0) {
        statement = await this.connection.connection.prepareStatement(sql);
        await this.bindParameters(statement, parameters);
        const updateCount = await statement.executeUpdate();
        
        return {
          rows: [],
          rowCount: updateCount,
          executionTime: Date.now() - startTime,
        };
      } else {
        statement = await this.connection.connection.createStatement();
        const updateCount = await statement.executeUpdate(sql);
        
        return {
          rows: [],
          rowCount: updateCount,
          executionTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'DML execution failed');
    } finally {
      if (statement) await statement.close();
    }
  }

  async executePLSQL(plsqlBlock: string, parameters: any[] = []): Promise<QueryResult> {
    const startTime = Date.now();
    let callableStatement;

    try {
      // Preparar chamada para bloco PL/SQL
      callableStatement = await this.connection.connection.prepareCall(plsqlBlock);
      
      if (parameters.length > 0) {
        await this.bindParameters(callableStatement, parameters);
      }

      await callableStatement.execute();
      
      // Extrair parâmetros de saída se houver
      const outputParams = await this.extractOutputParameters(callableStatement, parameters);
      
      return {
        rows: outputParams.length > 0 ? [{ outputParams }] : [],
        rowCount: 1,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'PL/SQL execution failed');
    } finally {
      if (callableStatement) await callableStatement.close();
    }
  }

  private async bindParameters(statement: any, parameters: any[]): Promise<void> {
    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      const paramIndex = i + 1;

      if (param === null || param === undefined) {
        await statement.setNull(paramIndex, java.import('java.sql.Types').NULL);
      } else if (typeof param === 'string') {
        await statement.setString(paramIndex, param);
      } else if (typeof param === 'number') {
        if (Number.isInteger(param)) {
          await statement.setInt(paramIndex, param);
        } else {
          await statement.setDouble(paramIndex, param);
        }
      } else if (typeof param === 'boolean') {
        await statement.setBoolean(paramIndex, param);
      } else if (param instanceof Date) {
        const timestamp = java.newInstanceSync('java.sql.Timestamp', param.getTime());
        await statement.setTimestamp(paramIndex, timestamp);
      } else {
        await statement.setObject(paramIndex, param);
      }
    }
  }

  private async extractResultSet(resultSet: any): Promise<any[]> {
    const rows: any[] = [];
    const metaData = await resultSet.getMetaData();
    const columnCount = await metaData.getColumnCount();

    // Extrair nomes das colunas
    const columnNames: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      const columnName = await metaData.getColumnName(i);
      columnNames.push(columnName);
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

    return rows;
  }

  private async extractMetadata(resultSet: any): Promise<any> {
    const metaData = await resultSet.getMetaData();
    const columnCount = await metaData.getColumnCount();
    const columns = [];

    for (let i = 1; i <= columnCount; i++) {
      columns.push({
        name: await metaData.getColumnName(i),
        type: await metaData.getColumnTypeName(i),
        size: await metaData.getColumnDisplaySize(i),
        precision: await metaData.getPrecision(i),
        scale: await metaData.getScale(i),
        nullable: (await metaData.isNullable(i)) === 1,
      });
    }

    return { columns };
  }

  private async extractOutputParameters(statement: any, parameters: any[]): Promise<any[]> {
    const outputParams: any[] = [];
    
    for (let i = 0; i < parameters.length; i++) {
      try {
        const value = await statement.getObject(i + 1);
        outputParams.push(this.convertJavaValue(value));
      } catch {
        // Parâmetro não é de saída
      }
    }

    return outputParams;
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
          const bytes = value.getBytes(1, value.length());
          return Buffer.from(bytes);
        default:
          return value.toString();
      }
    }

    return value;
  }
}
