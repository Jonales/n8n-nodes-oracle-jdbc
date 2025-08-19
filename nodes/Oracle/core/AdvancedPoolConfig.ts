
/**
 * Oracle para n8n-nodes-oracle-jdbc
 * Suporte para modo JDBC
 *
 * @author Jônatas Meireles Sousa Vieira
 * @version 0.0.1-rc.1
 */

import { PoolConfiguration } from './ConnectionPool';

export interface AdvancedPoolConfiguration extends PoolConfiguration {
	// Retry e Failover
	connectionRetryAttempts?: number;
	connectionRetryDelayMs?: number;
	fastConnectionFailoverEnabled?: boolean;
	oracleRacFailoverType?: 'SELECT' | 'SESSION' | 'NONE';

	// Monitoramento e Health Check
	statsIntervalSeconds?: number;
	enableConnectionHealthCheck?: boolean;
	connectionTestQuery?: string;
	connectionValidationTimeout?: number;

	// ⚡ Performance Tuning
	maxStatements?: number; // Cache de prepared statements
	statementCacheType?: 'LRU' | 'FIXED';
	maxIdleTimeoutSeconds?: number; // Timeout para conexões ociosas
	loginTimeoutSeconds?: number; // Timeout de login
	maxLifetimeSeconds?: number; // Tempo máximo de vida da conexão

	// Oracle RAC/ADG Support
	enableRacSupport?: boolean;
	racNodes?: RacNodeConfig[];
	loadBalanceConnectionTimeout?: number;

	// Oracle Cloud Infrastructure (OCI)
	ociConfigProfile?: string;
	enableOciIamAuth?: boolean;
	walletLocation?: string;

	// Security & SSL
	sslTruststore?: string;
	sslTruststorePassword?: string;
	sslKeystore?: string;
	sslKeystorePassword?: string;
	enableOracleWallet?: boolean;

	// Advanced Pooling
	connectionHarvestMaxCount?: number;
	connectionHarvestable?: boolean;
	abandonedConnectionTimeout?: number;
	timeToLiveConnectionTimeout?: number;

	// Connection Labeling (for session state)
	enableConnectionLabeling?: boolean;
	defaultConnectionLabels?: { [key: string]: string };

	// Advanced Performance
	enableJmxMonitoring?: boolean;
	jmxDomainName?: string;
	enableConnectionValidation?: boolean;
	validationQuery?: string;
	testOnBorrow?: boolean;
	testOnReturn?: boolean;
	testWhileIdle?: boolean;
}

export interface RacNodeConfig {
	host: string;
	port: number;
	instanceName?: string;
	priority?: number; // 1 = highest priority
	weight?: number; // Load balancing weight
	serviceName?: string; // Service name specific for this node
}

export interface PoolValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
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
			enableConnectionValidation: true,
			testOnBorrow: true,
			testWhileIdle: true,
			maxIdleTimeoutSeconds: 600,
			loginTimeoutSeconds: 10,
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
			fastConnectionFailoverEnabled: false, // Analytics queries podem ser longas
			statsIntervalSeconds: 60,
			maxIdleTimeoutSeconds: 3600,
			enableJmxMonitoring: true,
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
			enableConnectionHealthCheck: true,
			connectionTestQuery: 'SELECT 1 FROM dual',
			statsIntervalSeconds: 45,
			loginTimeoutSeconds: 15,
			maxIdleTimeoutSeconds: 900,
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
			connectionRetryDelayMs: 1000,
			maxStatements: 150,
			enableConnectionLabeling: true,
			enableConnectionHealthCheck: true,
			connectionTestQuery: 'SELECT 1 FROM dual',
			statsIntervalSeconds: 30,
			enableJmxMonitoring: true,
			testOnBorrow: true,
		};
	}

	static getDevelopmentConfig(): AdvancedPoolConfiguration {
		return {
			minPoolSize: 2,
			maxPoolSize: 10,
			initialPoolSize: 3,
			connectionWaitTimeout: 30,
			inactiveConnectionTimeout: 600,
			maxConnectionReuseTime: 3600,
			maxStatements: 25,
			enableConnectionHealthCheck: true,
			connectionTestQuery: 'SELECT 1 FROM dual',
			statsIntervalSeconds: 120,
			connectionRetryAttempts: 2,
			connectionRetryDelayMs: 1000,
		};
	}

	static getProductionConfig(): AdvancedPoolConfiguration {
		return {
			minPoolSize: 15,
			maxPoolSize: 100,
			initialPoolSize: 25,
			connectionWaitTimeout: 10,
			inactiveConnectionTimeout: 300,
			maxConnectionReuseTime: 1800,
			fastConnectionFailoverEnabled: true,
			maxStatements: 300,
			statementCacheType: 'LRU',
			enableConnectionHealthCheck: true,
			connectionTestQuery: 'SELECT 1 FROM dual',
			statsIntervalSeconds: 30,
			connectionRetryAttempts: 5,
			connectionRetryDelayMs: 500,
			enableJmxMonitoring: true,
			enableConnectionValidation: true,
			testOnBorrow: true,
			testWhileIdle: true,
			maxIdleTimeoutSeconds: 300,
			loginTimeoutSeconds: 10,
		};
	}
}

export function validatePoolConfiguration(config: AdvancedPoolConfiguration): PoolValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Validações obrigatórias
	if (config.minPoolSize && config.maxPoolSize && config.minPoolSize > config.maxPoolSize) {
		errors.push('minPoolSize cannot be greater than maxPoolSize');
	}

	if (config.initialPoolSize && config.maxPoolSize && config.initialPoolSize > config.maxPoolSize) {
		errors.push('initialPoolSize cannot be greater than maxPoolSize');
	}

	if (config.initialPoolSize && config.minPoolSize && config.initialPoolSize < config.minPoolSize) {
		errors.push('initialPoolSize cannot be less than minPoolSize');
	}

	// Validações de RAC
	if (config.enableRacSupport) {
		if (!config.racNodes || config.racNodes.length === 0) {
			errors.push('racNodes must be provided when enableRacSupport is true');
		} else {
			const duplicateHosts = new Set();
			for (const node of config.racNodes) {
				const hostPort = `${node.host}:${node.port}`;
				if (duplicateHosts.has(hostPort)) {
					errors.push(`Duplicate RAC node: ${hostPort}`);
				}
				duplicateHosts.add(hostPort);

				if (!node.host || !node.port) {
					errors.push('All RAC nodes must have host and port');
				}
			}
		}
	}

	// Validações de timeout
	if (config.connectionWaitTimeout && config.connectionWaitTimeout < 1) {
		errors.push('connectionWaitTimeout must be at least 1 second');
	}

	if (config.loginTimeoutSeconds && config.loginTimeoutSeconds < 5) {
		warnings.push('loginTimeoutSeconds less than 5 seconds may cause connection issues');
	}

	// Validações de SSL
	if (config.enableOracleWallet && !config.walletLocation) {
		errors.push('walletLocation must be provided when enableOracleWallet is true');
	}

	if (config.sslTruststore && !config.sslTruststorePassword) {
		warnings.push('SSL truststore password not provided - may cause SSL connection issues');
	}

	// Validações de performance
	if (config.maxStatements && config.maxStatements > 1000) {
		warnings.push('maxStatements > 1000 may impact memory usage');
	}

	if (config.maxPoolSize && config.maxPoolSize > 200) {
		warnings.push('maxPoolSize > 200 may impact database server performance');
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
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
	}

	if (config.connectionValidationTimeout) {
		ucpConfig['oracle.ucp.connectionValidationTimeout'] =
			config.connectionValidationTimeout.toString();
	}

	// Oracle RAC Support
	if (config.enableRacSupport && config.racNodes) {
		const racUrl = buildRacConnectionUrl(config.racNodes);
		ucpConfig['oracle.ucp.connectionUrl'] = racUrl;
		ucpConfig['oracle.jdbc.fanEnabled'] = 'true';

		if (config.oracleRacFailoverType) {
			ucpConfig['oracle.net.failover_type'] = config.oracleRacFailoverType;
		}
	}

	if (config.loadBalanceConnectionTimeout) {
		ucpConfig['oracle.net.CONNECTION_TIMEOUT'] = (
			config.loadBalanceConnectionTimeout * 1000
		).toString();
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
		ucpConfig['oracle.ucp.abandonedConnectionTimeout'] =
			config.abandonedConnectionTimeout.toString();
	}

	if (config.timeToLiveConnectionTimeout) {
		ucpConfig['oracle.ucp.timeToLiveConnectionTimeout'] =
			config.timeToLiveConnectionTimeout.toString();
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

	// JMX Monitoring
	if (config.enableJmxMonitoring) {
		ucpConfig['oracle.ucp.jmxEnabled'] = 'true';
		if (config.jmxDomainName) {
			ucpConfig['oracle.ucp.jmxDomainName'] = config.jmxDomainName;
		}
	}

	// Validation settings
	if (config.testOnBorrow) {
		ucpConfig['oracle.ucp.validateConnectionOnBorrow'] = 'true';
	}

	if (config.testOnReturn) {
		ucpConfig['oracle.ucp.validateConnectionOnReturn'] = 'true';
	}

	if (config.testWhileIdle) {
		ucpConfig['oracle.ucp.validateConnectionOnIdle'] = 'true';
	}

	if (config.validationQuery) {
		ucpConfig['oracle.ucp.connectionValidationQuery'] = config.validationQuery;
	}

	// Timeout settings
	if (config.maxIdleTimeoutSeconds) {
		ucpConfig['oracle.ucp.maxIdleTime'] = config.maxIdleTimeoutSeconds.toString();
	}

	if (config.loginTimeoutSeconds) {
		ucpConfig['oracle.jdbc.loginTimeout'] = config.loginTimeoutSeconds.toString();
	}

	if (config.maxLifetimeSeconds) {
		ucpConfig['oracle.ucp.maxConnectionLifetime'] = config.maxLifetimeSeconds.toString();
	}

	return ucpConfig;
}

export function buildRacConnectionUrl(racNodes: RacNodeConfig[], serviceName?: string): string {
	if (!racNodes || racNodes.length === 0) {
		throw new Error('RAC nodes cannot be empty');
	}

	const sortedNodes = racNodes.sort((a, b) => (a.priority || 999) - (b.priority || 999));

	// Build address list with load balancing weights
	const addressList = sortedNodes
		.map(node => {
			let address = `(ADDRESS=(PROTOCOL=TCP)(HOST=${node.host})(PORT=${node.port})`;

			if (node.weight) {
				address += `(LOAD_BALANCE=yes)(LOAD_BALANCE_WEIGHT=${node.weight})`;
			}

			address += ')';
			return address;
		})
		.join('');

	// Use service name from first node if not provided globally
	const finalServiceName = serviceName || racNodes[0].serviceName || 'ORCL';

	// Build complete connection descriptor
	return (
		`(DESCRIPTION=` +
		`(ADDRESS_LIST=${addressList})` +
		`(CONNECT_DATA=` +
		`(SERVICE_NAME=${finalServiceName})` +
		`(FAILOVER_MODE=(TYPE=SELECT)(METHOD=BASIC)(RETRIES=3)(DELAY=5))` +
		`)` +
		`)`
	);
}

export function optimizePoolConfiguration(
	workloadType: 'OLTP' | 'ANALYTICS' | 'MIXED' | 'DEVELOPMENT',
	expectedConcurrency: number,
): AdvancedPoolConfiguration {
	let baseConfig: AdvancedPoolConfiguration;

	switch (workloadType) {
		case 'OLTP':
			baseConfig = PoolConfigurationPresets.getHighVolumeOLTP();
			break;
		case 'ANALYTICS':
			baseConfig = PoolConfigurationPresets.getAnalyticsWorkload();
			break;
		case 'DEVELOPMENT':
			baseConfig = PoolConfigurationPresets.getDevelopmentConfig();
			break;
		default:
			baseConfig = PoolConfigurationPresets.getProductionConfig();
	}

	// Adjust pool sizes based on expected concurrency
	const poolSizeMultiplier = Math.max(1, Math.ceil(expectedConcurrency / 10));

	return {
		...baseConfig,
		minPoolSize: Math.max(2, (baseConfig.minPoolSize || 5) * poolSizeMultiplier),
		maxPoolSize: Math.min(200, (baseConfig.maxPoolSize || 20) * poolSizeMultiplier),
		initialPoolSize: Math.max(3, (baseConfig.initialPoolSize || 8) * poolSizeMultiplier),
	};
}
