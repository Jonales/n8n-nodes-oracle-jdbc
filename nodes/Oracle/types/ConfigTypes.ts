// Core database configuration types
export interface DatabaseConnectionConfig {
	host: string;
	port: number;
	database?: string;
	schema?: string;
	serviceName?: string;
	sid?: string;
	instanceName?: string;
	options?: DatabaseConnectionOptions;
}

export interface DatabaseConnectionOptions {
	connectionTimeout?: number;
	socketTimeout?: number;
	loginTimeout?: number;
	networkTimeout?: number;
	keepAliveInterval?: number;
	retryAttempts?: number;
	retryDelayMs?: number;
	maxReconnectAttempts?: number;
	reconnectInterval?: number;
	enableKeepAlive?: boolean;
	tcpNoDelay?: boolean;
	receiveBufferSize?: number;
	sendBufferSize?: number;
	[key: string]: any;
}

// SSL/TLS Configuration
export interface SSLConfiguration {
	enabled: boolean;
	mode: 'disable' | 'require' | 'verify-ca' | 'verify-full' | 'prefer';
	ca?: string | Buffer;
	cert?: string | Buffer;
	key?: string | Buffer;
	passphrase?: string;
	caFile?: string;
	certFile?: string;
	keyFile?: string;
	ciphers?: string;
	minVersion?: string;
	maxVersion?: string;
	checkServerIdentity?: boolean;
	rejectUnauthorized?: boolean;
	secureProtocol?: string;
	dhParam?: string;
}

// Connection timeout configurations
export interface ConnectionTimeouts {
	connection?: number;
	socket?: number;
	query?: number;
	statement?: number;
	idle?: number;
	validation?: number;
	login?: number;
	network?: number;
	keepAlive?: number;
}

// Oracle-specific connection configuration
export interface OracleConnectionConfig extends DatabaseConnectionConfig {
	connectionType: 'service' | 'sid' | 'tns' | 'ldap' | 'oci';
	tnsString?: string;
	tnsAdmin?: string;
	walletLocation?: string;
	walletPassword?: string;
	oracleHome?: string;
	nls?: OracleNLSConfig;
	rac?: OracleRACConfig;
	ssl?: OracleSSLConfig;
	oci?: OracleOCIConfig;
	proxy?: OracleProxyConfig;
	edition?: string;
	applicationName?: string;
	clientInfo?: string;
	module?: string;
	action?: string;
	isSuccessful: boolean;
	responseTime: number;
	error?: string;
}

// Oracle National Language Support configuration
export interface OracleNLSConfig {
	language?: string;
	territory?: string;
	characterSet?: string;
	ncharCharacterSet?: string;
	dateFormat?: string;
	timestampFormat?: string;
	timestampTzFormat?: string;
	numericCharacters?: string;
	currency?: string;
	isoCurrency?: string;
	calendar?: string;
	sort?: string;
	lengthSemantics?: 'BYTE' | 'CHAR';
}

// Oracle RAC (Real Application Clusters) configuration
export interface OracleRACConfig {
	enabled: boolean;
	nodes: OracleRACNode[];
	loadBalance?: boolean;
	failover?: 'SESSION' | 'SELECT' | 'NONE';
	retryCount?: number;
	retryDelay?: number;
	onNodeDown?: 'RECONNECT' | 'DISCONNECT';
	transparentApplicationFailover?: boolean;
	applicationContinuity?: boolean;
}

export interface OracleRACNode {
	host: string;
	port: number;
	instanceName?: string;
	priority?: number;
	weight?: number;
	status?: 'ACTIVE' | 'STANDBY' | 'MAINTENANCE';
}

// Oracle SSL/TLS specific configuration
export interface OracleSSLConfig extends SSLConfiguration {
	walletLocation?: string;
	walletPassword?: string;
	truststore?: string;
	truststorePassword?: string;
	truststoreType?: 'JKS' | 'PKCS12';
	keystore?: string;
	keystorePassword?: string;
	keystoreType?: 'JKS' | 'PKCS12';
	crlFile?: string;
	serverDNMatch?: boolean;
	sslVersion?: 'TLSv1.2' | 'TLSv1.3';
	cipherSuites?: string[];
}

// Oracle Cloud Infrastructure configuration
export interface OracleOCIConfig {
	enabled?: boolean;
	configFile?: string;
	profile?: string;
	region?: string;
	tenancyId?: string;
	userId?: string;
	fingerprint?: string;
	privateKey?: string;
	privateKeyFile?: string;
	passphrase?: string;
	compartmentId?: string;
	autonomousDatabase?: {
		ocid?: string;
		walletPassword?: string;
		downloadWallet?: boolean;
	};
}

// Oracle proxy configuration
export interface OracleProxyConfig {
	enabled?: boolean;
	type?: 'HTTP' | 'SOCKS';
	host?: string;
	port?: number;
	username?: string;
	password?: string;
	noProxyHosts?: string[];
	authentication?: 'BASIC' | 'DIGEST' | 'NTLM';
}

// Connection pool configuration base
export interface PoolConfigurationBase {
	minPoolSize?: number;
	maxPoolSize?: number;
	initialPoolSize?: number;
	acquireIncrement?: number;
	maxIdleTime?: number;
	maxConnectionAge?: number;
	maxConnectionLifetime?: number;
	connectionWaitTimeout?: number;
	idleConnectionTestPeriod?: number;
	acquireRetryAttempts?: number;
	acquireRetryDelay?: number;
	breakAfterAcquireFailure?: boolean;
	testConnectionOnCheckout?: boolean;
	testConnectionOnCheckin?: boolean;
	preferredTestQuery?: string;
}

// Advanced pool configuration
export interface AdvancedPoolConfig extends PoolConfigurationBase {
	// Health monitoring
	enableHealthCheck?: boolean;
	healthCheckInterval?: number;
	healthCheckQuery?: string;
	healthCheckTimeout?: number;

	// Performance tuning
	statementCacheSize?: number;
	statementCacheType?: 'LRU' | 'FIFO' | 'FIXED';
	fetchSize?: number;
	batchSize?: number;

	// Connection validation
	validateOnBorrow?: boolean;
	validateOnReturn?: boolean;
	validationQuery?: string;
	validationTimeout?: number;

	// Abandoned connection handling
	abandonedConnectionTimeout?: number;
	logAbandoned?: boolean;
	removeAbandoned?: boolean;

	// JMX monitoring
	enableJMX?: boolean;
	jmxObjectName?: string;

	// Security
	allowUserCredentialsInUrl?: boolean;
	encryptionEnabled?: boolean;

	// Oracle-specific
	enableFastConnectionFailover?: boolean;
	connectionRepurposeThreshold?: number;
	connectionHarvestable?: boolean;
	connectionHarvestMaxCount?: number;
	connectionLabeling?: boolean;
	enableConnectionPooling?: boolean;
	implicitConnectionCacheEnabled?: boolean;
}

// Environment-specific configurations
export interface EnvironmentConfig {
	name: string;
	description?: string;
	database: OracleConnectionConfig;
	pool?: AdvancedPoolConfig;
	ssl?: SSLConfiguration;
	monitoring?: MonitoringConfig;
	logging?: LoggingConfig;
	performance?: PerformanceConfig;
}

// Monitoring configuration
export interface MonitoringConfig {
	enabled?: boolean;
	metricsInterval?: number;
	healthCheckEndpoint?: string;
	alerting?: {
		enabled?: boolean;
		thresholds?: {
			connectionPoolUsage?: number;
			queryExecutionTime?: number;
			errorRate?: number;
		};
		notifications?: {
			email?: string[];
			webhook?: string;
			slack?: string;
		};
	};
}

// Logging configuration
export interface LoggingConfig {
	level?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';
	enableSqlLogging?: boolean;
	enableConnectionLogging?: boolean;
	enablePerformanceLogging?: boolean;
	logSlowQueries?: boolean;
	slowQueryThreshold?: number;
	logFile?: string;
	maxLogFileSize?: string;
	maxLogFiles?: number;
	enableAuditLogging?: boolean;
	auditLogFile?: string;
}

// Performance configuration
export interface PerformanceConfig {
	enableQueryCache?: boolean;
	queryCacheSize?: number;
	queryCacheTimeout?: number;
	enableStatementPooling?: boolean;
	statementPoolSize?: number;
	enableBatching?: boolean;
	defaultBatchSize?: number;
	enableCompression?: boolean;
	compressionLevel?: number;
	enablePipelining?: boolean;
	prefetchRows?: number;
	enableResultSetCaching?: boolean;
	resultSetCacheSize?: number;
}

// Retry configuration
export interface RetryConfig {
	enabled?: boolean;
	maxAttempts?: number;
	initialDelay?: number;
	maxDelay?: number;
	backoffMultiplier?: number;
	retryableErrors?: string[];
	nonRetryableErrors?: string[];
	enableExponentialBackoff?: boolean;
	enableJitter?: boolean;
}

// Load balancing configuration
export interface LoadBalancingConfig {
	enabled?: boolean;
	strategy?: 'ROUND_ROBIN' | 'LEAST_CONNECTIONS' | 'WEIGHTED' | 'RANDOM';
	healthCheckInterval?: number;
	failoverTimeout?: number;
	stickyConnections?: boolean;
	weights?: { [nodeId: string]: number };
}

// Security configuration
export interface SecurityConfig {
	authentication?: {
		type?: 'PASSWORD' | 'KERBEROS' | 'LDAP' | 'CERTIFICATE' | 'TOKEN';
		realm?: string;
		principal?: string;
		keytab?: string;
		ticketCache?: string;
	};
	authorization?: {
		enabled?: boolean;
		roleMapping?: { [role: string]: string[] };
	};
	encryption?: {
		enabled?: boolean;
		algorithm?: string;
		keyLength?: number;
		keyFile?: string;
	};
	audit?: {
		enabled?: boolean;
		events?: string[];
		destination?: 'FILE' | 'DATABASE' | 'SYSLOG';
		format?: 'JSON' | 'XML' | 'PLAIN';
	};
}

// Configuration validation result
export interface ConfigValidationResult {
	valid: boolean;
	errors: ConfigValidationError[];
	warnings: ConfigValidationWarning[];
}

export interface ConfigValidationError {
	field: string;
	message: string;
	code: string;
	severity: 'ERROR' | 'CRITICAL';
}

export interface ConfigValidationWarning {
	field: string;
	message: string;
	code: string;
	recommendation?: string;
}

// Configuration builder utilities
export interface ConfigurationBuilder {
	forEnvironment(env: 'development' | 'staging' | 'production'): ConfigurationBuilder;
	withDatabase(config: OracleConnectionConfig): ConfigurationBuilder;
	withPool(config: AdvancedPoolConfig): ConfigurationBuilder;
	withSSL(config: SSLConfiguration): ConfigurationBuilder;
	withMonitoring(config: MonitoringConfig): ConfigurationBuilder;
	withRetry(config: RetryConfig): ConfigurationBuilder;
	withLoadBalancing(config: LoadBalancingConfig): ConfigurationBuilder;
	withSecurity(config: SecurityConfig): ConfigurationBuilder;
	build(): EnvironmentConfig;
	validate(): ConfigValidationResult;
}

// Configuration templates
export interface ConfigurationTemplate {
	name: string;
	description: string;
	environment: 'development' | 'staging' | 'production' | 'testing';
	config: Partial<EnvironmentConfig>;
	tags?: string[];
	version?: string;
	author?: string;
	deprecated?: boolean;
}

// Network configuration
export interface NetworkConfig {
	connectTimeout?: number;
	readTimeout?: number;
	writeTimeout?: number;
	keepAlive?: boolean;
	keepAliveTime?: number;
	keepAliveInterval?: number;
	keepAliveCount?: number;
	tcpNoDelay?: boolean;
	soLinger?: number;
	receiveBufferSize?: number;
	sendBufferSize?: number;
	trafficClass?: number;
	ipv6?: boolean;
	bindAddress?: string;
	localPort?: number;
}

// Oracle-specific JDBC properties
export interface OracleJDBCProperties {
	// Connection properties
	'oracle.jdbc.autoCommitSpecCompliant'?: string;
	'oracle.jdbc.implicitStatementCacheSize'?: string;
	'oracle.jdbc.defaultRowPrefetch'?: string;
	'oracle.jdbc.defaultBatchValue'?: string;
	'oracle.jdbc.ReadTimeout'?: string;
	'oracle.jdbc.loggerLevel'?: string;
	'oracle.jdbc.V8Compatible'?: string;
	'oracle.jdbc.useThreadLocalBufferCache'?: string;
	'oracle.jdbc.enableQueryResultCache'?: string;

	// Network properties
	'oracle.net.keepAlive'?: string;
	'oracle.net.disableOob'?: string;
	'oracle.net.READ_TIMEOUT'?: string;
	'oracle.net.CONNECT_TIMEOUT'?: string;
	'oracle.net.ssl_client_authentication'?: string;
	'oracle.net.ssl_version'?: string;
	'oracle.net.authentication_services'?: string;
	'oracle.net.wallet_location'?: string;

	// Performance properties
	'oracle.jdbc.fanEnabled'?: string;
	'oracle.jdbc.applicationContinuity'?: string;
	'oracle.jdbc.replayMaxRetryCount'?: string;
	'oracle.jdbc.replayMaxRetryDelay'?: string;

	// UCP properties
	'oracle.ucp.connectionPoolName'?: string;
	'oracle.ucp.initialPoolSize'?: string;
	'oracle.ucp.minPoolSize'?: string;
	'oracle.ucp.maxPoolSize'?: string;
	'oracle.ucp.connectionWaitTimeout'?: string;
	'oracle.ucp.inactiveConnectionTimeout'?: string;
	'oracle.ucp.validateConnectionOnBorrow'?: string;
	'oracle.ucp.maxStatements'?: string;
	'oracle.ucp.fastConnectionFailoverEnabled'?: string;
	'oracle.ucp.connectionHarvestable'?: string;
	'oracle.ucp.connectionHarvestMaxCount'?: string;
	'oracle.ucp.connectionLabelingHighCost'?: string;

	// Custom properties
	[key: string]: string | undefined;
}

// Type guards and utilities
export namespace ConfigUtils {
	export function isOracleConfig(config: any): config is OracleConnectionConfig {
		return config && typeof config.host === 'string' && typeof config.port === 'number';
	}

	export function isSSLEnabled(config: SSLConfiguration): boolean {
		return config.enabled === true;
	}

	export function hasPoolConfig(config: any): config is { pool: AdvancedPoolConfig } {
		return config && config.pool && typeof config.pool === 'object';
	}

	export function validateTimeout(timeout: number | undefined, name: string): void {
		if (timeout !== undefined && (timeout < 0 || !Number.isFinite(timeout))) {
			throw new Error(`Invalid timeout value for ${name}: ${timeout}`);
		}
	}

	export function normalizeJDBCProperties(
		props: Partial<OracleJDBCProperties>,
	): OracleJDBCProperties {
		const normalized: OracleJDBCProperties = {};
		for (const [key, value] of Object.entries(props)) {
			if (value !== undefined) {
				normalized[key] = String(value);
			}
		}
		return normalized;
	}
}
