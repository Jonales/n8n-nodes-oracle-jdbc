
/**
 * Oracle para n8n-nodes-oracle-jdbc
 * Suporte para modo JDBC
 *
 * @author Jônatas Meireles Sousa Vieira
 * @version 0.0.1-rc.1
 */

import { JdbcConnection, OracleJdbcConfig } from '../types/JdbcTypes';

import { ErrorContext, ErrorHandler } from '../utils/ErrorHandler';

import {
	AdvancedPoolConfiguration,
	PoolConfigurationPresets,
	RacNodeConfig,
} from './AdvancedPoolConfig';
import { ConnectionPool, PoolConfiguration } from './ConnectionPool';
import {
	EnterpriseConnectionPool,
	EnterprisePoolHealth,
	PoolStatistics,
} from './EnterpriseConnectionPool';

export interface ManagedPool {
	poolId: string;
	name: string;
	type: 'basic' | 'enterprise';
	pool: ConnectionPool | EnterpriseConnectionPool;
	config: OracleJdbcConfig;
	poolConfig: PoolConfiguration | AdvancedPoolConfiguration;
	createdAt: Date;
	lastHealthCheck?: Date;
	isActive: boolean;
	tags?: string[];
	description?: string;
}

export interface PoolManagerStatistics {
	totalPools: number;
	activePools: number;
	inactivePools: number;
	healthyPools: number;
	unhealthyPools: number;
	totalConnections: number;
	totalAvailableConnections: number;
	totalBorrowedConnections: number;
	poolTypes: {
		basic: number;
		enterprise: number;
	};
	lastUpdateTime: Date;
}

export interface PoolHealthSummary {
	poolName: string;
	poolId: string;
	type: 'basic' | 'enterprise';
	isHealthy: boolean;
	healthScore?: number;
	issues: string[];
	warnings: string[];
	lastCheck: Date;
	connectionStats: {
		total: number;
		available: number;
		borrowed: number;
		peak: number;
	};
}

export interface PoolOperationOptions {
	timeout?: number;
	retryAttempts?: number;
	failFast?: boolean;
}

export class PoolManager {
	private static instance: PoolManager;
	private pools = new Map<string, ManagedPool>();
	private healthMonitorInterval?: NodeJS.Timeout;		
	private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

	private constructor() {
		// Start health monitoring
		this.startHealthMonitoring();
	}

	public static getInstance(): PoolManager {
		if (!PoolManager.instance) {
			PoolManager.instance = new PoolManager();
		}
		return PoolManager.instance;
	}

	async createPool(
		poolName: string,
		config: OracleJdbcConfig,
		poolConfig: AdvancedPoolConfiguration = {},
		options: {
			type?: 'basic' | 'enterprise';
			tags?: string[];
			description?: string;
		} = {},
	): Promise<string> {
		const errorContext: ErrorContext = {
			operation: 'createPool',
			poolName,
		};

		try {
			if (this.pools.has(poolName)) {
				throw new Error(`Pool ${poolName} already exists`);
			}

			const { type = 'enterprise', tags, description } = options;
			let pool: ConnectionPool | EnterpriseConnectionPool;
			let poolId: string;

			if (type === 'enterprise') {
				const enterprisePool = new EnterpriseConnectionPool(config, poolConfig);
				await enterprisePool.initialize();
				pool = enterprisePool;
				poolId = enterprisePool.getPoolId();
			} else {
				const basicPool = new ConnectionPool(config, poolConfig);
				await basicPool.initialize();
				pool = basicPool;
				poolId = basicPool.getPoolId();
			}

			const managedPool: ManagedPool = {
				poolId,
				name: poolName,
				type,
				pool,
				config,
				poolConfig,
				createdAt: new Date(),
				isActive: true,
				tags,
				description,
			};

			this.pools.set(poolName, managedPool);

			console.info(`Pool ${poolName} created successfully`, {
				poolId,
				type,
				tags,
				description,
			});

			return poolId;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, `Failed to create pool: ${poolName}`, errorContext);
		}
	}

	async createHighVolumeOLTPPool(
		poolName: string,
		config: OracleJdbcConfig,
		options: { tags?: string[]; description?: string } = {},
	): Promise<string> {
		return this.createPool(poolName, config, PoolConfigurationPresets.getHighVolumeOLTP(), {
			type: 'enterprise',
			tags: ['oltp', 'high-volume', ...(options.tags || [])],
			description: options.description || 'High Volume OLTP Pool',
		});
	}

	async createAnalyticsPool(
		poolName: string,
		config: OracleJdbcConfig,
		options: { tags?: string[]; description?: string } = {},
	): Promise<string> {
		return this.createPool(poolName, config, PoolConfigurationPresets.getAnalyticsWorkload(), {
			type: 'enterprise',
			tags: ['analytics', 'long-running', ...(options.tags || [])],
			description: options.description || 'Analytics Workload Pool',
		});
	}

	async createOracleCloudPool(
		poolName: string,
		config: OracleJdbcConfig,
		options: { tags?: string[]; description?: string } = {},
	): Promise<string> {
		return this.createPool(poolName, config, PoolConfigurationPresets.getOracleCloudConfig(), {
			type: 'enterprise',
			tags: ['cloud', 'oci', 'ssl', ...(options.tags || [])],
			description: options.description || 'Oracle Cloud Infrastructure Pool',
		});
	}

	async createOracleRacPool(
		poolName: string,
		config: OracleJdbcConfig,
		racNodes: RacNodeConfig[],
		options: { tags?: string[]; description?: string } = {},
	): Promise<string> {
		return this.createPool(
			poolName,
			config,
			PoolConfigurationPresets.getOracleRacConfig(racNodes),
			{
				type: 'enterprise',
				tags: ['rac', 'high-availability', 'failover', ...(options.tags || [])],
				description: options.description || 'Oracle RAC Pool with Failover',
			},
		);
	}

	getPool(poolName: string): ConnectionPool | EnterpriseConnectionPool {
		const managedPool = this.pools.get(poolName);
		if (!managedPool) {
			throw new Error(`Pool ${poolName} not found`);
		}

		if (!managedPool.isActive) {
			throw new Error(`Pool ${poolName} is not active`);
		}

		return managedPool.pool;
	}

	getManagedPool(poolName: string): ManagedPool {
		const managedPool = this.pools.get(poolName);
		if (!managedPool) {
			throw new Error(`Pool ${poolName} not found`);
		}
		return managedPool;
	}

	async getPoolStatistics(poolName: string): Promise<PoolStatistics> {
		const managedPool = this.getManagedPool(poolName);

		if (managedPool.type === 'enterprise') {
			const enterprisePool = managedPool.pool as EnterpriseConnectionPool;
			return enterprisePool.getPoolStatistics();
		} else {
			const basicPool = managedPool.pool as ConnectionPool;
			const stats = await basicPool.getPoolStatistics();

			if (!stats) {
				throw new Error(`Unable to retrieve statistics for pool ${poolName}`);
			}

			// Convert basic pool stats to PoolStatistics format
			return {
				poolName: stats.poolName,
				poolId: managedPool.poolId,
				totalConnections: stats.totalConnections,
				availableConnections: stats.availableConnections,
				borrowedConnections: stats.borrowedConnections,
				peakConnections: stats.peakConnections,
				connectionsCreated: stats.connectionsCreated,
				connectionsClosed: stats.connectionsClosed,
				failedConnections: stats.failedConnections,
				connectionWaitTime: 0,
				connectionBorrowTime: 0,
				cumulativeConnectionBorrowTime: 0,
				cumulativeConnectionReturnTime: 0,
				averageConnectionBorrowTime: 0,
				maxConnectionBorrowTime: 0,
				connectionLeaks: 0,
				validationErrors: 0,
				racFailovers: 0,
				poolHealth: 'HEALTHY',
				lastHealthCheck: new Date(),
				averageConnectionWaitTime: 0,
				maxConnectionWaitTime: 0,
				connectionRequestsCount: 0,
			};
		}
	}

	async getAllPoolStatistics(): Promise<{ [poolName: string]: PoolStatistics }> {
		const stats: { [poolName: string]: PoolStatistics } = {};

		const promises = Array.from(this.pools.entries()).map(async ([poolName, managedPool]) => {
			try {
				if (managedPool.isActive) {
					stats[poolName] = await this.getPoolStatistics(poolName);
				}
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`Failed to get stats for pool ${poolName}:`, message);
			}
		});

		await Promise.all(promises);
		return stats;
	}

	async getManagerStatistics(): Promise<PoolManagerStatistics> {
		const allStats = await this.getAllPoolStatistics();

		let totalConnections = 0;
		let totalAvailableConnections = 0;
		let totalBorrowedConnections = 0;
		let healthyPools = 0;
		let unhealthyPools = 0;
		let basicPools = 0;
		let enterprisePools = 0;

		for (const [poolName, stats] of Object.entries(allStats)) {
			const managedPool = this.pools.get(poolName);
			if (managedPool) {
				totalConnections += stats.totalConnections;
				totalAvailableConnections += stats.availableConnections;
				totalBorrowedConnections += stats.borrowedConnections;

				if (stats.poolHealth === 'HEALTHY') {
					healthyPools++;
				} else {
					unhealthyPools++;
				}

				if (managedPool.type === 'basic') {
					basicPools++;
				} else {
					enterprisePools++;
				}
			}
		}

		const activePools = Array.from(this.pools.values()).filter(p => p.isActive).length;
		const inactivePools = this.pools.size - activePools;

		return {
			totalPools: this.pools.size,
			activePools,
			inactivePools,
			healthyPools,
			unhealthyPools,
			totalConnections,
			totalAvailableConnections,
			totalBorrowedConnections,
			poolTypes: {
				basic: basicPools,
				enterprise: enterprisePools,
			},
			lastUpdateTime: new Date(),
		};
	}

	async getConnection(
		poolName: string,
		options: PoolOperationOptions = {},
	): Promise<JdbcConnection> {
		const managedPool = this.getManagedPool(poolName);
		const { timeout, retryAttempts = 3, failFast = false } = options;

		if (managedPool.type === 'enterprise') {
			const enterprisePool = managedPool.pool as EnterpriseConnectionPool;

			if (retryAttempts > 1 && !failFast) {
				return enterprisePool.getConnectionWithRetry(retryAttempts, 1000);
			} else {
				return enterprisePool.getConnection(undefined, { timeout }); 
			}
		} else {
			const basicPool = managedPool.pool as ConnectionPool;
			return basicPool.getConnection({ timeout }); 
		}
	}

	async performHealthCheck(poolName?: string): Promise<PoolHealthSummary[]> {
		const poolsToCheck = poolName
			? [this.getManagedPool(poolName)]
			: Array.from(this.pools.values()).filter(p => p.isActive);

		const healthSummaries: PoolHealthSummary[] = [];

		for (const managedPool of poolsToCheck) {
			try {
				let isHealthy = true;
				let healthScore: number | undefined;
				let issues: string[] = [];
				let warnings: string[] = [];
				let connectionStats = {
					total: 0,
					available: 0,
					borrowed: 0,
					peak: 0,
				};

				if (managedPool.type === 'enterprise') {
					const enterprisePool = managedPool.pool as EnterpriseConnectionPool;
					const healthCheck = await enterprisePool.performHealthCheck();

					isHealthy = healthCheck.isHealthy;
					healthScore = healthCheck.score;
					issues = healthCheck.issues;
					warnings = healthCheck.warnings;

					const stats = await enterprisePool.getPoolStatistics();
					connectionStats = {
						total: stats.totalConnections,
						available: stats.availableConnections,
						borrowed: stats.borrowedConnections,
						peak: stats.peakConnections,
					};
				} else {
					// Basic pool health check
					const basicPool = managedPool.pool as ConnectionPool;
					const stats = await basicPool.getPoolStatistics();

					if (stats) {
						connectionStats = {
							total: stats.totalConnections,
							available: stats.availableConnections,
							borrowed: stats.borrowedConnections,
							peak: stats.peakConnections,
						};

						// Simple health check for basic pools
						if (
							stats.availableConnections === 0 &&
							stats.borrowedConnections >= stats.totalConnections
						) {
							isHealthy = false;
							issues.push('Pool exhausted - no available connections');
						}
					} else {
						isHealthy = false;
						issues.push('Unable to retrieve pool statistics');
					}
				}

				managedPool.lastHealthCheck = new Date();

				healthSummaries.push({
					poolName: managedPool.name,
					poolId: managedPool.poolId,
					type: managedPool.type,
					isHealthy,
					healthScore,
					issues,
					warnings,
					lastCheck: managedPool.lastHealthCheck,
					connectionStats,
				});
				} catch (error: unknown) {
					const message = error instanceof Error ? error.message : String(error);

					healthSummaries.push({
						poolName: managedPool.name,
						poolId: managedPool.poolId,
						type: managedPool.type,
						isHealthy: false,
						issues: [`Health check failed: ${message}`],
						warnings: [],
						lastCheck: new Date(),
						connectionStats: {
							total: 0,
							available: 0,
							borrowed: 0,
							peak: 0,
						},
					});
				}
		}

		return healthSummaries;
	}

	async refreshPool(poolName: string): Promise<void> {
		const managedPool = this.getManagedPool(poolName);

		if (managedPool.type === 'enterprise') {
			const enterprisePool = managedPool.pool as EnterpriseConnectionPool;
			await enterprisePool.refreshPool();
		} else {
			// Basic pools don't have refresh capability
			console.warn(`Refresh operation not supported for basic pool: ${poolName}`);
		}
	}

	async purgePool(poolName: string): Promise<void> {
		const managedPool = this.getManagedPool(poolName);

		if (managedPool.type === 'enterprise') {
			const enterprisePool = managedPool.pool as EnterpriseConnectionPool;
			await enterprisePool.purgePool();
		} else {
			console.warn(`Purge operation not supported for basic pool: ${poolName}`);
		}
	}

	async closePool(poolName: string): Promise<void> {
		const managedPool = this.pools.get(poolName);
		if (managedPool) {
			try {
				await managedPool.pool.close();
				managedPool.isActive = false;
				this.pools.delete(poolName);

				console.info(`Pool ${poolName} closed successfully`);
			} catch (error) {
				throw ErrorHandler.handleJdbcError(error, `Failed to close pool: ${poolName}`);
			}
		}
	}

	async closeAllPools(): Promise<void> {
		const closePromises = Array.from(this.pools.keys()).map(async poolName => {
			try {
				await this.closePool(poolName);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`Failed to close pool ${poolName}:`, message);
			}
		});

		await Promise.all(closePromises);
		console.info('All pools closed');
	}

	// Pool discovery and filtering
	findPoolsByTag(tag: string): ManagedPool[] {
		return Array.from(this.pools.values()).filter(pool => pool.tags && pool.tags.includes(tag));
	}

	findPoolsByType(type: 'basic' | 'enterprise'): ManagedPool[] {
		return Array.from(this.pools.values()).filter(pool => pool.type === type);
	}

	getPoolsByHealth(healthy: boolean): Promise<string[]> {
		return this.performHealthCheck().then(summaries =>
			summaries.filter(summary => summary.isHealthy === healthy).map(summary => summary.poolName),
		);
	}

	listPools(): string[] {
		return Array.from(this.pools.keys());
	}

	listActivePools(): string[] {
		return Array.from(this.pools.values())
			.filter(pool => pool.isActive)
			.map(pool => pool.name);
	}

	getPoolCount(): number {
		return this.pools.size;
	}

	getActivePoolCount(): number {
		return Array.from(this.pools.values()).filter(pool => pool.isActive).length;
	}

	// Pool lifecycle management
	async restartPool(poolName: string): Promise<string> {
		const managedPool = this.getManagedPool(poolName);

		// Store configuration
		const { config, poolConfig, type, tags, description } = managedPool;

		// Close existing pool
		await this.closePool(poolName);

		// Create new pool with same configuration
		return this.createPool(poolName, config, poolConfig, { type, tags, description });
	}

	async scalePool(poolName: string, newMaxSize: number): Promise<void> {
		const managedPool = this.getManagedPool(poolName);

		// Update pool configuration
		if (managedPool.type === 'enterprise') {
			const enterprisePool = managedPool.pool as EnterpriseConnectionPool;
			const currentConfig = enterprisePool.getConfiguration();

			// This would require pool reconfiguration functionality
			// For now, we'll suggest a restart with new configuration
			throw new Error('Pool scaling requires restart. Use restartPool with updated configuration.');
		} else {
			throw new Error('Basic pools do not support runtime scaling');
		}
	}

	// Health monitoring
	private startHealthMonitoring(): void {
		this.healthMonitorInterval = setInterval(async () => {
			try {
				const healthSummaries = await this.performHealthCheck();

				const unhealthyPools = healthSummaries.filter(summary => !summary.isHealthy);

				if (unhealthyPools.length > 0) {
					console.warn(
						`Health check found ${unhealthyPools.length} unhealthy pools:`,
						unhealthyPools.map(p => ({ name: p.poolName, issues: p.issues })),
					);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error('Health monitoring failed:', message);
			}
		}, this.HEALTH_CHECK_INTERVAL);
	}

	public async shutdown(): Promise<void> {
		// Stop health monitoring
		if (this.healthMonitorInterval) {
			clearInterval(this.healthMonitorInterval);
			this.healthMonitorInterval = undefined;
		}

		// Close all pools (sua lógica)
		await this.closeAllPools();

		console.info('PoolManager shutdown complete');
	}

	// Utility methods
	getPoolInfo(poolName: string): {
		pool: ManagedPool;
		runtime: {
			uptimeMs: number;
			lastHealthCheck?: Date;
		};
	} {
		const pool = this.getManagedPool(poolName);

		return {
			pool,
			runtime: {
				uptimeMs: Date.now() - pool.createdAt.getTime(),
				lastHealthCheck: pool.lastHealthCheck,
			},
		};
	}

	async exportPoolConfigurations(): Promise<{
		[poolName: string]: {
			config: OracleJdbcConfig;
			poolConfig: PoolConfiguration | AdvancedPoolConfiguration;
			type: 'basic' | 'enterprise';
			tags?: string[];
			description?: string;
		};
	}> {
		const configurations: any = {};

		for (const [poolName, managedPool] of this.pools) {
			configurations[poolName] = {
				config: managedPool.config,
				poolConfig: managedPool.poolConfig,
				type: managedPool.type,
				tags: managedPool.tags,
				description: managedPool.description,
			};
		}

		return configurations;
	}
}
