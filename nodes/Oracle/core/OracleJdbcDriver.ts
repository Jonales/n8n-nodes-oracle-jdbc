import * as java from 'node-java-bridge';

import { OracleJdbcConfig } from '../types/JdbcTypes';

import { ErrorContext, ErrorHandler } from '../utils/ErrorHandler';

export interface DriverInitializationOptions {
	enableFan?: boolean;
	keepAlive?: boolean;
	implicitStatementCacheSize?: number;
	defaultRowPrefetch?: number;
	defaultBatchValue?: number;
	enableOracleOptimizations?: boolean;
}

export interface ConnectionTestResult {
	isSuccessful: boolean;
	responseTime: number;
	serverVersion?: string;
	sessionId?: string;
	error?: string;
}

export interface SSLConfiguration {
	enabled: boolean;
	clientAuthentication?: boolean;
	version?: '1.2' | '1.3';
	trustStore?: string;
	trustStorePassword?: string;
	keyStore?: string;
	keyStorePassword?: string;
	walletLocation?: string;
}

export class OracleJdbcDriver {
	private static initialized = false;
	private static initializationOptions: DriverInitializationOptions = {};
	private static readonly DEFAULT_JARS = [
		'./lib/ojdbc11.jar',
		'./lib/ucp.jar',
		'./lib/orai18n.jar',
		'./lib/ons.jar',
		'./lib/simplefan.jar',
	];

	static async initialize(options: DriverInitializationOptions = {}): Promise<void> {
		if (this.initialized) {
			return;
		}

		const errorContext: ErrorContext = {
			operation: 'initializeOracleDriver',
		};

		try {
			this.initializationOptions = {
				enableFan: false,
				keepAlive: true,
				implicitStatementCacheSize: 50,
				defaultRowPrefetch: 20,
				defaultBatchValue: 15,
				enableOracleOptimizations: true,
				...options,
			};

			// Add Oracle JDBC JARs to classpath
			await this.addJarsToClasspath();

			// Import and register Oracle JDBC driver
			await this.registerOracleDriver();

			// Configure global Oracle properties
			await this.configureGlobalProperties();

			this.initialized = true;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(
				error,
				'Failed to initialize Oracle JDBC driver',
				errorContext,
			);
		}
	}

	static buildConnectionString(config: OracleJdbcConfig, sslConfig?: SSLConfiguration): string {
		const errorContext: ErrorContext = {
			operation: 'buildConnectionString',
		};

		try {
			let baseUrl: string;

			switch (config.connectionType) {
				case 'service':
					if (!config.serviceName) {
						throw new Error('Service name is required for service connection type');
					}
					baseUrl = `jdbc:oracle:thin:@${config.host}:${config.port}/${config.serviceName}`;
					break;

				case 'sid':
					if (!config.sid) {
						throw new Error('SID is required for SID connection type');
					}
					baseUrl = `jdbc:oracle:thin:@${config.host}:${config.port}:${config.sid}`;
					break;

				case 'tns':
					if (!config.tnsString) {
						throw new Error('TNS string is required for TNS connection type');
					}
					baseUrl = `jdbc:oracle:thin:@${config.tnsString}`;
					break;

				default:
					throw new Error(`Unsupported connection type: ${config.connectionType}`);
			}

			// Add SSL parameters if configured
			const urlParams = this.buildUrlParameters(config, sslConfig);
			if (urlParams.length > 0) {
				baseUrl += '?' + urlParams.join('&');
			}

			return baseUrl;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to build connection string', errorContext);
		}
	}

	static async testConnection(
		config: OracleJdbcConfig,
		options: {
			timeout?: number;
			includeMetadata?: boolean;
		} = {},
	): Promise<ConnectionTestResult> {
		await this.initialize();

		const { timeout = 10, includeMetadata = false } = options;
		const startTime = Date.now();

		const errorContext: ErrorContext = {
			operation: 'testConnection',
			host: config.host,
			port: config.port,
		};

		try {
			const connectionUrl = this.buildConnectionString(config);
			const DriverManager = java.import('java.sql.DriverManager');

			// Set login timeout
			await DriverManager.setLoginTimeout(timeout);

			const connection = await DriverManager.getConnection(
				connectionUrl,
				config.username,
				config.password,
			);

			const result: ConnectionTestResult = {
				isSuccessful: true,
				responseTime: Date.now() - startTime,
			};

			if (includeMetadata) {
				try {
					// Get server version
					const metaData = await connection.getMetaData();
					result.serverVersion = await metaData.getDatabaseProductVersion();

					// Get session ID
					const statement = await connection.createStatement();
					const resultSet = await statement.executeQuery(
						"SELECT SYS_CONTEXT('USERENV', 'SESSIONID') AS SESSION_ID FROM dual",
					);

					if (await resultSet.next()) {
						result.sessionId = await resultSet.getString('SESSION_ID');
					}

					await resultSet.close();
					await statement.close();
				} catch (metadataError) {
					console.warn('Failed to retrieve connection metadata:', metadataError);
				}
			}

			// Test basic query execution
			const statement = await connection.createStatement();
			await statement.setQueryTimeout(timeout);

			const resultSet = await statement.executeQuery('SELECT 1 FROM dual');
			const hasResult = await resultSet.next();

			await resultSet.close();
			await statement.close();
			await connection.close();

			if (!hasResult) {
				result.isSuccessful = false;
				result.error = 'Test query did not return expected result';
			}

			return result;
		} catch (error) {
			return {
				isSuccessful: false,
				responseTime: Date.now() - startTime,
				error: error.message || 'Connection test failed',
			};
		}
	}

	static async validateConfiguration(config: OracleJdbcConfig): Promise<{
		isValid: boolean;
		errors: string[];
		warnings: string[];
	}> {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Basic validation
		if (!config.host || config.host.trim() === '') {
			errors.push('Host is required');
		}

		if (!config.port || config.port <= 0 || config.port > 65535) {
			errors.push('Valid port number (1-65535) is required');
		}

		if (!config.username || config.username.trim() === '') {
			errors.push('Username is required');
		}

		if (!config.password || config.password.trim() === '') {
			errors.push('Password is required');
		}

		// Connection type specific validation
		switch (config.connectionType) {
			case 'service':
				if (!config.serviceName || config.serviceName.trim() === '') {
					errors.push('Service name is required for service connection type');
				}
				break;

			case 'sid':
				if (!config.sid || config.sid.trim() === '') {
					errors.push('SID is required for SID connection type');
				}
				break;

			case 'tns':
				if (!config.tnsString || config.tnsString.trim() === '') {
					errors.push('TNS string is required for TNS connection type');
				} else {
					// Basic TNS string validation
					if (!config.tnsString.includes('DESCRIPTION') || !config.tnsString.includes('ADDRESS')) {
						warnings.push(
							'TNS string may be malformed - should contain DESCRIPTION and ADDRESS clauses',
						);
					}
				}
				break;

			default:
				errors.push(`Unsupported connection type: ${config.connectionType}`);
		}

		// Connection options validation
		if (config.connectionOptions) {
			if (
				config.connectionOptions.connectionTimeout &&
				config.connectionOptions.connectionTimeout <= 0
			) {
				warnings.push('Connection timeout should be greater than 0');
			}

			if (config.connectionOptions.socketTimeout && config.connectionOptions.socketTimeout <= 0) {
				warnings.push('Socket timeout should be greater than 0');
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		};
	}

	static async createOptimizedConnection(
		config: OracleJdbcConfig,
		options: {
			autoCommit?: boolean;
			readOnly?: boolean;
			schema?: string;
			statementCacheSize?: number;
		} = {},
	): Promise<any> {
		await this.initialize();

		const connectionUrl = this.buildConnectionString(config);
		const DriverManager = java.import('java.sql.DriverManager');

		const connection = await DriverManager.getConnection(
			connectionUrl,
			config.username,
			config.password,
		);

		// Apply optimizations
		if (options.autoCommit !== undefined) {
			await connection.setAutoCommit(options.autoCommit);
		}

		if (options.readOnly !== undefined) {
			await connection.setReadOnly(options.readOnly);
		}

		if (options.schema) {
			await connection.setSchema(options.schema);
		}

		// Apply Oracle-specific optimizations
		if (options.statementCacheSize) {
			const oracleConnection = connection.unwrap(java.import('oracle.jdbc.OracleConnection'));
			await oracleConnection.setImplicitCachingEnabled(true);
			await oracleConnection.setStatementCacheSize(options.statementCacheSize);
		}

		return connection;
	}

	static getInitializationStatus(): {
		initialized: boolean;
		options: DriverInitializationOptions;
	} {
		return {
			initialized: this.initialized,
			options: { ...this.initializationOptions },
		};
	}

	static async reinitialize(options: DriverInitializationOptions = {}): Promise<void> {
		this.initialized = false;
		await this.initialize(options);
	}

	// Private helper methods
	private static async addJarsToClasspath(): Promise<void> {
		try {
			for (const jarPath of this.DEFAULT_JARS) {
				try {
					java.classpath.push(jarPath);
				} catch (error) {
					// Some JARs might not exist, log but continue
					console.warn(`Warning: Could not add ${jarPath} to classpath:`, error.message);
				}
			}
		} catch (error) {
			throw new Error(`Failed to add Oracle JDBC JARs to classpath: ${error.message}`);
		}
	}

	private static async registerOracleDriver(): Promise<void> {
		try {
			// Import Oracle driver class
			const OracleDriver = java.import('oracle.jdbc.OracleDriver');
			const DriverManager = java.import('java.sql.DriverManager');

			// Create and register driver instance
			const driverInstance = new OracleDriver();
			await DriverManager.registerDriver(driverInstance);
		} catch (error) {
			throw new Error(`Failed to register Oracle JDBC driver: ${error.message}`);
		}
	}

	private static async configureGlobalProperties(): Promise<void> {
		try {
			const System = java.import('java.lang.System');

			// Configure Oracle-specific properties
			await System.setProperty(
				'oracle.jdbc.fanEnabled',
				this.initializationOptions.enableFan ? 'true' : 'false',
			);

			await System.setProperty(
				'oracle.net.keepAlive',
				this.initializationOptions.keepAlive ? 'true' : 'false',
			);

			if (this.initializationOptions.enableOracleOptimizations) {
				// Performance optimizations
				await System.setProperty(
					'oracle.jdbc.defaultRowPrefetch',
					this.initializationOptions.defaultRowPrefetch!.toString(),
				);

				await System.setProperty(
					'oracle.jdbc.defaultBatchValue',
					this.initializationOptions.defaultBatchValue!.toString(),
				);

				await System.setProperty(
					'oracle.jdbc.implicitStatementCacheSize',
					this.initializationOptions.implicitStatementCacheSize!.toString(),
				);

				// Additional performance settings
				await System.setProperty('oracle.jdbc.autoCommitSpecCompliant', 'false');
				await System.setProperty('oracle.jdbc.useThreadLocalBufferCache', 'true');
				await System.setProperty('oracle.jdbc.enableQueryResultCache', 'false');
			}
		} catch (error) {
			throw new Error(`Failed to configure Oracle global properties: ${error.message}`);
		}
	}

	private static buildUrlParameters(
		config: OracleJdbcConfig,
		sslConfig?: SSLConfiguration,
	): string[] {
		const params: string[] = [];

		// SSL configuration
		if (config.connectionOptions?.sslMode === 'required' || sslConfig?.enabled) {
			params.push('oracle.net.ssl_client_authentication=false');
			params.push('oracle.net.ssl_version=1.2');

			if (sslConfig?.clientAuthentication) {
				params.push('oracle.net.ssl_client_authentication=true');
			}

			if (sslConfig?.version) {
				params.push(`oracle.net.ssl_version=${sslConfig.version}`);
			}

			if (sslConfig?.walletLocation) {
				params.push(`oracle.net.wallet_location=${encodeURIComponent(sslConfig.walletLocation)}`);
			}
		}

		// Connection timeout
		if (config.connectionOptions?.connectionTimeout) {
			params.push(
				`oracle.net.CONNECT_TIMEOUT=${config.connectionOptions.connectionTimeout * 1000}`,
			);
		}

		// Socket timeout
		if (config.connectionOptions?.socketTimeout) {
			params.push(`oracle.jdbc.ReadTimeout=${config.connectionOptions.socketTimeout * 1000}`);
		}

		// Schema
		if (config.connectionOptions?.schema) {
			params.push(`currentSchema=${encodeURIComponent(config.connectionOptions.schema)}`);
		}

		return params;
	}

	static buildSSLConnectionString(config: OracleJdbcConfig, sslConfig: SSLConfiguration): string {
		return this.buildConnectionString(config, sslConfig);
	}

	static async testSSLConnection(
		config: OracleJdbcConfig,
		sslConfig: SSLConfiguration,
	): Promise<ConnectionTestResult> {
		const sslUrl = this.buildSSLConnectionString(config, sslConfig);

		// Temporarily modify config for SSL test
		const testConfig = {
			...config,
			connectionType: 'tns' as const,
			tnsString: sslUrl.replace('jdbc:oracle:thin:@', ''),
		};

		return this.testConnection(testConfig, { includeMetadata: true });
	}

	// Utility methods for connection string parsing
	static parseConnectionString(connectionString: string): {
		type: 'service' | 'sid' | 'tns';
		host?: string;
		port?: number;
		serviceName?: string;
		sid?: string;
		tnsString?: string;
		parameters?: { [key: string]: string };
	} {
		// Remove jdbc:oracle:thin:@ prefix
		const cleanUrl = connectionString.replace(/^jdbc:oracle:thin:@/, '');

		// Check if it's a TNS string (starts with parenthesis)
		if (cleanUrl.startsWith('(')) {
			return {
				type: 'tns',
				tnsString: cleanUrl,
			};
		}

		// Parse standard host:port/service or host:port:sid format
		const [hostPort, ...rest] = cleanUrl.split(/[/:]/);
		const [host, portStr] = hostPort.split(':');
		const port = parseInt(portStr, 10);

		if (cleanUrl.includes('/')) {
			// Service name format
			const serviceName = rest.join('/');
			return {
				type: 'service',
				host,
				port,
				serviceName,
			};
		} else {
			// SID format
			const sid = rest.join(':');
			return {
				type: 'sid',
				host,
				port,
				sid,
			};
		}
	}
}
