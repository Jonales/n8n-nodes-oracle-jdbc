import { java } from 'java';
import { OracleJdbcConfig, JdbcConnection } from '../types/JdbcTypes';
import { AdvancedPoolConfiguration, buildAdvancedPoolConfig } from './AdvancedPoolConfig';
import { ErrorHandler } from '../utils/ErrorHandler';
import { v4 as uuidv4 } from 'uuid';

export interface PoolStatistics {
  poolName: string;
  totalConnections: number;
  availableConnections: number;
  borrowedConnections: number;
  peakConnections: number;
  connectionsCreated: number;
  connectionsClosed: number;
  failedConnections: number;
  connectionWaitTime: number;
  connectionBorrowTime: number;
  cumulativeConnectionBorrowTime: number;
  cumulativeConnectionReturnTime: number;
}

export interface ConnectionLabel {
  [key: string]: string;
}

export class EnterpriseConnectionPool {
  private poolId: string;
  private dataSource: any;
  private config: OracleJdbcConfig;
  private poolConfig: AdvancedPoolConfiguration;
  private isInitialized = false;
  private poolManager: any;
  private statsMonitor?: NodeJS.Timer;

  constructor(config: OracleJdbcConfig, poolConfig: AdvancedPoolConfiguration = {}) {
    this.poolId = uuidv4();
    this.config = config;
    this.poolConfig = {
      minPoolSize: 5,
      maxPoolSize: 20,
      initialPoolSize: 8,
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
      // Criar Universal Connection Pool Manager
      this.poolManager = java.import('oracle.ucp.admin.UniversalConnectionPoolManagerImpl').getInstance();
      
      // Criar Pool Data Source
      const poolDataSourceFactory = java.import('oracle.ucp.jdbc.PoolDataSourceFactory');
      this.dataSource = await poolDataSourceFactory.getPoolDataSource();

      // Configurar URL de conexão (RAC support)
      const connectionUrl = this.buildAdvancedConnectionUrl();
      await this.dataSource.setURL(connectionUrl);
      await this.dataSource.setUser(this.config.username);
      await this.dataSource.setPassword(this.config.password);

      // Aplicar configurações básicas do pool
      await this.applyBasicPoolConfiguration();

      // Aplicar configurações avançadas
      await this.applyAdvancedConfiguration();

      // Configurar Oracle-specific properties
      await this.applyOracleSpecificProperties();

      // Inicializar pool
      await this.dataSource.setConnectionPoolName(`EnterprisePool_${this.poolId}`);
      
      // Registrar pool no manager
      await this.poolManager.createConnectionPool(this.dataSource);

      // Iniciar monitoramento se habilitado
      if (this.poolConfig.statsIntervalSeconds) {
        this.startStatsMonitoring();
      }

      this.isInitialized = true;
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to initialize enterprise connection pool');
    }
  }

  async getConnection(connectionLabels?: ConnectionLabel): Promise<JdbcConnection> {
    await this.initialize();

    try {
      let connection;
      
      if (connectionLabels && this.poolConfig.enableConnectionLabeling) {
        // Usar connection labeling
        const labelBuilder = java.import('oracle.ucp.jdbc.LabelableConnection');
        connection = await this.dataSource.getConnection(connectionLabels);
      } else {
        connection = await this.dataSource.getConnection();
      }

      return {
        id: uuidv4(),
        connection,
        config: this.config,
        createdAt: new Date(),
        isActive: true,
        isPooled: true,
        poolId: this.poolId,
        labels: connectionLabels,
      };
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to get connection from enterprise pool');
    }
  }

  async getConnectionWithRetry(
    maxRetries = 3,
    retryDelayMs = 1000,
    connectionLabels?: ConnectionLabel
  ): Promise<JdbcConnection> {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.getConnection(connectionLabels);
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          console.warn(`Connection attempt ${attempt} failed, retrying in ${retryDelayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          retryDelayMs *= 1.5; // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }

  async borrowConnection(timeout?: number): Promise<JdbcConnection> {
    const originalTimeout = this.poolConfig.connectionWaitTimeout;
    
    if (timeout) {
      await this.dataSource.setConnectionWaitTimeout(timeout);
    }
    
    try {
      return await this.getConnection();
    } finally {
      if (timeout && originalTimeout) {
        await this.dataSource.setConnectionWaitTimeout(originalTimeout);
      }
    }
  }

  async returnConnection(connection: JdbcConnection, labels?: ConnectionLabel): Promise<void> {
    try {
      if (labels && this.poolConfig.enableConnectionLabeling) {
        // Apply labels before returning
        const labelableConn = connection.connection;
        for (const [key, value] of Object.entries(labels)) {
          await labelableConn.applyConnectionLabel(key, value);
        }
      }
      
      await connection.connection.close();
      connection.isActive = false;
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to return connection to pool');
    }
  }

  async getPoolStatistics(): Promise<PoolStatistics> {
    if (!this.isInitialized) {
      throw new Error('Pool not initialized');
    }

    try {
      const poolName = await this.dataSource.getConnectionPoolName();
      const ucpManager = await this.poolManager.getUniversalConnectionPool(poolName);
      
      return {
        poolName,
        totalConnections: await ucpManager.getTotalConnectionsCount(),
        availableConnections: await ucpManager.getAvailableConnectionsCount(),
        borrowedConnections: await ucpManager.getBorrowedConnectionsCount(),
        peakConnections: await ucpManager.getPeakConnectionsCount(),
        connectionsCreated: await ucpManager.getConnectionsCreatedCount(),
        connectionsClosed: await ucpManager.getConnectionsClosedCount(),
        failedConnections: await ucpManager.getFailedConnectionsCount(),
        connectionWaitTime: await ucpManager.getCumulativeConnectionWaitTime(),
        connectionBorrowTime: await ucpManager.getCumulativeConnectionBorrowTime(),
        cumulativeConnectionBorrowTime: await ucpManager.getCumulativeConnectionBorrowTime(),
        cumulativeConnectionReturnTime: await ucpManager.getCumulativeConnectionReturnTime(),
      };
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to get pool statistics');
    }
  }

  async refreshPool(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      const poolName = await this.dataSource.getConnectionPoolName();
      const ucpManager = await this.poolManager.getUniversalConnectionPool(poolName);
      await ucpManager.refreshConnections();
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to refresh pool connections');
    }
  }

  async purgePool(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      const poolName = await this.dataSource.getConnectionPoolName();
      const ucpManager = await this.poolManager.getUniversalConnectionPool(poolName);
      await ucpManager.purgeConnections();
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to purge pool connections');
    }
  }

  async startConnectionPool(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Pool not initialized');
    }

    try {
      const poolName = await this.dataSource.getConnectionPoolName();
      await this.poolManager.startConnectionPool(poolName);
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to start connection pool');
    }
  }

  async stopConnectionPool(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      const poolName = await this.dataSource.getConnectionPoolName();
      await this.poolManager.stopConnectionPool(poolName);
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to stop connection pool');
    }
  }

  async close(): Promise<void> {
    if (this.statsMonitor) {
      clearInterval(this.statsMonitor);
    }

    if (this.dataSource && this.isInitialized) {
      try {
        await this.stopConnectionPool();
        const poolName = await this.dataSource.getConnectionPoolName();
        await this.poolManager.destroyConnectionPool(poolName);
        this.isInitialized = false;
      } catch (error) {
        throw ErrorHandler.handleJdbcError(error, 'Failed to close enterprise connection pool');
      }
    }
  }

  private buildAdvancedConnectionUrl(): string {
    if (this.poolConfig.enableRacSupport && this.poolConfig.racNodes) {
      return this.buildRacConnectionUrl();
    }

    // Standard connection URL
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

  private buildRacConnectionUrl(): string {
    const racNodes = this.poolConfig.racNodes!;
    const sortedNodes = racNodes.sort((a, b) => (a.priority || 999) - (b.priority || 999));
    
    const addressList = sortedNodes.map(node => 
      `(ADDRESS=(PROTOCOL=TCP)(HOST=${node.host})(PORT=${node.port}))`
    ).join('');

    const serviceName = this.config.serviceName || this.config.sid;
    
    return `jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS_LIST=${addressList})(CONNECT_DATA=(SERVICE_NAME=${serviceName})(FAILOVER_MODE=(TYPE=${this.poolConfig.oracleRacFailoverType || 'SELECT'})(METHOD=BASIC)(RETRIES=3)(DELAY=5))))`;
  }

  private async applyBasicPoolConfiguration(): Promise<void> {
    await this.dataSource.setInitialPoolSize(this.poolConfig.initialPoolSize!);
    await this.dataSource.setMinPoolSize(this.poolConfig.minPoolSize!);
    await this.dataSource.setMaxPoolSize(this.poolConfig.maxPoolSize!);
    await this.dataSource.setConnectionWaitTimeout(this.poolConfig.connectionWaitTimeout!);
    await this.dataSource.setInactiveConnectionTimeout(this.poolConfig.inactiveConnectionTimeout!);
    await this.dataSource.setValidateConnectionOnBorrow(this.poolConfig.validateConnectionOnBorrow!);
    await this.dataSource.setMaxConnectionReuseTime(this.poolConfig.maxConnectionReuseTime!);
    await this.dataSource.setConnectionCreationRetryDelay(this.poolConfig.connectionCreationRetryDelay!);
  }

  private async applyAdvancedConfiguration(): Promise<void> {
    const advancedConfig = buildAdvancedPoolConfig(this.poolConfig);
    
    for (const [key, value] of Object.entries(advancedConfig)) {
      if (value !== undefined) {
        await this.dataSource.setConnectionProperty(key, String(value));
      }
    }
  }

  private async applyOracleSpecificProperties(): Promise<void> {
    // Oracle JDBC optimizations
    await this.dataSource.setConnectionProperty('oracle.jdbc.implicitStatementCacheSize', 
      (this.poolConfig.maxStatements || 50).toString());
    await this.dataSource.setConnectionProperty('oracle.jdbc.autoCommitSpecCompliant', 'false');
    await this.dataSource.setConnectionProperty('oracle.net.keepAlive', 'true');
    await this.dataSource.setConnectionProperty('oracle.jdbc.ReadTimeout', '30000');
    
    // Performance tuning
    await this.dataSource.setConnectionProperty('oracle.jdbc.defaultRowPrefetch', '20');
    await this.dataSource.setConnectionProperty('oracle.jdbc.defaultBatchValue', '15');
    
    // Connection labeling
    if (this.poolConfig.enableConnectionLabeling) {
      await this.dataSource.setConnectionProperty('oracle.ucp.connectionLabelingHighCost', '10');
    }
  }

  private startStatsMonitoring(): void {
    this.statsMonitor = setInterval(async () => {
      try {
        const stats = await this.getPoolStatistics();
        console.log(`Pool ${stats.poolName} Stats:`, {
          total: stats.totalConnections,
          available: stats.availableConnections,
          borrowed: stats.borrowedConnections,
          peak: stats.peakConnections,
        });
      } catch (error) {
        console.error('Failed to collect pool statistics:', error.message);
      }
    }, this.poolConfig.statsIntervalSeconds! * 1000);
  }

  getPoolId(): string {
    return this.poolId;
  }

  getConfiguration(): AdvancedPoolConfiguration {
    return { ...this.poolConfig };
  }

  isPoolInitialized(): boolean {
    return this.isInitialized;
  }
}
