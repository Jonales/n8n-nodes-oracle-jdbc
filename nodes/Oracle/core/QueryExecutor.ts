import * as java from 'java-bridge';

import { ColumnMetadata, JdbcConnection, QueryOptions, QueryResult } from '../types/JdbcTypes';

import { ErrorContext, ErrorHandler } from '../utils/ErrorHandler';

export interface ExecutionOptions extends QueryOptions {
	enableStatementCaching?: boolean;
	enableResultSetCaching?: boolean;
	maxResultSetSize?: number;
	streamResults?: boolean;
	chunkSize?: number;
}

export interface QueryPlan {
	sql: string;
	parameters?: any[];
	estimatedCost?: number;
	estimatedRows?: number;
	planHash?: string;
}

export interface QueryStatistics {
	executionTime: number;
	rowsProcessed: number;
	bytesProcessed?: number;
	cpuTime?: number;
	ioOperations?: number;
	planExecutions?: number;
}

export interface BatchExecutionResult {
	results: QueryResult[];
	totalExecutionTime: number;
	successCount: number;
	errorCount: number;
	errors: Array<{ index: number; error: string; sql: string }>;
}

export class QueryExecutor {
	private connection: JdbcConnection;
	private statementCache = new Map<string, any>();
	private readonly MAX_CACHE_SIZE = 100;

	constructor(connection: JdbcConnection) {
		this.connection = connection;
	}

	async executeSelect(
		sql: string,
		parameters: any[] = [],
		options: ExecutionOptions = {},
	): Promise<QueryResult> {
		const errorContext: ErrorContext = {
			operation: 'executeSelect',
			connectionId: this.connection.id,
			sql: sql.substring(0, 100),
		};

		const startTime = Date.now();
		let statement;
		let resultSet;

		try {
			// Validate SQL
			if (!this.isSelectStatement(sql)) {
				throw new Error('SQL statement is not a SELECT query');
			}

			// Prepare statement with caching
			if (parameters.length > 0) {
				statement = await this.getOrCreatePreparedStatement(sql, options.enableStatementCaching);
				await this.bindParameters(statement, parameters);
				resultSet = await statement.executeQuery();
			} else {
				statement = await this.connection.connection.createStatement();

				// Configure statement options
				await this.configureStatement(statement, options);

				resultSet = await statement.executeQuery(sql);
			}

			// Configure result set
			await this.configureResultSet(resultSet, options);

			// Extract results
			const rows = await this.extractResultSet(resultSet, options);
			const metadata = await this.extractMetadata(resultSet);

			const result: QueryResult = {
				rows,
				rowCount: rows.length,
				executionTime: Date.now() - startTime,
				metadata: { columns: metadata },
			};

			return result;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'SELECT execution failed', errorContext);
		} finally {
			if (resultSet) await resultSet.close();
			if (statement && !options.enableStatementCaching) await statement.close();
		}
	}

	async executeDML(
		sql: string,
		parameters: any[] = [],
		options: ExecutionOptions = {},
	): Promise<QueryResult> {
		const errorContext: ErrorContext = {
			operation: 'executeDML',
			connectionId: this.connection.id,
			sql: sql.substring(0, 100),
		};

		const startTime = Date.now();
		let statement;

		try {
			// Validate SQL
			if (this.isSelectStatement(sql)) {
				throw new Error('Use executeSelect for SELECT queries');
			}

			let updateCount: number;
			let generatedKeys: any[] = [];

			if (parameters.length > 0) {
				statement = await this.getOrCreatePreparedStatement(sql, options.enableStatementCaching);
				await this.bindParameters(statement, parameters);

				// Check if we need to return generated keys
				if (this.isDMLWithGeneratedKeys(sql)) {
					updateCount = await statement.executeUpdate();
					generatedKeys = await this.extractGeneratedKeys(statement);
				} else {
					updateCount = await statement.executeUpdate();
				}
			} else {
				statement = await this.connection.connection.createStatement();
				await this.configureStatement(statement, options);
				updateCount = await statement.executeUpdate(sql);
			}

			const result: QueryResult = {
				rows: generatedKeys.length > 0 ? generatedKeys : [],
				rowCount: updateCount,
				executionTime: Date.now() - startTime,
			};

			return result;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'DML execution failed', errorContext);
		} finally {
			if (statement && !options.enableStatementCaching) await statement.close();
		}
	}

	async executePLSQL(
		plsqlBlock: string,
		parameters: any[] = [],
		options: ExecutionOptions = {},
	): Promise<QueryResult> {
		const errorContext: ErrorContext = {
			operation: 'executePLSQL',
			connectionId: this.connection.id,
			sql: plsqlBlock.substring(0, 100),
		};

		const startTime = Date.now();
		let callableStatement;

		try {
			// Prepare callable statement
			callableStatement = await this.connection.connection.prepareCall(plsqlBlock);

			// Configure statement
			if (options.timeout) {
				await callableStatement.setQueryTimeout(options.timeout);
			}

			// Bind parameters
			if (parameters.length > 0) {
				await this.bindParameters(callableStatement, parameters);
			}

			// Execute PL/SQL block
			const hasResultSet = await callableStatement.execute();

			// Extract results
			const outputParams = await this.extractOutputParameters(callableStatement, parameters);
			let resultSets: any[][] = [];

			if (hasResultSet) {
				const resultSet = await callableStatement.getResultSet();
				if (resultSet) {
					const rows = await this.extractResultSet(resultSet);
					resultSets.push(rows);
					await resultSet.close();
				}
			}

			const result: QueryResult = {
				rows: outputParams.length > 0 ? [{ outputParams, resultSets }] : resultSets[0] || [],
				rowCount: outputParams.length > 0 ? 1 : resultSets?.length || 0,
				executionTime: Date.now() - startTime,
			};

			return result;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'PL/SQL execution failed', errorContext);
		} finally {
			if (callableStatement) await callableStatement.close();
		}
	}

	async executeBatch(
		queries: Array<{ sql: string; parameters?: any[] }>,
		options: ExecutionOptions = {},
	): Promise<BatchExecutionResult> {
		const errorContext: ErrorContext = {
			operation: 'executeBatch',
			connectionId: this.connection.id,
		};

		const startTime = Date.now();
		const results: QueryResult[] = [];
		const errors: Array<{ index: number; error: string; sql: string }> = [];
		let successCount = 0;

		try {
			// Group queries by SQL for batching
			const queryGroups = this.groupQueriesBySQL(queries);

			for (const [sql, queryData] of queryGroups) {
				try {
					if (queryData.length === 1) {
						// Single query execution
						const { sql: querySql, parameters } = queryData[0].query;
						const result = await this.executeQuery(querySql, parameters, options);
						results[queryData.originalIndex] = result;
						successCount++;
					} else {
						// Batch execution for same SQL
						const batchResults = await this.executeSQLBatch(sql, queryData, options);

						batchResults.forEach((result, idx) => {
							const originalIndex = queryData[idx].originalIndex;
							results[originalIndex] = result;
							successCount++;
						});
					}
				} catch (error) {
					queryData.forEach(({ originalIndex, query }) => {
						errors.push({
							index: originalIndex,
							error: error.message,
							sql: query.sql,
						});
					});
				}
			}

			return {
				results,
				totalExecutionTime: Date.now() - startTime,
				successCount,
				errorCount: errors.length,
				errors,
			};
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Batch execution failed', errorContext);
		}
	}

	async executeQuery(
		sql: string,
		parameters: any[] = [],
		options: ExecutionOptions = {},
	): Promise<QueryResult> {
		// Auto-detect query type and route to appropriate method
		const trimmedSql = sql.trim().toLowerCase();

		if (trimmedSql.startsWith('select') || trimmedSql.startsWith('with')) {
			return this.executeSelect(sql, parameters, options);
		} else if (
			trimmedSql.startsWith('begin') ||
			trimmedSql.startsWith('declare') ||
			trimmedSql.includes('{call') ||
			trimmedSql.includes('{ call')
		) {
			return this.executePLSQL(sql, parameters, options);
		} else {
			return this.executeDML(sql, parameters, options);
		}
	}

	async explainPlan(sql: string, parameters: any[] = []): Promise<QueryPlan> {
		const errorContext: ErrorContext = {
			operation: 'explainPlan',
			connectionId: this.connection.id,
		};

		try {
			// Create explain plan statement
			const explainSql = `EXPLAIN PLAN FOR ${sql}`;

			let statement;
			if (parameters.length > 0) {
				statement = await this.connection.connection.prepareStatement(explainSql);
				await this.bindParameters(statement, parameters);
				await statement.execute();
			} else {
				statement = await this.connection.connection.createStatement();
				await statement.execute(explainSql);
			}

			await statement.close();

			// Query the plan table
			const planQuery = `
        SELECT operation, options, object_name, cost, cardinality, bytes 
        FROM plan_table 
        WHERE statement_id = 'EXPLAIN_PLAN_' || TO_CHAR(SYSDATE, 'YYYYMMDDHH24MISS')
        ORDER BY id
      `;

			const planResult = await this.executeSelect(planQuery);

			// Calculate estimated metrics
			let estimatedCost = 0;
			let estimatedRows = 0;

			planResult.rows.forEach(row => {
				if (row.COST) estimatedCost += parseInt(row.COST) || 0;
				if (row.CARDINALITY) estimatedRows += parseInt(row.CARDINALITY) || 0;
			});

			return {
				sql,
				parameters,
				estimatedCost,
				estimatedRows,
				planHash: this.generatePlanHash(planResult.rows),
			};
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Explain plan failed', errorContext);
		}
	}

	async getQueryStatistics(): Promise<QueryStatistics[]> {
		const statsQuery = `
      SELECT sql_text, executions, elapsed_time, cpu_time, 
             buffer_gets, disk_reads, rows_processed
      FROM v$sql 
      WHERE parsing_user_id = (SELECT user_id FROM user_users WHERE username = USER)
      ORDER BY elapsed_time DESC
      FETCH FIRST 10 ROWS ONLY
    `;

		try {
			const result = await this.executeSelect(statsQuery);

			return result.rows.map(row => ({
				executionTime: parseInt(row.ELAPSED_TIME) || 0,
				rowsProcessed: parseInt(row.ROWS_PROCESSED) || 0,
				cpuTime: parseInt(row.CPU_TIME) || 0,
				ioOperations: (parseInt(row.BUFFER_GETS) || 0) + (parseInt(row.DISK_READS) || 0),
				planExecutions: parseInt(row.EXECUTIONS) || 0,
			}));
		} catch (error) {
			// Return empty array if statistics are not accessible
			return [];
		}
	}

	// Enhanced parameter binding with type detection
	private async bindParameters(statement: any, parameters: any[]): Promise<void> {
		for (let i = 0; i < parameters.length; i++) {
			const param = parameters[i];
			const paramIndex = i + 1;

			if (param === null || param === undefined) {
				const Types = java.import('java.sql.Types');
				await statement.setNull(paramIndex, Types.NULL);
			} else {
				await this.bindParameterByType(statement, paramIndex, param);
			}
		}
	}

	private async bindParameterByType(statement: any, index: number, value: any): Promise<void> {
		const valueType = typeof value;

		try {
			if (valueType === 'string') {
				await statement.setString(index, value);
			} else if (valueType === 'number') {
				if (Number.isInteger(value)) {
					await statement.setInt(index, value);
				} else {
					await statement.setDouble(index, value);
				}
			} else if (valueType === 'boolean') {
				await statement.setBoolean(index, value);
			} else if (valueType === 'bigint') {
				await statement.setLong(index, Number(value));
			} else if (value instanceof Date) {
				const Timestamp = java.import('java.sql.Timestamp');
				const timestamp = new Timestamp(value.getTime());
				await statement.setTimestamp(index, timestamp);
			} else if (Buffer.isBuffer(value)) {
				await statement.setBytes(index, value);
			} else if (Array.isArray(value)) {
				// Handle array parameters for Oracle collection types
				await statement.setObject(index, value);
			} else {
				// Generic object binding
				await statement.setObject(index, value);
			}
		} catch (error) {
			throw new Error(`Failed to bind parameter at index ${index}: ${error.message}`);
		}
	}

	private async extractResultSet(resultSet: any, options: ExecutionOptions = {}): Promise<any[]> {
		const rows: any[] = [];
		const metaData = await resultSet.getMetaData();
		const columnCount = await metaData.getColumnCount();
		const maxRows = options.maxRows || options.maxResultSetSize || Number.MAX_SAFE_INTEGER;

		// Extract column names and types
		const columnInfo: Array<{ name: string; type: string; index: number }> = [];
		for (let i = 1; i <= columnCount; i++) {
			columnInfo.push({
				name: await metaData.getColumnName(i),
				type: await metaData.getColumnTypeName(i),
				index: i,
			});
		}

		// Extract data with streaming support
		let rowCount = 0;
		while ((await resultSet.next()) && rowCount < maxRows) {
			const row: any = {};

			if (
				options.streamResults &&
				options.chunkSize &&
				rowCount > 0 &&
				rowCount % options.chunkSize === 0
			) {
				// Yield control for streaming
				await new Promise(resolve => setImmediate(resolve));
			}

			for (const col of columnInfo) {
				try {
					const value = await resultSet.getObject(col.index);
					row[col.name] = this.convertJavaValue(value, col.type);
				} catch (error) {
					// Handle individual column errors gracefully
					row[col.name] = null;
					console.warn(`Failed to extract column ${col.name}:`, error.message);
				}
			}

			rows.push(row);
			rowCount++;
		}

		return rows;
	}

	private async extractMetadata(resultSet: any): Promise<ColumnMetadata[]> {
		const metaData = await resultSet.getMetaData();
		const columnCount = await metaData.getColumnCount();
		const columns: ColumnMetadata[] = [];

		for (let i = 1; i <= columnCount; i++) {
			try {
				columns.push({
					name: await metaData.getColumnName(i),
					type: await metaData.getColumnTypeName(i),
					size: await metaData.getColumnDisplaySize(i),
					precision: await metaData.getPrecision(i),
					scale: await metaData.getScale(i),
					nullable: (await metaData.isNullable(i)) === 1,
				});
			} catch (error) {
				// Handle metadata extraction errors
				columns.push({
					name: `COLUMN_${i}`,
					type: 'UNKNOWN',
					size: 0,
					nullable: true,
				});
			}
		}

		return columns;
	}

	private async extractOutputParameters(statement: any, parameters: any[]): Promise<any[]> {
		const outputParams: any[] = [];

		for (let i = 0; i < parameters.length; i++) {
			try {
				const value = await statement.getObject(i + 1);
				outputParams.push(this.convertJavaValue(value));
			} catch {
				// Parameter is not an output parameter
				outputParams.push(null);
			}
		}

		return outputParams;
	}

	private async extractGeneratedKeys(statement: any): Promise<any[]> {
		const keys: any[] = [];

		try {
			const keyResultSet = await statement.getGeneratedKeys();
			if (keyResultSet) {
				while (await keyResultSet.next()) {
					const key = await keyResultSet.getObject(1);
					keys.push(this.convertJavaValue(key));
				}
				await keyResultSet.close();
			}
		} catch (error) {
			// Generated keys not available
		}

		return keys;
	}

	private convertJavaValue(value: any, columnType?: string): any {
		if (value === null || value === undefined) {
			return null;
		}

		// Enhanced type conversion with Oracle-specific handling
		if (typeof value === 'object' && value.getClass) {
			const className = value.getClass().getName();

			switch (className) {
				case 'java.math.BigDecimal':
					return parseFloat(value.toString());

				case 'java.sql.Timestamp':
				case 'java.sql.Date':
				case 'java.sql.Time':
					return new Date(value.getTime());

				case 'oracle.sql.TIMESTAMP':
					return new Date(value.timestampValue().getTime());

				case 'oracle.sql.CLOB':
					return value.getSubString(1, value.length());

				case 'oracle.sql.BLOB':
					return Buffer.from(value.getBytes(1, value.length()));

				case 'oracle.sql.ROWID':
				case 'oracle.sql.UROWID':
					return value.toString();

				case 'oracle.sql.NUMBER':
					return value.doubleValue();

				case 'java.lang.Boolean':
					return Boolean(value);

				case 'java.lang.Integer':
				case 'java.lang.Long':
				case 'java.lang.Double':
				case 'java.lang.Float':
					return Number(value);

				case 'java.lang.String':
					return String(value);

				case 'oracle.sql.ARRAY':
					// Handle Oracle ARRAY types
					try {
						const arrayData = value.getArray();
						return Array.from(arrayData);
					} catch {
						return value.toString();
					}

				default:
					return value.toString();
			}
		}

		return value;
	}

	private async configureStatement(statement: any, options: ExecutionOptions): Promise<void> {
		if (options.fetchSize) {
			await statement.setFetchSize(options.fetchSize);
		}

		if (options.timeout) {
			await statement.setQueryTimeout(options.timeout);
		}

		if (options.maxRows) {
			await statement.setMaxRows(options.maxRows);
		}
	}

	private async configureResultSet(resultSet: any, options: ExecutionOptions): Promise<void> {
		if (options.fetchSize) {
			await resultSet.setFetchSize(options.fetchSize);
		}
	}

	private async getOrCreatePreparedStatement(sql: string, useCache?: boolean): Promise<any> {
		if (!useCache) {
			return this.connection.connection.prepareStatement(sql);
		}

		let statement = this.statementCache.get(sql);

		if (!statement) {
			statement = await this.connection.connection.prepareStatement(sql);

			// Manage cache size
			if (this.statementCache.size >= this.MAX_CACHE_SIZE) {
				const firstKey = this.statementCache.keys().next().value;
				const oldStatement = this.statementCache.get(firstKey);
				await oldStatement.close();
				this.statementCache.delete(firstKey);
			}

			this.statementCache.set(sql, statement);
		}

		return statement;
	}

	private groupQueriesBySQL(
		queries: Array<{ sql: string; parameters?: any[] }>,
	): Map<string, Array<{ originalIndex: number; query: { sql: string; parameters?: any[] } }>> {
		const groups = new Map();

		queries.forEach((query, index) => {
			if (!groups.has(query.sql)) {
				groups.set(query.sql, []);
			}
			groups.get(query.sql).push({ originalIndex: index, query });
		});

		return groups;
	}

	private async executeSQLBatch(
		sql: string,
		queryData: any[],
		options: ExecutionOptions,
	): Promise<QueryResult[]> {
		const statement = await this.connection.connection.prepareStatement(sql);
		const results: QueryResult[] = [];

		try {
			// Add all parameter sets to batch
			for (const { query } of queryData) {
				if (query.parameters && query.parameters.length > 0) {
					await this.bindParameters(statement, query.parameters);
				}
				await statement.addBatch();
			}

			// Execute batch
			const startTime = Date.now();
			const updateCounts = await statement.executeBatch();
			const executionTime = Date.now() - startTime;

			// Create results
			updateCounts.forEach((count: number) => {
				results.push({
					rows: [],
					rowCount: count,
					executionTime: executionTime / updateCounts.length,
				});
			});

			return results;
		} finally {
			await statement.close();
		}
	}

	private isSelectStatement(sql: string): boolean {
		const trimmed = sql.trim().toLowerCase();
		return trimmed.startsWith('select') || trimmed.startsWith('with');
	}

	private isDMLWithGeneratedKeys(sql: string): boolean {
		const trimmed = sql.trim().toLowerCase();
		return trimmed.startsWith('insert') && !trimmed.includes('select');
	}

	private generatePlanHash(planRows: any[]): string {
		const planString = planRows
			.map(row => `${row.OPERATION || ''}-${row.OPTIONS || ''}-${row.OBJECT_NAME || ''}`)
			.join('|');

		// Simple hash generation
		let hash = 0;
		for (let i = 0; i < planString.length; i++) {
			const char = planString.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}

		return Math.abs(hash).toString(16);
	}

	async clearStatementCache(): Promise<void> {
		for (const statement of this.statementCache.values()) {
			try {
				await statement.close();
			} catch (error) {
				console.warn('Failed to close cached statement:', error.message);
			}
		}
		this.statementCache.clear();
	}

	getStatementCacheSize(): number {
		return this.statementCache.size;
	}

	async close(): Promise<void> {
		await this.clearStatementCache();
	}
}
