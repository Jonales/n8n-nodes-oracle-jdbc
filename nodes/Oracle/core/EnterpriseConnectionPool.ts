/**
 * Oracle para n8n-nodes-oracle-jdbc
 * Suporte para modo JDBC
 *
 * @author Jônatas Meireles Sousa Vieira
 * @version 0.0.1-rc.1
 */
import * as java from 'java-bridge';
import { v4 as uuidv4 } from 'uuid';

import { JdbcConnection, OracleJdbcConfig, QueryOptions } from '../types/JdbcTypes';
import type { ConnectionLabel } from '../types/JdbcTypes';

import { ErrorContext, ErrorHandler } from '../utils/ErrorHandler';

import { AdvancedPoolConfiguration, buildAdvancedPoolConfig } from './AdvancedPoolConfig';
import { OracleJdbcDriver } from './OracleJdbcDriver';

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
	connectionWaitTime: number;
	connectionBorrowTime: number;
	cumulativeConnectionBorrowTime: number;
	cumulativeConnectionReturnTime: number;
	averageConnectionWaitTime: number;
	maxConnectionWaitTime: number;

	// Advanced metrics
	averageConnectionBorrowTime: number;
	maxConnectionBorrowTime: number;
	connectionLeaks: number;
	validationErrors: number;
	racFailovers: number;
	poolHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
	lastHealthCheck: Date;
	connectionRequestsCount: number;
}

export interface UcpConnectionLabel {
	[key: string]: string;
}

export interface RacFailoverEvent {
	timestamp: Date;
	fromNode: string;
	toNode: string;
	reason: string;
	duration: number;
}

export interface EnterprisePoolHealth {
	isHealthy: boolean;
	score: number; // 0-100
	issues: string[];
	warnings: string[];
	recommendations: string[];
	racStatus?: {
		activeNodes: number;
		totalNodes: number;
		recentFailovers: RacFailoverEvent[];
	};
}

export class EnterpriseConnectionPool {
	private poolId: string;
	private dataSource: any;
	private config: OracleJdbcConfig;
	private poolConfig: AdvancedPoolConfiguration;
	private isInitialized = false;
	private isShuttingDown = false;
	private poolManager: any;
	private statsMonitor?: NodeJS.Timeout;

	// Connection tracking
	private activeConnections = new Map<string, { borrowed: Date; labels?: ConnectionLabel }>();
	//private statistics: PoolStatistics; //erro aqui Property 'statistics' has no initializer and is not definitely assigned in the constructor.ts(2564) (property) EnterpriseConnectionPool.statistics: PoolStatistics
	private statistics: PoolStatistics = EnterpriseConnectionPool.createInitialStatistics();

	// RAC support
	private racFailoverEvents: RacFailoverEvent[] = [];
	private lastFailoverCheck = new Date();

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
			fastConnectionFailoverEnabled: true,
			connectionRetryAttempts: 3,
			connectionRetryDelayMs: 1000,
			enableConnectionHealthCheck: true,
			connectionTestQuery: 'SELECT 1 FROM dual',
			statsIntervalSeconds: 60,
			...poolConfig,
		};

		this.initializeStatistics();
	}

	private static createInitialStatistics(): PoolStatistics {
		const stats = {
			poolName: '',
			poolId: '',

			totalConnections: 0,
			availableConnections: 0,
			borrowedConnections: 0,
			peakConnections: 0,
			connectionsCreated: 0,
			connectionsClosed: 0,
			failedConnections: 0,

			// tempos/esperas
			connectionWaitTime: 0,
			connectionBorrowTime: 0,
			cumulativeConnectionBorrowTime: 0,
			cumulativeConnectionReturnTime: 0,
			averageConnectionWaitTime: 0,
			maxConnectionWaitTime: 0,

			// métricas avançadas
			averageConnectionBorrowTime: 0,
			maxConnectionBorrowTime: 0,
			connectionLeaks: 0,
			validationErrors: 0,
			racFailovers: 0,

			poolHealth: 'HEALTHY' as const,
			lastHealthCheck: new Date(),

			// contadores
			connectionRequestsCount: 0,
		};

		return stats;
	}

	private initializeStatistics(): void {
		this.statistics.poolId = this.poolId;
		// Se tiver um nome configurado depois, atualize:
		// this.statistics.poolName = `EnterprisePool_${this.poolId}`;
		this.statistics.lastHealthCheck = new Date();
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		const errorContext: ErrorContext = {
			operation: 'initializeEnterprisePool',
			poolId: this.poolId,
		};

		try {
			// Ensure Oracle driver is loaded
			await OracleJdbcDriver.initialize();

			// Create Universal Connection Pool Manager
			const UniversalConnectionPoolManagerImpl = java.javaImport(
				'oracle.ucp.admin.UniversalConnectionPoolManagerImpl',
			);
			this.poolManager = await UniversalConnectionPoolManagerImpl.getInstance();

			// Create Pool Data Source
			const PoolDataSourceFactory = java.javaImport('oracle.ucp.jdbc.PoolDataSourceFactory');
			this.dataSource = await PoolDataSourceFactory.getPoolDataSource();

			// Configure connection URL (with RAC support if enabled)
			const connectionUrl = this.buildAdvancedConnectionUrl();
			await this.dataSource.setURL(connectionUrl);
			await this.dataSource.setUser(this.config.username);
			await this.dataSource.setPassword(this.config.password);

			// Apply basic pool configuration
			await this.applyBasicPoolConfiguration();

			// Apply advanced configuration
			await this.applyAdvancedConfiguration();

			// Configure Oracle-specific properties
			await this.applyOracleSpecificProperties();

			// Setup pool name
			const poolName = `EnterprisePool_${this.poolId}`;
			await this.dataSource.setConnectionPoolName(poolName);
			this.statistics.poolName = poolName;

			// Register pool with manager
			await this.poolManager.createConnectionPool(this.dataSource);

			// Start monitoring if enabled
			if (this.poolConfig.statsIntervalSeconds) {
				this.startStatsMonitoring();
			}

			this.isInitialized = true;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(
				error,
				'Failed to initialize enterprise connection pool',
				errorContext,
			);
		}
	}

	async getConnection(
		connectionLabels?: ConnectionLabel,
		options: QueryOptions = {},
	): Promise<JdbcConnection> {
		await this.initialize();

		if (this.isShuttingDown) {
			throw new Error('Connection pool is shutting down');
		}

		const connectionId = uuidv4();
		const errorContext: ErrorContext = {
			operation: 'getEnterpriseConnection',
			poolId: this.poolId,
			connectionId,
		};

		const startTime = Date.now();

		try {
			let connection;

			// Apply timeout if specified
			let originalTimeout;
			if (options.timeout) {
				originalTimeout = await this.dataSource.getConnectionWaitTimeout();
				await this.dataSource.setConnectionWaitTimeout(options.timeout);
			}

			if (connectionLabels && this.poolConfig.enableConnectionLabeling) {
				// Use connection labeling for session affinity
				connection = await this.dataSource.getConnection(connectionLabels);
			} else {
				connection = await this.dataSource.getConnection();
			}

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
				labels: connectionLabels ? [connectionLabels] : undefined,
			};

			// Track active connection
			this.activeConnections.set(connectionId, {
				borrowed: new Date(),
				labels: connectionLabels,
			});

			// Update statistics
			this.updateConnectionStatistics('borrowed', Date.now() - startTime);

			return jdbcConnection;
		} catch (error) {
			this.updateConnectionStatistics('failed');
			throw ErrorHandler.handleJdbcError(
				error,
				'Failed to get connection from enterprise pool',
				errorContext,
			);
		}
	}

	async getConnectionWithRetry(
		maxRetries = 3,
		retryDelayMs = 1000,
		connectionLabels?: ConnectionLabel,
	): Promise<JdbcConnection> {
		let lastError: Error;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await this.getConnection(connectionLabels);
			} catch (error) {
				lastError = error as Error;

				// Check if error is retryable
				if (attempt < maxRetries && ErrorHandler.isRetryableError(error)) {
					const message = error instanceof Error ? error.message : String(error);

					console.warn(`Connection attempt ${attempt} failed, retrying in ${retryDelayMs}ms...`, {
						error: message,
						poolId: this.poolId,
						attempt,
					});

					await new Promise(resolve => setTimeout(resolve, retryDelayMs));
					retryDelayMs *= 1.5; // Exponential backoff
				} else {
					break;
				}
			}
		}

		throw lastError!;
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
		const errorContext: ErrorContext = {
			operation: 'returnEnterpriseConnection',
			poolId: this.poolId,
			connectionId: connection.id,
		};

		try {
			if (labels && this.poolConfig.enableConnectionLabeling) {
				// Apply labels before returning to pool
				const labelableConn = connection.connection;

				try {
					for (const [key, value] of Object.entries(labels)) {
						await labelableConn.applyConnectionLabel(key, value);
					}
				} catch (labelError) {
					console.warn('Failed to apply connection labels:', labelError);
				}
			}

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
				'Failed to return connection to enterprise pool',
				errorContext,
			);
		}
	}

	async getPoolStatistics(): Promise<PoolStatistics> {
		if (!this.isInitialized) {
			return this.statistics;
		}

		try {
			const poolName = await this.dataSource.getConnectionPoolName();
			const ucpManager = await this.poolManager.getUniversalConnectionPool(poolName);

			// Get basic UCP statistics
			const totalConnections = await ucpManager.getTotalConnectionsCount();
			const availableConnections = await ucpManager.getAvailableConnectionsCount();
			const borrowedConnections = await ucpManager.getBorrowedConnectionsCount();
			const peakConnections = await ucpManager.getPeakConnectionsCount();
			const connectionsCreated = await ucpManager.getConnectionsCreatedCount();
			const connectionsClosed = await ucpManager.getConnectionsClosedCount();
			const failedConnections = await ucpManager.getFailedConnectionsCount();
			const connectionWaitTime = await ucpManager.getCumulativeConnectionWaitTime();
			const connectionBorrowTime = await ucpManager.getCumulativeConnectionBorrowTime();
			const cumulativeConnectionBorrowTime = await ucpManager.getCumulativeConnectionBorrowTime();
			const cumulativeConnectionReturnTime = await ucpManager.getCumulativeConnectionReturnTime();

			// Calculate advanced metrics
			const connectionLeaks = this.detectConnectionLeaks();
			const racFailovers = this.racFailoverEvents.length;

			// Calculate average borrow time
			const averageConnectionBorrowTime =
				connectionsCreated > 0 ? cumulativeConnectionBorrowTime / connectionsCreated : 0;

			// Determine pool health
			let poolHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';

			if (availableConnections === 0 && borrowedConnections >= totalConnections) {
				poolHealth = 'CRITICAL';
			} else if (connectionLeaks > 0 || availableConnections < totalConnections * 0.2) {
				poolHealth = 'WARNING';
			}

			this.statistics = {
				...this.statistics,
				poolName,
				totalConnections,
				availableConnections,
				borrowedConnections,
				peakConnections,
				connectionsCreated,
				connectionsClosed,
				failedConnections,
				connectionWaitTime,
				connectionBorrowTime,
				cumulativeConnectionBorrowTime,
				cumulativeConnectionReturnTime,
				averageConnectionBorrowTime,
				connectionLeaks,
				racFailovers,
				poolHealth,
				lastHealthCheck: new Date(),
			};

			return this.statistics;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to get enterprise pool statistics');
		}
	}

	async performHealthCheck(): Promise<EnterprisePoolHealth> {
		const issues: string[] = [];
		const warnings: string[] = [];
		const recommendations: string[] = [];
		let score = 100;

		try {
			const stats = await this.getPoolStatistics();

			// Check connection availability
			if (stats.availableConnections === 0) {
				if (stats.borrowedConnections >= stats.totalConnections) {
					issues.push('Pool exhausted - no available connections');
					score -= 30;
					recommendations.push('Consider increasing maxPoolSize');
				}
			}

			// Check for connection leaks
			if (stats.connectionLeaks > 0) {
				issues.push(`${stats.connectionLeaks} potential connection leaks detected`);
				score -= 20;
				recommendations.push('Review connection usage and ensure proper closing');
			}

			// Check pool utilization
			const utilizationPercent = (stats.borrowedConnections / stats.totalConnections) * 100;
			if (utilizationPercent > 90) {
				warnings.push(`High pool utilization: ${utilizationPercent.toFixed(1)}%`);
				score -= 10;
				recommendations.push('Consider increasing pool size for better performance');
			}

			// Check validation errors
			if (stats.validationErrors > 0) {
				warnings.push(`${stats.validationErrors} validation errors detected`);
				score -= 10;
				recommendations.push('Check database connectivity and validation query');
			}

			// Check average connection borrow time
			if (stats.averageConnectionBorrowTime > 5000) {
				// > 5 seconds
				warnings.push(
					`High average connection borrow time: ${stats.averageConnectionBorrowTime.toFixed(0)}ms`,
				);
				score -= 10;
				recommendations.push('Consider tuning connection pool parameters');
			}

			// RAC-specific health checks
			let racStatus;
			if (this.poolConfig.enableRacSupport && this.poolConfig.racNodes) {
				const activeNodes = await this.checkRacNodeHealth();
				const totalNodes = this.poolConfig.racNodes.length;
				const recentFailovers = this.getRecentFailoverEvents();

				racStatus = {
					activeNodes,
					totalNodes,
					recentFailovers,
				};

				if (activeNodes < totalNodes) {
					if (activeNodes === 0) {
						issues.push('All RAC nodes are down');
						score -= 50;
					} else {
						warnings.push(`${totalNodes - activeNodes} RAC node(s) down`);
						score -= 15;
						recommendations.push('Check RAC node connectivity and health');
					}
				}

				if (recentFailovers.length > 5) {
					warnings.push(`${recentFailovers.length} recent RAC failovers detected`);
					score -= 10;
					recommendations.push('Investigate RAC stability issues');
				}
			}

			return {
				isHealthy: issues.length === 0,
				score: Math.max(0, score),
				issues,
				warnings,
				recommendations,
				racStatus,
			};
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);

			issues.push(`Health check failed: ${message}`);
			return {
				isHealthy: false,
				score: 0,
				issues,
				warnings,
				recommendations,
			};
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
		if (!this.isInitialized) {
			return;
		}

		this.isShuttingDown = true;

		try {
			// Stop monitoring
			if (this.statsMonitor) {
				clearInterval(this.statsMonitor);
				this.statsMonitor = undefined;
			}

			// Stop and destroy pool
			await this.stopConnectionPool();

			const poolName = await this.dataSource.getConnectionPoolName();
			await this.poolManager.destroyConnectionPool(poolName);

			this.isInitialized = false;
			this.isShuttingDown = false;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to close enterprise connection pool');
		}
	}

	// Private configuration methods
	private buildAdvancedConnectionUrl(): string {
		if (this.poolConfig.enableRacSupport && this.poolConfig.racNodes) {
			return this.buildRacConnectionUrl();
		}

		// Standard connection URL
		return OracleJdbcDriver.buildConnectionString(this.config);
	}

	private buildRacConnectionUrl(): string {
		const racNodes = this.poolConfig.racNodes!;
		const sortedNodes = racNodes.sort((a, b) => (a.priority || 999) - (b.priority || 999));

		const addressList = sortedNodes
			.map(node => `(ADDRESS=(PROTOCOL=TCP)(HOST=${node.host})(PORT=${node.port}))`)
			.join('');

		const serviceName = this.config.serviceName || this.config.sid;
		const failoverType = this.poolConfig.oracleRacFailoverType || 'SELECT';

		return `jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS_LIST=${addressList})(CONNECT_DATA=(SERVICE_NAME=${serviceName})(FAILOVER_MODE=(TYPE=${failoverType})(METHOD=BASIC)(RETRIES=3)(DELAY=5))))`;
	}

	private async applyBasicPoolConfiguration(): Promise<void> {
		await this.dataSource.setInitialPoolSize(this.poolConfig.initialPoolSize!);
		await this.dataSource.setMinPoolSize(this.poolConfig.minPoolSize!);
		await this.dataSource.setMaxPoolSize(this.poolConfig.maxPoolSize!);
		await this.dataSource.setConnectionWaitTimeout(this.poolConfig.connectionWaitTimeout!);
		await this.dataSource.setInactiveConnectionTimeout(this.poolConfig.inactiveConnectionTimeout!);
		await this.dataSource.setValidateConnectionOnBorrow(
			this.poolConfig.validateConnectionOnBorrow!,
		);
		await this.dataSource.setMaxConnectionReuseTime(this.poolConfig.maxConnectionReuseTime!);
		await this.dataSource.setConnectionCreationRetryDelay(
			this.poolConfig.connectionCreationRetryDelay!,
		);
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
		await this.dataSource.setConnectionProperty(
			'oracle.jdbc.implicitStatementCacheSize',
			(this.poolConfig.maxStatements || 50).toString(),
		);
		await this.dataSource.setConnectionProperty('oracle.jdbc.autoCommitSpecCompliant', 'false');
		await this.dataSource.setConnectionProperty('oracle.net.keepAlive', 'true');
		await this.dataSource.setConnectionProperty('oracle.jdbc.ReadTimeout', '30000');

		// Performance tuning
		await this.dataSource.setConnectionProperty('oracle.jdbc.defaultRowPrefetch', '20');
		await this.dataSource.setConnectionProperty('oracle.jdbc.defaultBatchValue', '15');

		// Fast Connection Failover
		if (this.poolConfig.fastConnectionFailoverEnabled) {
			await this.dataSource.setFastConnectionFailoverEnabled(true);
		}

		// Connection labeling
		if (this.poolConfig.enableConnectionLabeling) {
			await this.dataSource.setConnectionProperty('oracle.ucp.connectionLabelingHighCost', '10');
		}
	}

	private startStatsMonitoring(): void {
		const intervalMs = this.poolConfig.statsIntervalSeconds! * 1000;

		this.statsMonitor = setInterval(async () => {
			try {
				const stats = await this.getPoolStatistics();

				// Log critical issues
				if (stats.poolHealth === 'CRITICAL') {
					console.error(`CRITICAL: Enterprise pool ${stats.poolName} is unhealthy:`, {
						available: stats.availableConnections,
						borrowed: stats.borrowedConnections,
						total: stats.totalConnections,
						leaks: stats.connectionLeaks,
					});
				}

				// Log connection leaks
				if (stats.connectionLeaks > 0) {
					console.warn(
						`Enterprise pool ${stats.poolName} has ${stats.connectionLeaks} potential connection leaks`,
					);
				}

				// Log RAC failovers
				if (stats.racFailovers > 0) {
					console.info(`RAC failovers detected: ${stats.racFailovers}`);
				}
			} catch (error) {
				console.error('Enterprise pool monitoring error:', error);
			}
		}, intervalMs);
	}

	private detectConnectionLeaks(): number {
		let leakCount = 0;
		const now = Date.now();
		const leakThreshold = (this.poolConfig.abandonedConnectionTimeout || 300) * 1000;

		for (const [connectionId, connectionInfo] of this.activeConnections) {
			if (now - connectionInfo.borrowed.getTime() > leakThreshold) {
				leakCount++;
				console.warn(
					`Potential connection leak detected: ${connectionId}, borrowed ${Math.floor((now - connectionInfo.borrowed.getTime()) / 1000)}s ago`,
				);
			}
		}

		return leakCount;
	}

	private async checkRacNodeHealth(): Promise<number> {
		if (!this.poolConfig.racNodes) {
			return 0;
		}

		let activeNodes = 0;

		for (const node of this.poolConfig.racNodes) {
			try {
				// Simple connectivity test to each RAC node
				const testConfig: OracleJdbcConfig = {
					...this.config,
					host: node.host,
					port: node.port,
				};

				const isHealthy = await OracleJdbcDriver.testConnection(testConfig);
				if (isHealthy) {
					activeNodes++;
				}
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);

				console.warn(`RAC node ${node.host}:${node.port} health check failed:`, message);
			}
		}

		return activeNodes;
	}

	private getRecentFailoverEvents(): RacFailoverEvent[] {
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
		return this.racFailoverEvents.filter(event => event.timestamp >= oneDayAgo);
	}

	private updateConnectionStatistics(
		operation: 'borrowed' | 'returned' | 'failed',
		waitTime?: number,
	): void {
		switch (operation) {
			case 'borrowed':
				if (waitTime) {
					this.statistics.maxConnectionBorrowTime = Math.max(
						this.statistics.maxConnectionBorrowTime,
						waitTime,
					);
				}
				break;
			case 'failed':
				// Could add additional failure tracking
				break;
		}
	}

	// Getters
	getPoolId(): string {
		return this.poolId;
	}

	getConfiguration(): AdvancedPoolConfiguration {
		return { ...this.poolConfig };
	}

	isPoolInitialized(): boolean {
		return this.isInitialized;
	}

	getActiveConnectionsCount(): number {
		return this.activeConnections.size;
	}

	getRacFailoverEvents(): RacFailoverEvent[] {
		return [...this.racFailoverEvents];
	}
}
