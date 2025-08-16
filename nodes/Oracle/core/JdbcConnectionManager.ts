import { java } from 'java';
import { v4 as uuidv4 } from 'uuid';
import { OracleJdbcConfig, JdbcConnection, QueryResult } from '../types/JdbcTypes';
import { ErrorHandler } from '../utils/ErrorHandler';

export class JdbcConnectionManager {
  private static instance: JdbcConnectionManager;
  private initialized = false;
  private connectionPools = new Map<string, any>();

  private constructor() {}

  public static getInstance(): JdbcConnectionManager {
    if (!JdbcConnectionManager.instance) {
      JdbcConnectionManager.instance = new JdbcConnectionManager();
    }
    return JdbcConnectionManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Configurar classpath para Oracle JDBC
      java.classpath.push('./lib/ojdbc11.jar');
      java.classpath.push('./lib/ucp.jar');
      
      // Registrar driver Oracle
      const oracleDriver = java.newInstanceSync('oracle.jdbc.OracleDriver');
      const driverManager = java.import('java.sql.DriverManager');
      await driverManager.registerDriver(oracleDriver);

      this.initialized = true;
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to initialize JDBC');
    }
  }

  async createConnection(config: OracleJdbcConfig): Promise<JdbcConnection> {
    await this.initialize();

    const connectionUrl = this.buildConnectionUrl(config);
    const connectionId = uuidv4();

    try {
      const driverManager = java.import('java.sql.DriverManager');
      const connection = await driverManager.getConnection(
        connectionUrl,
        config.username,
        config.password
      );

      // Configurar propriedades da conexão
      if (config.connectionOptions?.connectionTimeout) {
        await connection.setNetworkTimeout(
          null,
          config.connectionOptions.connectionTimeout * 1000
        );
      }

      return {
        id: connectionId,
        connection,
        config,
        createdAt: new Date(),
        isActive: true,
      };
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to create connection');
    }
  }

  async createConnectionPool(config: OracleJdbcConfig, poolSize = 10): Promise<string> {
    await this.initialize();

    const poolId = uuidv4();
    const connectionUrl = this.buildConnectionUrl(config);

    try {
      // Usar Oracle Universal Connection Pool (UCP)
      const poolDataSource = java.newInstanceSync('oracle.ucp.jdbc.PoolDataSourceFactory');
      const pds = await poolDataSource.getPoolDataSource();

      await pds.setConnectionFactoryClassName('oracle.jdbc.pool.OracleDataSource');
      await pds.setURL(connectionUrl);
      await pds.setUser(config.username);
      await pds.setPassword(config.password);
      await pds.setInitialPoolSize(Math.min(3, poolSize));
      await pds.setMinPoolSize(2);
      await pds.setMaxPoolSize(poolSize);
      await pds.setConnectionWaitTimeout(30);
      await pds.setInactiveConnectionTimeout(300);

      this.connectionPools.set(poolId, pds);
      return poolId;
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to create connection pool');
    }
  }

  async getPooledConnection(poolId: string): Promise<JdbcConnection> {
    const pool = this.connectionPools.get(poolId);
    if (!pool) {
      throw new Error(`Connection pool ${poolId} not found`);
    }

    try {
      const connection = await pool.getConnection();
      return {
        id: uuidv4(),
        connection,
        config: {} as OracleJdbcConfig,
        createdAt: new Date(),
        isActive: true,
        isPooled: true,
        poolId,
      };
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to get pooled connection');
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
        
        // Bind parameters
        for (let i = 0; i < parameters.length; i++) {
          await statement.setObject(i + 1, parameters[i]);
        }
      } else {
        statement = await jdbcConnection.connection.createStatement();
      }

      const isSelect = sql.trim().toLowerCase().startsWith('select');
      let result: QueryResult;

      if (isSelect) {
        const resultSet = parameters 
          ? await statement.executeQuery()
          : await statement.executeQuery(sql);
        
        const rows = await this.extractResultSet(resultSet);
        await resultSet.close();
        
        result = {
          rows,
          rowCount: rows.length,
          executionTime: Date.now() - startTime,
        };
      } else {
        const updateCount = parameters
          ? await statement.executeUpdate()
          : await statement.executeUpdate(sql);
        
        result = {
          rows: [],
          rowCount: updateCount,
          executionTime: Date.now() - startTime,
        };
      }

      await statement.close();
      return result;
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Query execution failed');
    }
  }

  async closeConnection(jdbcConnection: JdbcConnection): Promise<void> {
    try {
      if (jdbcConnection.connection && !await jdbcConnection.connection.isClosed()) {
        await jdbcConnection.connection.close();
      }
      jdbcConnection.isActive = false;
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to close connection');
    }
  }

  async closeConnectionPool(poolId: string): Promise<void> {
    const pool = this.connectionPools.get(poolId);
    if (pool) {
      try {
        await pool.close();
        this.connectionPools.delete(poolId);
      } catch (error) {
        throw ErrorHandler.handleJdbcError(error, 'Failed to close connection pool');
      }
    }
  }

  private buildConnectionUrl(config: OracleJdbcConfig): string {
    switch (config.connectionType) {
      case 'service':
        return `jdbc:oracle:thin:@${config.host}:${config.port}/${config.serviceName}`;
      
      case 'sid':
        return `jdbc:oracle:thin:@${config.host}:${config.port}:${config.sid}`;
      
      case 'tns':
        return `jdbc:oracle:thin:@${config.tnsString}`;
      
      default:
        throw new Error(`Unsupported connection type: ${config.connectionType}`);
    }
  }

  private async extractResultSet(resultSet: any): Promise<any[]> {
    const rows: any[] = [];
    const metaData = await resultSet.getMetaData();
    const columnCount = await metaData.getColumnCount();

    // Obter nomes das colunas
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
        row[columnName] = this.convertJavaToJs(value);
      }
      rows.push(row);
    }

    return rows;
  }

  private convertJavaToJs(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    // Converter tipos Java para JavaScript
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
          return value.getBytes(1, value.length());
        default:
          return value.toString();
      }
    }

    return value;
  }
}