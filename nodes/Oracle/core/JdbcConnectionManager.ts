import * as java from 'java-bridge';
import { v4 as uuidv4 } from 'uuid';
import { JdbcConnection, OracleJdbcConfig, QueryResult } from '../types/JdbcTypes';
import { OracleJdbcDriver } from './OracleJdbcDriver';

export class JdbcConnectionManager {
  private static instance: JdbcConnectionManager;
  
  async createConnection(config: OracleJdbcConfig): Promise<JdbcConnection> {
    await this.initialize(); // Property 'initialize' does not exist on type 'JdbcConnectionManager'.ts(2339)
    
    const connectionId = uuidv4();
    
    try {
      const connectionUrl = OracleJdbcDriver.buildConnectionString(config); //erro aqui Property 'buildConnectionString' is private and only accessible within class 'OracleJdbcDriver'.ts(2341) (method) OracleJdbcDriver.buildConnectionString(config: OracleJdbcConfig): string
      const DriverManager = java.javaImport('java.sql.DriverManager');
      
      const connection = await DriverManager.getConnection(
        connectionUrl,
        config.username,
        config.password
      );

      const jdbcConnection: JdbcConnection = {
        id: connectionId,
        connection,
        config,
        createdAt: new Date(),
        isActive: true,
        isPooled: false,
      };

      return jdbcConnection;
    } catch (error) {
      throw new Error(`Failed to create connection: ${error.message}`);
    }
  }

  async executeQuery(
    jdbcConnection: JdbcConnection,
    sql: string,
    parameters?: any[]
  ): Promise<QueryResult> {
    try {
      const startTime = Date.now();
      let statement;

      if (parameters && parameters.length > 0) {
        statement = await jdbcConnection.connection.prepareStatement(sql);
        await this.bindParameters(statement, parameters);
      } else {
        statement = await jdbcConnection.connection.createStatement();
      }

      const isSelect = sql.trim().toLowerCase().startsWith('select');
      
      if (isSelect) {
        const resultSet = parameters?.length > 0   //erro aqui  'parameters.length' is possibly 'undefined'.ts(18048) (property) Array<any>.length: number | undefined Gets or sets the length of the array. This is a number one higher than the highest index in the array.
          ? await statement.executeQuery()
          : await statement.executeQuery(sql);
          
        const rows = await this.extractResultSet(resultSet); //erro aqui  Property 'extractResultSet' does not exist on type 'JdbcConnectionManager'.ts(2339)
        await resultSet.close();
        
        return {
          rows,
          rowCount: rows.length,
          executionTime: Date.now() - startTime
        };
      } else {
        const updateCount = parameters?.length > 0 //erro aqui  'parameters.length' is possibly 'undefined'.ts(18048) (property) Array<any>.length: number | undefined Gets or sets the length of the array. This is a number one higher than the highest index in the array.
           ? await statement.executeUpdate()
          : await statement.executeUpdate(sql);
          
        return {
          rows: [],
          rowCount: updateCount,
          executionTime: Date.now() - startTime
        };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Query execution failed: ${message}`);
    }
  }

  private async bindParameters(statement: any, parameters: any[]): Promise<void> {
    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      const paramIndex = i + 1;

      if (param === null || param === undefined) {
        const Types = java.javaImport('java.sql.Types');
        await statement.setNull(paramIndex, Types.NULL);
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
        const Timestamp = java.javaImport('java.sql.Timestamp');
        const timestamp = java.newInstanceSync('java.sql.Timestamp', param.getTime());
        await statement.setTimestamp(paramIndex, timestamp);
      } else {
        await statement.setObject(paramIndex, param);
      }
    }
  }
}
