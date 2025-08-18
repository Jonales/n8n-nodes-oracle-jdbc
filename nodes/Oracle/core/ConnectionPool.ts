import * as java from 'node-java-bridge';
import { v4 as uuidv4 } from 'uuid';

import { JdbcConnection, OracleJdbcConfig, QueryOptions } from '../types/JdbcTypes';

import { ErrorContext, ErrorHandler } from '../utils/ErrorHandler';

import { OracleJdbcDriver } from './OracleJdbcDriver';

export interface PoolConfiguration {
	minPoolSize?: number;
	maxPoolSize?: number;
	initialPoolSize?: number;
	connectionWaitTimeout?: number;
	inactiveConnectionTimeout?: number;
	validateConnectionOnBorrow?: boolean;
	validateConnectionOnReturn?: boolean;
	testWhileIdle?: boolean;
	maxConnectionReuseTime?: number;
	connectionCreationRetryDelay?: number;

	// Advanced settings
	maxIdleTime?: number;
	maxLifetimeConnection?: number;
	connectionValidationQuery?: string;
	connectionValidationTimeout?: number;
	abandonedConnectionTimeout?: number;
	removeAbandoned?: boolean;
	logAbandoned?: boolean;

	// Performance tuning
	maxStatements?: number;
	statementCacheSize?: number;
	defaultRowPrefetch?: number;
	defaultBatchValue?: number;

	// Monitoring
	enableMonitoring?: boolean;
	monitoringIntervalSeconds?: number;
	enableJmx?: boolean;
}

export interface PoolStatistics {
	poolName: string;
	poolId: string;
	totalConnections: number;
	availableConnections: number;
	borrowedConnections: number;
	peakConnections: number;
	connectionsCreated: number;
	connectionsClosed: number;
	failedConnections: number;

	// Extended statistics
	connectionRequestsCount: number;
	averageConnectionWaitTime: number;
	maxConnectionWaitTime: number;
	connectionLeaks: number;
	validationErrors: number;

	// Pool health
	poolHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
	lastHealthCheck: Date;
}

export interface PoolHealthCheck {
	isHealthy: boolean;
	issues: string[];
	warnings: string[];
	recommendations: string[];
}

export class ConnectionPool {
	private poolId: string;
	private dataSource: any;
	private config: OracleJdbcConfig;
	private poolConfig: PoolConfiguration;
	private isInitialized = false;
	private isShuttingDown = false;

	// Monitoring
	private monitoringTimer?: NodeJS.Timer;
	private activeConnections = new Map<string, Date>();
	private statistics: PoolStatistics;

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
			validateConnectionOnReturn: false,
			testWhileIdle: true,
			maxConnectionReuseTime: 3600,
			connectionCreationRetryDelay: 10,
			maxIdleTime: 600,
			maxLifetimeConnection: 7200,
			connectionValidationQuery: 'SELECT 1 FROM dual',
			connectionValidationTimeout: 5,
			abandonedConnectionTimeout: 300,
			removeAbandoned: true,
			logAbandoned: false,
			maxStatements: 100,
			statementCacheSize: 50,
			defaultRowPrefetch: 20,
			defaultBatchValue: 15,
			enableMonitoring: true,
			monitoringIntervalSeconds: 60,
			enableJmx: false,
			...poolConfig,
		};

		this.initializeStatistics();
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		const errorContext: ErrorContext = {
			operation: 'initializePool',
			poolId: this.poolId,
		};

		try {
			// Ensure Oracle driver is loaded
			await OracleJdbcDriver.initialize();

			// Create Universal Connection Pool (UCP)
			const PoolDataSourceFactory = java.import('oracle.ucp.jdbc.PoolDataSourceFactory');
			this.dataSource = await PoolDataSourceFactory.getPoolDataSource();

			// Configure basic properties
			await this.configureBasicProperties();

			// Configure pool properties
			await this.configurePoolProperties();

			// Configure Oracle-specific properties
			await this.configureOracleProperties();

			// Configure validation properties
			await this.configureValidationProperties();

			// Configure monitoring if enabled
			if (this.poolConfig.enableMonitoring) {
				await this.configureMonitoring();
			}

			this.isInitialized = true;

			// Start monitoring timer
			this.startMonitoring();
		} catch (error) {
			throw ErrorHandler.handleJdbcError(
				error,
				'Failed to initialize connection pool',
				errorContext,
			);
		}
	}

	async getConnection(options: QueryOptions = {}): Promise<JdbcConnection> {
		await this.initialize();

		if (this.isShuttingDown) {
			throw new Error('Connection pool is shutting down');
		}

		const connectionId = uuidv4();
		const errorContext: ErrorContext = {
			operation: 'getConnection',
			poolId: this.poolId,
			connectionId,
		};

		const startTime = Date.now();

		try {
			// Apply timeout if specified
			let originalTimeout;
			if (options.timeout) {
				originalTimeout = await this.dataSource.getConnectionWaitTimeout();
				await this.dataSource.setConnectionWaitTimeout(options.timeout);
			}

			const connection = await this.dataSource.getConnection();

			// Restore original timeout
			if (originalTimeout !== undefined) {
				await this.dataSource.setConnectionWaitTimeout(originalTimeout);
			}

			const jdbcConnection: JdbcConnection = {
				id: connectionId,
				connection,
				config: this.config,
				createdAt: new Date(),
				isActive: true,
				isPooled: true,
				poolId: this.poolId,
			};

			// Track active connection
			this.activeConnections.set(connectionId, new Date());

			// Update statistics
			this.updateConnectionStatistics('borrowed', Date.now() - startTime);

			return jdbcConnection;
		} catch (error) {
			this.updateConnectionStatistics('failed');
			throw ErrorHandler.handleJdbcError(error, 'Failed to get connection from pool', errorContext);
		}
	}

	async returnConnection(connection: JdbcConnection): Promise<void> {
		const errorContext: ErrorContext = {
			operation: 'returnConnection',
			poolId: this.poolId,
			connectionId: connection.id,
		};

		try {
			if (connection.connection && connection.isActive) {
				await connection.connection.close();
				connection.isActive = false;

				// Remove from active connections tracking
				this.activeConnections.delete(connection.id);

				// Update statistics
				this.updateConnectionStatistics('returned');
			}
		} catch (error) {
			throw ErrorHandler.handleJdbcError(
				error,
				'Failed to return connection to pool',
				errorContext,
			);
		}
	}

	async testConnection(): Promise<boolean> {
		if (!this.isInitialized) {
			await this.initialize();
		}

		try {
			const testConn = await this.getConnection({ timeout: 5 });

			try {
				const statement = await testConn.connection.createStatement();
				await statement.setQueryTimeout(5);

				const resultSet = await statement.executeQuery(this.poolConfig.connectionValidationQuery);
				const hasResult = await resultSet.next();

				await resultSet.close();
				await statement.close();

				return hasResult;
			} finally {
				await this.returnConnection(testConn);
			}
		} catch (error) {
			console.error('Connection test failed:', error);
			return false;
		}
	}

	async performHealthCheck(): Promise<PoolHealthCheck> {
		const issues: string[] = [];
		const warnings: string[] = [];
		const recommendations: string[] = [];

		try {
			if (!this.isInitialized) {
				issues.push('Pool is not initialized');
				return { isHealthy: false, issues, warnings, recommendations };
			}

			const stats = await this.getPoolStatistics();

			// Check connection availability
			if (stats.availableConnections === 0) {
				if (stats.borrowedConnections >= stats.totalConnections) {
					issues.push('No available connections - pool exhausted');
					recommendations.push('Consider increasing maxPoolSize');
				} else {
					warnings.push('Low connection availability');
				}
			}

			// Check for connection leaks
			if (stats.connectionLeaks > 0) {
				issues.push(`Detected ${stats.connectionLeaks} connection leaks`);
				recommendations.push('Review connection usage and ensure proper closing');
			}

			// Check pool utilization
			const utilizationPercent = (stats.borrowedConnections / stats.totalConnections) * 100;
			if (utilizationPercent > 90) {
				warnings.push(`High pool utilization: ${utilizationPercent.toFixed(1)}%`);
				recommendations.push('Consider increasing pool size for better performance');
			}

			// Check validation errors
			if (stats.validationErrors > 0) {
				warnings.push(`${stats.validationErrors} validation errors detected`);
				recommendations.push('Check database connectivity and validation query');
			}

			// Test basic connectivity
			const connectionTest = await this.testConnection();
			if (!connectionTest) {
				issues.push('Basic connection test failed');
				recommendations.push('Verify database connectivity and credentials');
			}

			return {
				isHealthy: issues.length === 0,
				issues,
				warnings,
				recommendations,
			};
		} catch (error) {
			issues.push(`Health check failed: ${error.message}`);
			return { isHealthy: false, issues, warnings, recommendations };
		}
	}

	async close(): Promise<void> {
		if (!this.isInitialized) {
			return;
		}

		this.isShuttingDown = true;

		try {
			// Stop monitoring
			if (this.monitoringTimer) {
				clearInterval(this.monitoringTimer);
				this.monitoringTimer = undefined;
			}

			// Close data source
			if (this.dataSource) {
				await this.dataSource.close();
			}

			this.isInitialized = false;
			this.isShuttingDown = false;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to close connection pool');
		}
	}

	async getPoolStatistics(): Promise<PoolStatistics> {
		if (!this.isInitialized) {
			return this.statistics;
		}

		try {
			// Get current UCP statistics
			const totalConnections = await this.dataSource.getTotalConnectionsCount();
			const availableConnections = await this.dataSource.getAvailableConnectionsCount();
			const borrowedConnections = await this.dataSource.getBorrowedConnectionsCount();
			const peakConnections = await this.dataSource.getPeakConnectionsCount();
			const connectionsCreated = await this.dataSource.getConnectionsCreatedCount();
			const connectionsClosed = await this.dataSource.getConnectionsClosedCount();
			const failedConnections = await this.dataSource.getFailedConnectionsCount();

			// Calculate health status
			let poolHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';

			if (availableConnections === 0 && borrowedConnections >= totalConnections) {
				poolHealth = 'CRITICAL';
			} else if (availableConnections < totalConnections * 0.2) {
				poolHealth = 'WARNING';
			}

			// Detect potential connection leaks
			const connectionLeaks = this.detectConnectionLeaks();

			this.statistics = {
				...this.statistics,
				poolName: await this.dataSource.getConnectionPoolName(),
				totalConnections,
				availableConnections,
				borrowedConnections,
				peakConnections,
				connectionsCreated,
				connectionsClosed,
				failedConnections,
				connectionLeaks,
				poolHealth,
				lastHealthCheck: new Date(),
			};

			return this.statistics;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to get pool statistics');
		}
	}

	// Configuration methods
	private async configureBasicProperties(): Promise<void> {
		await this.dataSource.setConnectionFactoryClassName('oracle.jdbc.pool.OracleDataSource');
		await this.dataSource.setURL(OracleJdbcDriver.buildConnectionString(this.config));
		await this.dataSource.setUser(this.config.username);
		await this.dataSource.setPassword(this.config.password);
	}

	private async configurePoolProperties(): Promise<void> {
		await this.dataSource.setInitialPoolSize(this.poolConfig.initialPoolSize!);
		await this.dataSource.setMinPoolSize(this.poolConfig.minPoolSize!);
		await this.dataSource.setMaxPoolSize(this.poolConfig.maxPoolSize!);
		await this.dataSource.setConnectionWaitTimeout(this.poolConfig.connectionWaitTimeout!);
		await this.dataSource.setInactiveConnectionTimeout(this.poolConfig.inactiveConnectionTimeout!);
		await this.dataSource.setMaxConnectionReuseTime(this.poolConfig.maxConnectionReuseTime!);
		await this.dataSource.setConnectionCreationRetryDelay(
			this.poolConfig.connectionCreationRetryDelay!,
		);

		// Advanced pool settings
		if (this.poolConfig.maxIdleTime) {
			await this.dataSource.setMaxIdleTime(this.poolConfig.maxIdleTime);
		}

		if (this.poolConfig.abandonedConnectionTimeout) {
			await this.dataSource.setAbandonedConnectionTimeout(
				this.poolConfig.abandonedConnectionTimeout,
			);
		}

		if (this.poolConfig.removeAbandoned !== undefined) {
			await this.dataSource.setConnectionProperty(
				'oracle.ucp.removeAbandoned',
				this.poolConfig.removeAbandoned.toString(),
			);
		}
	}

	private async configureOracleProperties(): Promise<void> {
		// Statement cache
		if (this.poolConfig.maxStatements) {
			await this.dataSource.setMaxStatements(this.poolConfig.maxStatements);
		}

		// Oracle JDBC optimizations
		await this.dataSource.setConnectionProperty(
			'oracle.jdbc.implicitStatementCacheSize',
			(this.poolConfig.statementCacheSize || 50).toString(),
		);
		await this.dataSource.setConnectionProperty('oracle.jdbc.autoCommitSpecCompliant', 'false');
		await this.dataSource.setConnectionProperty('oracle.net.keepAlive', 'true');
		await this.dataSource.setConnectionProperty(
			'oracle.jdbc.defaultRowPrefetch',
			(this.poolConfig.defaultRowPrefetch || 20).toString(),
		);
		await this.dataSource.setConnectionProperty(
			'oracle.jdbc.defaultBatchValue',
			(this.poolConfig.defaultBatchValue || 15).toString(),
		);

		// Performance settings
		await this.dataSource.setConnectionProperty('oracle.jdbc.ReadTimeout', '30000');
		await this.dataSource.setConnectionProperty('oracle.net.CONNECT_TIMEOUT', '10000');
	}

	private async configureValidationProperties(): Promise<void> {
		await this.dataSource.setValidateConnectionOnBorrow(
			this.poolConfig.validateConnectionOnBorrow!,
		);

		if (this.poolConfig.validateConnectionOnReturn) {
			await this.dataSource.setValidateConnectionOnReturn(
				this.poolConfig.validateConnectionOnReturn,
			);
		}

		if (this.poolConfig.testWhileIdle) {
			await this.dataSource.setConnectionProperty('oracle.ucp.validateConnectionOnIdle', 'true');
		}

		if (this.poolConfig.connectionValidationQuery) {
			await this.dataSource.setConnectionProperty(
				'oracle.ucp.connectionValidationQuery',
				this.poolConfig.connectionValidationQuery,
			);
		}

		if (this.poolConfig.connectionValidationTimeout) {
			await this.dataSource.setConnectionProperty(
				'oracle.ucp.connectionValidationTimeout',
				this.poolConfig.connectionValidationTimeout.toString(),
			);
		}
	}

	private async configureMonitoring(): Promise<void> {
		await this.dataSource.setConnectionPoolName(`Pool_${this.poolId}`);

		if (this.poolConfig.enableJmx) {
			await this.dataSource.setConnectionProperty('oracle.ucp.jmxEnabled', 'true');
		}

		// Enable UCP statistics
		await this.dataSource.setConnectionProperty('oracle.ucp.statisticsEnabled', 'true');
	}

	private startMonitoring(): void {
		if (!this.poolConfig.enableMonitoring) {
			return;
		}

		const intervalMs = (this.poolConfig.monitoringIntervalSeconds || 60) * 1000;

		this.monitoringTimer = setInterval(async () => {
			try {
				const stats = await this.getPoolStatistics();

				// Log critical issues
				if (stats.poolHealth === 'CRITICAL') {
					console.error(`CRITICAL: Pool ${stats.poolName} is unhealthy:`, {
						available: stats.availableConnections,
						borrowed: stats.borrowedConnections,
						total: stats.totalConnections,
					});
				}

				// Log connection leaks
				if (stats.connectionLeaks > 0) {
					console.warn(
						`Pool ${stats.poolName} has ${stats.connectionLeaks} potential connection leaks`,
					);
				}
			} catch (error) {
				console.error('Pool monitoring error:', error);
			}
		}, intervalMs);
	}

	private detectConnectionLeaks(): number {
		let leakCount = 0;
		const now = Date.now();
		const leakThreshold = (this.poolConfig.abandonedConnectionTimeout || 300) * 1000;

		for (const [connectionId, borrowTime] of this.activeConnections) {
			if (now - borrowTime.getTime() > leakThreshold) {
				leakCount++;

				if (this.poolConfig.logAbandoned) {
					console.warn(
						`Potential connection leak detected: ${connectionId}, borrowed ${Math.floor((now - borrowTime.getTime()) / 1000)}s ago`,
					);
				}
			}
		}

		return leakCount;
	}

	private initializeStatistics(): void {
		this.statistics = {
			poolName: `Pool_${this.poolId}`,
			poolId: this.poolId,
			totalConnections: 0,
			availableConnections: 0,
			borrowedConnections: 0,
			peakConnections: 0,
			connectionsCreated: 0,
			connectionsClosed: 0,
			failedConnections: 0,
			connectionRequestsCount: 0,
			averageConnectionWaitTime: 0,
			maxConnectionWaitTime: 0,
			connectionLeaks: 0,
			validationErrors: 0,
			poolHealth: 'HEALTHY',
			lastHealthCheck: new Date(),
		};
	}

	private updateConnectionStatistics(
		operation: 'borrowed' | 'returned' | 'failed',
		waitTime?: number,
	): void {
		switch (operation) {
			case 'borrowed':
				this.statistics.connectionRequestsCount++;
				if (waitTime) {
					this.statistics.maxConnectionWaitTime = Math.max(
						this.statistics.maxConnectionWaitTime,
						waitTime,
					);
					// Update average (simple moving average)
					this.statistics.averageConnectionWaitTime =
						(this.statistics.averageConnectionWaitTime *
							(this.statistics.connectionRequestsCount - 1) +
							waitTime) /
						this.statistics.connectionRequestsCount;
				}
				break;
			case 'failed':
				// Additional failure tracking could be added here
				break;
		}
	}

	// Getters
	getPoolId(): string {
		return this.poolId;
	}

	getConfiguration(): PoolConfiguration {
		return { ...this.poolConfig };
	}

	isPoolInitialized(): boolean {
		return this.isInitialized;
	}

	isPoolHealthy(): boolean {
		return this.statistics.poolHealth !== 'CRITICAL';
	}

	getActiveConnectionsCount(): number {
		return this.activeConnections.size;
	}
}
