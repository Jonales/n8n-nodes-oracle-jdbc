import { java } from 'java';
import { OracleJdbcConfig, JdbcConnection } from '../types/JdbcTypes';
import { ErrorHandler } from '../utils/ErrorHandler';
import { v4 as uuidv4 } from 'uuid';

export interface PoolConfiguration {
  minPoolSize?: number;
  maxPoolSize?: number;
  initialPoolSize?: number;
  connectionWaitTimeout?: number;
  inactiveConnectionTimeout?: number;
  validateConnectionOnBorrow?: boolean;
  maxConnectionReuseTime?: number;
  connectionCreationRetryDelay?: number;
}

export class ConnectionPool {
  private poolId: string;
  private dataSource: any;
  private config: OracleJdbcConfig;
  private poolConfig: PoolConfiguration;
  private isInitialized = false;

  constructor(config: OracleJdbcConfig, poolConfig: PoolConfiguration = {}) {
    this.poolId = uuidv4();
    this.config = config;
    this.poolConfig = {
      minPoolSize: 2,
      maxPoolSize: 10,
      initialPoolSize: 3,
      connectionWaitTimeout: 30,
      inactiveConnectionTimeout: 300,
      validateConnectionOnBorrow: true,
      maxConnectionReuseTime: 3600,
      connectionCreationRetryDelay: 10,
      ...poolConfig,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Criar Universal Connection Pool (UCP)
      const poolDataSourceFactory = java.import('oracle.ucp.jdbc.PoolDataSourceFactory');
      this.dataSource = await poolDataSourceFactory.getPoolDataSource();

      // Configurar propriedades básicas
      await this.dataSource.setConnectionFactoryClassName('oracle.jdbc.pool.OracleDataSource');
      await this.dataSource.setURL(this.buildConnectionUrl());
      await this.dataSource.setUser(this.config.username);
      await this.dataSource.setPassword(this.config.password);

      // Configurar propriedades do pool
      await this.dataSource.setInitialPoolSize(this.poolConfig.initialPoolSize!);
      await this.dataSource.setMinPoolSize(this.poolConfig.minPoolSize!);
      await this.dataSource.setMaxPoolSize(this.poolConfig.maxPoolSize!);
      await this.dataSource.setConnectionWaitTimeout(this.poolConfig.connectionWaitTimeout!);
      await this.dataSource.setInactiveConnectionTimeout(this.poolConfig.inactiveConnectionTimeout!);
      await this.dataSource.setValidateConnectionOnBorrow(this.poolConfig.validateConnectionOnBorrow!);
      await this.dataSource.setMaxConnectionReuseTime(this.poolConfig.maxConnectionReuseTime!);
      await this.dataSource.setConnectionCreationRetryDelay(this.poolConfig.connectionCreationRetryDelay!);

      // Configurar propriedades Oracle específicas
      await this.dataSource.setConnectionProperty('oracle.jdbc.implicitStatementCacheSize', '20');
      await this.dataSource.setConnectionProperty('oracle.jdbc.autoCommitSpecCompliant', 'false');
      await this.dataSource.setConnectionProperty('oracle.net.keepAlive', 'true');

      // Configurar propriedades de pool avançadas
      await this.dataSource.setConnectionPoolName(`OraclePool_${this.poolId}`);
      await this.dataSource.setFastConnectionFailoverEnabled(true);
      await this.dataSource.setMaxStatements(100);

      this.isInitialized = true;
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to initialize connection pool');
    }
  }

  async getConnection(): Promise<JdbcConnection> {
    await this.initialize();

    try {
      const connection = await this.dataSource.getConnection();
      
      return {
        id: uuidv4(),
        connection,
        config: this.config,
        createdAt: new Date(),
        isActive: true,
        isPooled: true,
        poolId: this.poolId,
      };
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to get connection from pool');
    }
  }

  async close(): Promise<void> {
    if (this.dataSource && this.isInitialized) {
      try {
        await this.dataSource.close();
        this.isInitialized = false;
      } catch (error) {
        throw ErrorHandler.handleJdbcError(error, 'Failed to close connection pool');
      }
    }
  }

  async getPoolStatistics(): Promise<any> {
    if (!this.isInitialized) {
      return null;
    }

    try {
      return {
        poolName: await this.dataSource.getConnectionPoolName(),
        totalConnections: await this.dataSource.getTotalConnectionsCount(),
        availableConnections: await this.dataSource.getAvailableConnectionsCount(),
        borrowedConnections: await this.dataSource.getBorrowedConnectionsCount(),
        peakConnections: await this.dataSource.getPeakConnectionsCount(),
        connectionsCreated: await this.dataSource.getConnectionsCreatedCount(),
        connectionsClosed: await this.dataSource.getConnectionsClosedCount(),
        failedConnections: await this.dataSource.getFailedConnectionsCount(),
      };
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to get pool statistics');
    }
  }

  private buildConnectionUrl(): string {
    switch (this.config.connectionType) {
      case 'service':
        return `jdbc:oracle:thin:@${this.config.host}:${this.config.port}/${this.config.serviceName}`;
      case 'sid':
        return `jdbc:oracle:thin:@${this.config.host}:${this.config.port}:${this.config.sid}`;
      case 'tns':
        return `jdbc:oracle:thin:@${this.config.tnsString}`;
      default:
        throw new Error(`Unsupported connection type: ${this.config.connectionType}`);
    }
  }

  getPoolId(): string {
    return this.poolId;
  }

  getConfiguration(): PoolConfiguration {
    return { ...this.poolConfig };
  }
}
