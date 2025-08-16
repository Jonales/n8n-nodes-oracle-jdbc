import { PoolConfiguration } from './ConnectionPool';

export interface AdvancedPoolConfiguration extends PoolConfiguration {
  // 🔄 Retry e Failover
  connectionRetryAttempts?: number;
  connectionRetryDelayMs?: number;
  fastConnectionFailoverEnabled?: boolean;
  oracleRacFailoverType?: 'SELECT' | 'SESSION' | 'NONE';
  
  // 📊 Monitoramento e Health Check
  statsIntervalSeconds?: number;
  enableConnectionHealthCheck?: boolean;
  connectionTestQuery?: string;
  connectionValidationTimeout?: number;
  
  // ⚡ Performance Tuning
  maxStatements?: number;           // Cache de prepared statements
  statementCacheType?: 'LRU' | 'FIXED';
  maxIdleTimeoutSeconds?: number;   // Timeout para conexões ociosas
  loginTimeoutSeconds?: number;     // Timeout de login
  maxLifetimeSeconds?: number;      // Tempo máximo de vida da conexão
  
  // 🏗️ Oracle RAC/ADG Support
  enableRacSupport?: boolean;
  racNodes?: RacNodeConfig[];
  loadBalanceConnectionTimeout?: number;
  
  // ☁️ Oracle Cloud Infrastructure (OCI)
  ociConfigProfile?: string;
  enableOciIamAuth?: boolean;
  walletLocation?: string;
  
  // 🔐 Security & SSL
  sslTruststore?: string;
  sslTruststorePassword?: string;
  sslKeystore?: string;
  sslKeystorePassword?: string;
  enableOracleWallet?: boolean;
  
  // 📈 Advanced Pooling
  connectionHarvestMaxCount?: number;
  connectionHarvestable?: boolean;
  abandonedConnectionTimeout?: number;
  timeToLiveConnectionTimeout?: number;
  
  // 🎯 Connection Labeling (for session state)
  enableConnectionLabeling?: boolean;
  defaultConnectionLabels?: { [key: string]: string };
}

export interface RacNodeConfig {
  host: string;
  port: number;
  instanceName?: string;
  priority?: number; // 1 = highest priority
}

// Configurações pré-definidas por cenário
export class PoolConfigurationPresets {
  static getHighVolumeOLTP(): AdvancedPoolConfiguration {
    return {
      minPoolSize: 10,
      maxPoolSize: 50,
      initialPoolSize: 15,
      connectionWaitTimeout: 5,
      inactiveConnectionTimeout: 300,
      maxConnectionReuseTime: 1800,
      fastConnectionFailoverEnabled: true,
      maxStatements: 200,
      statementCacheType: 'LRU',
      enableConnectionHealthCheck: true,
      connectionTestQuery: 'SELECT 1 FROM dual',
      statsIntervalSeconds: 30,
      connectionRetryAttempts: 3,
      connectionRetryDelayMs: 500,
    };
  }

  static getAnalyticsWorkload(): AdvancedPoolConfiguration {
    return {
      minPoolSize: 5,
      maxPoolSize: 20,
      initialPoolSize: 8,
      connectionWaitTimeout: 60,
      inactiveConnectionTimeout: 1800,
      maxConnectionReuseTime: 7200,
      maxStatements: 50,
      enableConnectionHealthCheck: true,
      connectionValidationTimeout: 10,
      loginTimeoutSeconds: 30,
    };
  }

  static getOracleCloudConfig(): AdvancedPoolConfiguration {
    return {
      minPoolSize: 5,
      maxPoolSize: 25,
      initialPoolSize: 8,
      enableOciIamAuth: true,
      sslTruststore: '/opt/oracle/wallet',
      enableOracleWallet: true,
      fastConnectionFailoverEnabled: true,
      connectionRetryAttempts: 5,
      connectionRetryDelayMs: 2000,
      maxStatements: 100,
    };
  }

  static getOracleRacConfig(racNodes: RacNodeConfig[]): AdvancedPoolConfiguration {
    return {
      minPoolSize: 8,
      maxPoolSize: 40,
      initialPoolSize: 12,
      enableRacSupport: true,
      racNodes,
      fastConnectionFailoverEnabled: true,
      oracleRacFailoverType: 'SELECT',
      loadBalanceConnectionTimeout: 10,
      connectionRetryAttempts: 5,
      maxStatements: 150,
      enableConnectionLabeling: true,
    };
  }
}

export function buildAdvancedPoolConfig(config: AdvancedPoolConfiguration): any {
  const ucpConfig: any = {};

  // Configurações básicas de retry e failover
  if (config.fastConnectionFailoverEnabled) {
    ucpConfig['oracle.ucp.fastConnectionFailoverEnabled'] = 'true';
  }
  if (config.connectionRetryAttempts) {
    ucpConfig['oracle.ucp.connectionRetryCount'] = config.connectionRetryAttempts.toString();
  }
  if (config.connectionRetryDelayMs) {
    ucpConfig['oracle.ucp.connectionRetryDelay'] = config.connectionRetryDelayMs.toString();
  }

  // Statement cache
  if (config.maxStatements) {
    ucpConfig['oracle.jdbc.implicitStatementCacheSize'] = config.maxStatements.toString();
  }
  if (config.statementCacheType) {
    ucpConfig['oracle.jdbc.statementCacheType'] = config.statementCacheType;
  }

  // Health check
  if (config.enableConnectionHealthCheck) {
    ucpConfig['oracle.ucp.validateConnectionOnBorrow'] = 'true';
    if (config.connectionTestQuery) {
      ucpConfig['oracle.ucp.connectionValidationQuery'] = config.connectionTestQuery;
    }
    if (config.connectionValidationTimeout) {
      ucpConfig['oracle.ucp.connectionValidationTimeout'] = config.connectionValidationTimeout.toString();
    }
  }

  // Oracle RAC Support
  if (config.enableRacSupport && config.racNodes) {
    const racUrl = buildRacConnectionUrl(config.racNodes);
    ucpConfig['oracle.ucp.connectionUrl'] = racUrl;
    ucpConfig['oracle.jdbc.fanEnabled'] = 'true';
    
    if (config.oracleRacFailoverType) {
      ucpConfig['oracle.net.failover_type'] = config.oracleRacFailoverType;
    }
    if (config.loadBalanceConnectionTimeout) {
      ucpConfig['oracle.net.CONNECTION_TIMEOUT'] = (config.loadBalanceConnectionTimeout * 1000).toString();
    }
  }

  // Oracle Cloud Infrastructure
  if (config.enableOciIamAuth) {
    ucpConfig['oracle.net.authentication_services'] = 'TCPS';
    ucpConfig['oracle.net.ssl_client_authentication'] = 'false';
  }
  if (config.walletLocation) {
    ucpConfig['oracle.net.wallet_location'] = config.walletLocation;
  }

  // SSL Configuration
  if (config.sslTruststore) {
    ucpConfig['javax.net.ssl.trustStore'] = config.sslTruststore;
    if (config.sslTruststorePassword) {
      ucpConfig['javax.net.ssl.trustStorePassword'] = config.sslTruststorePassword;
    }
  }
  if (config.sslKeystore) {
    ucpConfig['javax.net.ssl.keyStore'] = config.sslKeystore;
    if (config.sslKeystorePassword) {
      ucpConfig['javax.net.ssl.keyStorePassword'] = config.sslKeystorePassword;
    }
  }

  // Advanced pooling features
  if (config.connectionHarvestMaxCount) {
    ucpConfig['oracle.ucp.connectionHarvestMaxCount'] = config.connectionHarvestMaxCount.toString();
  }
  if (config.connectionHarvestable !== undefined) {
    ucpConfig['oracle.ucp.connectionHarvestable'] = config.connectionHarvestable.toString();
  }
  if (config.abandonedConnectionTimeout) {
    ucpConfig['oracle.ucp.abandonedConnectionTimeout'] = config.abandonedConnectionTimeout.toString();
  }
  if (config.timeToLiveConnectionTimeout) {
    ucpConfig['oracle.ucp.timeToLiveConnectionTimeout'] = config.timeToLiveConnectionTimeout.toString();
  }

  // Connection Labeling
  if (config.enableConnectionLabeling) {
    ucpConfig['oracle.ucp.connectionLabelingHighCost'] = '10';
    if (config.defaultConnectionLabels) {
      for (const [key, value] of Object.entries(config.defaultConnectionLabels)) {
        ucpConfig[`oracle.ucp.connectionLabel.${key}`] = value;
      }
    }
  }

  // Monitoring
  if (config.statsIntervalSeconds) {
    ucpConfig['oracle.ucp.statisticsEnabled'] = 'true';
    ucpConfig['oracle.ucp.statisticsInterval'] = (config.statsIntervalSeconds * 1000).toString();
  }

  return ucpConfig;
}

function buildRacConnectionUrl(racNodes: RacNodeConfig[]): string {
  const sortedNodes = racNodes.sort((a, b) => (a.priority || 999) - (b.priority || 999));
  
  const addressList = sortedNodes.map(node => 
    `(ADDRESS=(PROTOCOL=TCP)(HOST=${node.host})(PORT=${node.port}))`
  ).join('');

  return `(DESCRIPTION=(ADDRESS_LIST=${addressList})(CONNECT_DATA=(SERVER=DEDICATED)(FAILOVER_MODE=(TYPE=SELECT)(METHOD=BASIC)(RETRIES=3)(DELAY=5))))`;
}
