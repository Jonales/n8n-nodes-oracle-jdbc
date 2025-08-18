import * as java from 'node-java-bridge';
import { v4 as uuidv4 } from 'uuid';

import { JdbcConnection, OracleJdbcConfig, QueryOptions, QueryResult } from '../types/JdbcTypes';

import { ErrorContext, ErrorHandler } from '../utils/ErrorHandler';

import { AdvancedPoolConfiguration } from './AdvancedPoolConfig';
import { ConnectionPool, PoolConfiguration } from './ConnectionPool';
import { EnterpriseConnectionPool } from './EnterpriseConnectionPool';
import { OracleJdbcDriver } from './OracleJdbcDriver';

export interface ConnectionManagerStatistics {
	totalConnectionsCreated: number;
	totalConnectionsClosed: number;
	activeConnections: number;
	totalPools: number;
	activePools: number;
}

export interface PoolInfo {
	poolId: string;
	poolType: 'basic' | 'enterprise';
	config: OracleJdbcConfig;
	poolConfig: PoolConfiguration | AdvancedPoolConfiguration;
	createdAt: Date;
	isActive: boolean;
}

export class JdbcConnectionManager {
	private static instance: JdbcConnectionManager;
	private initialized = false;

	// Connection pools management
	private connectionPools = new Map<string, ConnectionPool>();
	private enterprisePools = new Map<string, EnterpriseConnectionPool>();
	private poolInfos = new Map<string, PoolInfo>();

	// Statistics tracking
	private statistics: ConnectionManagerStatistics = {
		totalConnectionsCreated: 0,
		totalConnectionsClosed: 0,
		activeConnections: 0,
		totalPools: 0,
		activePools: 0,
	};

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
			// Initialize Oracle JDBC driver
			await OracleJdbcDriver.initialize();
			this.initialized = true;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to initialize JDBC Connection Manager');
		}
	}

	async createConnection(
		config: OracleJdbcConfig,
		options: QueryOptions = {},
	): Promise<JdbcConnection> {
		await this.initialize();

		const connectionId = uuidv4();
		const errorContext: ErrorContext = {
			operation: 'createConnection',
			connectionId,
		};

		try {
			const connectionUrl = OracleJdbcDriver.buildConnectionString(config);
			const DriverManager = java.import('java.sql.DriverManager');

			const connection = await DriverManager.getConnection(
				connectionUrl,
				config.username,
				config.password,
			);

			// Configure connection properties
			if (config.connectionOptions?.connectionTimeout) {
				await connection.setNetworkTimeout(null, config.connectionOptions.connectionTimeout * 1000);
			}

			if (config.connectionOptions?.socketTimeout) {
				await connection.setQueryTimeout?.(config.connectionOptions.socketTimeout);
			}

			// Apply query timeout if specified in options
			if (options.timeout) {
				await connection.setNetworkTimeout(null, options.timeout * 1000);
			}

			const jdbcConnection: JdbcConnection = {
				id: connectionId,
				connection,
				config,
				createdAt: new Date(),
				isActive: true,
				isPooled: false,
			};

			// Update statistics
			this.statistics.totalConnectionsCreated++;
			this.statistics.activeConnections++;

			return jdbcConnection;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to create connection', errorContext);
		}
	}

	async createConnectionPool(
		config: OracleJdbcConfig,
		poolConfig: PoolConfiguration = {},
		poolType: 'basic' | 'enterprise' = 'basic',
	): Promise<string> {
		await this.initialize();

		const poolId = uuidv4();
		const errorContext: ErrorContext = {
			operation: 'createConnectionPool',
			poolId,
		};

		try {
			let pool;

			if (poolType === 'enterprise') {
				pool = new EnterpriseConnectionPool(config, poolConfig as AdvancedPoolConfiguration);
				await pool.initialize();
				this.enterprisePools.set(poolId, pool);
			} else {
				pool = new ConnectionPool(config, poolConfig);
				await pool.initialize();
				this.connectionPools.set(poolId, pool);
			}

			// Store pool information
			const poolInfo: PoolInfo = {
				poolId,
				poolType,
				config,
				poolConfig,
				createdAt: new Date(),
				isActive: true,
			};
			this.poolInfos.set(poolId, poolInfo);

			// Update statistics
			this.statistics.totalPools++;
			this.statistics.activePools++;

			return poolId;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to create connection pool', errorContext);
		}
	}

	async getPooledConnection(poolId: string, options: QueryOptions = {}): Promise<JdbcConnection> {
		const poolInfo = this.poolInfos.get(poolId);
		if (!poolInfo) {
			throw new Error(`Connection pool ${poolId} not found`);
		}

		if (!poolInfo.isActive) {
			throw new Error(`Connection pool ${poolId} is not active`);
		}

		const errorContext: ErrorContext = {
			operation: 'getPooledConnection',
			poolId,
		};

		try {
			let connection: JdbcConnection;

			if (poolInfo.poolType === 'enterprise') {
				const pool = this.enterprisePools.get(poolId);
				if (!pool) {
					throw new Error(`Enterprise pool ${poolId} not found`);
				}
				connection = await pool.getConnection(undefined, options);
			} else {
				const pool = this.connectionPools.get(poolId);
				if (!pool) {
					throw new Error(`Basic pool ${poolId} not found`);
				}
				connection = await pool.getConnection(options);
			}

			// Update statistics
			this.statistics.activeConnections++;

			return connection;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to get pooled connection', errorContext);
		}
	}

	async returnPooledConnection(connection: JdbcConnection): Promise<void> {
		if (!connection.isPooled || !connection.poolId) {
			throw new Error('Connection is not from a pool');
		}

		const poolInfo = this.poolInfos.get(connection.poolId);
		if (!poolInfo) {
			throw new Error(`Pool ${connection.poolId} not found`);
		}

		const errorContext: ErrorContext = {
			operation: 'returnPooledConnection',
			poolId: connection.poolId,
			connectionId: connection.id,
		};

		try {
			if (poolInfo.poolType === 'enterprise') {
				const pool = this.enterprisePools.get(connection.poolId);
				if (pool) {
					await pool.returnConnection(connection);
				}
			} else {
				const pool = this.connectionPools.get(connection.poolId);
				if (pool) {
					await pool.returnConnection(connection);
				}
			}

			// Update statistics
			if (this.statistics.activeConnections > 0) {
				this.statistics.activeConnections--;
			}
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to return pooled connection', errorContext);
		}
	}

	async executeQuery(
		jdbcConnection: JdbcConnection,
		sql: string,
		parameters?: any[],
		options: QueryOptions = {},
	): Promise<QueryResult> {
		const errorContext: ErrorContext = {
			operation: 'executeQuery',
			connectionId: jdbcConnection.id,
			sql: sql.substring(0, 100), // First 100 chars for context
		};

		try {
			const startTime = Date.now();
			let statement;

			// Determine if it's a SELECT statement
			const isSelect = sql.trim().toLowerCase().startsWith('select');
			const isCall = sql.trim().toLowerCase().startsWith('call') || sql.trim().startsWith('{');

			if (parameters && parameters.length > 0) {
				if (isCall) {
					statement = await jdbcConnection.connection.prepareCall(sql);
				} else {
					statement = await jdbcConnection.connection.prepareStatement(sql);
				}

				// Bind parameters
				await this.bindParameters(statement, parameters);
			} else {
				statement = await jdbcConnection.connection.createStatement();

				// Configure fetch size for SELECT statements
				if (isSelect && options.fetchSize) {
					await statement.setFetchSize(options.fetchSize);
				}
			}

			// Set query timeout if specified
			if (options.timeout) {
				await statement.setQueryTimeout(options.timeout);
			}

			let result: QueryResult;

			if (isSelect) {
				const resultSet =
					parameters && parameters.length > 0
						? await statement.executeQuery()
						: await statement.executeQuery(sql);

				const rows = await this.extractResultSet(resultSet, options);
				const metadata = await this.extractMetadata(resultSet);

				await resultSet.close();

				result = {
					rows,
					rowCount: rows.length,
					executionTime: Date.now() - startTime,
					metadata,
				};
			} else if (isCall) {
				const hasResultSet = await statement.execute();
				const outputParams = await this.extractOutputParameters(statement, parameters || []);

				result = {
					rows: outputParams.length > 0 ? [{ outputParams }] : [],
					rowCount: 1,
					executionTime: Date.now() - startTime,
				};
			} else {
				// DML statements (INSERT, UPDATE, DELETE)
				const updateCount =
					parameters && parameters.length > 0
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
			throw ErrorHandler.handleJdbcError(error, 'Query execution failed', errorContext);
		}
	}

	async executeTransaction(
		jdbcConnection: JdbcConnection,
		statements: Array<{ sql: string; parameters?: any[] }>,
		options: QueryOptions = {},
	): Promise<QueryResult[]> {
		const errorContext: ErrorContext = {
			operation: 'executeTransaction',
			connectionId: jdbcConnection.id,
		};

		let originalAutoCommit: boolean;
		const results: QueryResult[] = [];

		try {
			// Begin transaction
			originalAutoCommit = await jdbcConnection.connection.getAutoCommit();
			await jdbcConnection.connection.setAutoCommit(false);

			// Execute all statements
			for (const stmt of statements) {
				const result = await this.executeQuery(jdbcConnection, stmt.sql, stmt.parameters, options);
				results.push(result);
			}

			// Commit transaction
			await jdbcConnection.connection.commit();

			return results;
		} catch (error) {
			// Rollback on error
			try {
				await jdbcConnection.connection.rollback();
			} catch (rollbackError) {
				console.error('Rollback failed:', rollbackError);
			}

			throw ErrorHandler.handleJdbcError(error, 'Transaction execution failed', errorContext);
		} finally {
			// Restore auto-commit
			try {
				if (originalAutoCommit !== undefined) {
					await jdbcConnection.connection.setAutoCommit(originalAutoCommit);
				}
			} catch (restoreError) {
				console.error('Failed to restore auto-commit:', restoreError);
			}
		}
	}

	async closeConnection(jdbcConnection: JdbcConnection): Promise<void> {
		const errorContext: ErrorContext = {
			operation: 'closeConnection',
			connectionId: jdbcConnection.id,
		};

		try {
			if (jdbcConnection.isPooled && jdbcConnection.poolId) {
				// Return pooled connection
				await this.returnPooledConnection(jdbcConnection);
			} else {
				// Close direct connection
				if (jdbcConnection.connection && !(await jdbcConnection.connection.isClosed())) {
					await jdbcConnection.connection.close();
				}

				jdbcConnection.isActive = false;

				// Update statistics
				this.statistics.totalConnectionsClosed++;
				if (this.statistics.activeConnections > 0) {
					this.statistics.activeConnections--;
				}
			}
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to close connection', errorContext);
		}
	}

	async closeConnectionPool(poolId: string): Promise<void> {
		const poolInfo = this.poolInfos.get(poolId);
		if (!poolInfo) {
			throw new Error(`Connection pool ${poolId} not found`);
		}

		const errorContext: ErrorContext = {
			operation: 'closeConnectionPool',
			poolId,
		};

		try {
			if (poolInfo.poolType === 'enterprise') {
				const pool = this.enterprisePools.get(poolId);
				if (pool) {
					await pool.close();
					this.enterprisePools.delete(poolId);
				}
			} else {
				const pool = this.connectionPools.get(poolId);
				if (pool) {
					await pool.close();
					this.connectionPools.delete(poolId);
				}
			}

			// Update pool info
			poolInfo.isActive = false;

			// Update statistics
			if (this.statistics.activePools > 0) {
				this.statistics.activePools--;
			}
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to close connection pool', errorContext);
		}
	}

	async closeAllPools(): Promise<void> {
		const poolIds = Array.from(this.poolInfos.keys());

		const closePromises = poolIds.map(async poolId => {
			try {
				await this.closeConnectionPool(poolId);
			} catch (error) {
				console.error(`Failed to close pool ${poolId}:`, error.message);
			}
		});

		await Promise.all(closePromises);
	}

	// Pool management methods
	getPoolInfo(poolId: string): PoolInfo | undefined {
		return this.poolInfos.get(poolId);
	}

	listPools(): PoolInfo[] {
		return Array.from(this.poolInfos.values());
	}

	getActivePoolCount(): number {
		return this.statistics.activePools;
	}

	getTotalPoolCount(): number {
		return this.statistics.totalPools;
	}

	// Statistics
	getStatistics(): ConnectionManagerStatistics {
		return { ...this.statistics };
	}

	// Private helper methods
	private async bindParameters(statement: any, parameters: any[]): Promise<void> {
		for (let i = 0; i < parameters.length; i++) {
			const param = parameters[i];
			const paramIndex = i + 1;

			if (param === null || param === undefined) {
				const Types = java.import('java.sql.Types');
				await statement.setNull(paramIndex, Types.NULL);
			} else if (typeof param === 'string') {
				await statement.setString(paramIndex, param);
			} else if (typeof param === 'number') {
				if (Number.isInteger(param)) {
					await statement.setInt(paramIndex, param);
				} else {
					await statement.setDouble(paramIndex, param);
				}
			} else if (typeof param === 'boolean') {
				await statement.setBoolean(paramIndex, param);
			} else if (param instanceof Date) {
				const Timestamp = java.import('java.sql.Timestamp');
				const timestamp = new Timestamp(param.getTime());
				await statement.setTimestamp(paramIndex, timestamp);
			} else if (Buffer.isBuffer(param)) {
				await statement.setBytes(paramIndex, param);
			} else {
				await statement.setObject(paramIndex, param);
			}
		}
	}

	private async extractResultSet(resultSet: any, options: QueryOptions = {}): Promise<any[]> {
		const rows: any[] = [];
		const metaData = await resultSet.getMetaData();
		const columnCount = await metaData.getColumnCount();

		// Extract column names
		const columnNames: string[] = [];
		for (let i = 1; i <= columnCount; i++) {
			const columnName = await metaData.getColumnName(i);
			columnNames.push(columnName);
		}

		// Extract data with optional limit
		let rowCount = 0;
		const maxRows = options.maxRows || Number.MAX_SAFE_INTEGER;

		while ((await resultSet.next()) && rowCount < maxRows) {
			const row: any = {};

			for (let i = 0; i < columnNames.length; i++) {
				const columnName = columnNames[i];
				const value = await resultSet.getObject(i + 1);
				row[columnName] = this.convertJavaToJs(value);
			}

			rows.push(row);
			rowCount++;
		}

		return rows;
	}

	private async extractMetadata(resultSet: any): Promise<{ columns: any[] }> {
		const metaData = await resultSet.getMetaData();
		const columnCount = await metaData.getColumnCount();
		const columns = [];

		for (let i = 1; i <= columnCount; i++) {
			columns.push({
				name: await metaData.getColumnName(i),
				type: await metaData.getColumnTypeName(i),
				size: await metaData.getColumnDisplaySize(i),
				precision: await metaData.getPrecision(i),
				scale: await metaData.getScale(i),
				nullable: (await metaData.isNullable(i)) === 1,
			});
		}

		return { columns };
	}

	private async extractOutputParameters(statement: any, parameters: any[]): Promise<any[]> {
		const outputParams: any[] = [];

		for (let i = 0; i < parameters.length; i++) {
			try {
				const value = await statement.getObject(i + 1);
				outputParams.push(this.convertJavaToJs(value));
			} catch {
				// Parameter is not an output parameter
			}
		}

		return outputParams;
	}

	private convertJavaToJs(value: any): any {
		if (value === null || value === undefined) {
			return null;
		}

		// Convert Java types to JavaScript
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
					return Buffer.from(value.getBytes(1, value.length()));
				case 'java.lang.Boolean':
					return Boolean(value);
				case 'java.lang.Integer':
				case 'java.lang.Long':
					return Number(value);
				default:
					return value.toString();
			}
		}

		return value;
	}

	// Health check
	async performHealthCheck(): Promise<{
		isHealthy: boolean;
		issues: string[];
		statistics: ConnectionManagerStatistics;
		poolsHealth: Array<{ poolId: string; isHealthy: boolean }>;
	}> {
		const issues: string[] = [];
		const poolsHealth: Array<{ poolId: string; isHealthy: boolean }> = [];

		try {
			// Check active pools
			for (const [poolId, poolInfo] of this.poolInfos) {
				if (poolInfo.isActive) {
					let isPoolHealthy = false;

					try {
						if (poolInfo.poolType === 'enterprise') {
							const pool = this.enterprisePools.get(poolId);
							const healthCheck = await pool?.performHealthCheck();
							isPoolHealthy = healthCheck?.isHealthy ?? false;
						} else {
							const pool = this.connectionPools.get(poolId);
							isPoolHealthy = (await pool?.testConnection()) ?? false;
						}
					} catch (error) {
						issues.push(`Pool ${poolId} health check failed: ${error.message}`);
					}

					poolsHealth.push({ poolId, isHealthy: isPoolHealthy });
				}
			}

			// Check overall statistics
			if (this.statistics.activePools === 0 && this.statistics.activeConnections > 0) {
				issues.push('Active connections without pools detected');
			}

			return {
				isHealthy: issues.length === 0,
				issues,
				statistics: this.getStatistics(),
				poolsHealth,
			};
		} catch (error) {
			issues.push(`Health check failed: ${error.message}`);
			return {
				isHealthy: false,
				issues,
				statistics: this.getStatistics(),
				poolsHealth,
			};
		}
	}

	// Cleanup method
	async shutdown(): Promise<void> {
		try {
			await this.closeAllPools();

			// Reset statistics
			this.statistics = {
				totalConnectionsCreated: 0,
				totalConnectionsClosed: 0,
				activeConnections: 0,
				totalPools: 0,
				activePools: 0,
			};

			this.initialized = false;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to shutdown connection manager');
		}
	}
}
