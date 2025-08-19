import * as java from 'java-bridge';

import { JdbcConnection } from '../types/JdbcTypes';

import { ErrorContext, ErrorHandler } from '../utils/ErrorHandler';

export interface BatchOptions {
	batchSize?: number;
	continueOnError?: boolean;
	timeout?: number;
	enableProgressCallback?: boolean;
	transactional?: boolean;
}

export interface BatchResult {
	rowsProcessed: number;
	executionTime: number;
	errors: BatchError[];
	successfulBatches: number;
	failedBatches: number;
	totalBatches: number;
}

export interface BatchError {
	batchIndex: number;
	errorMessage: string;
	sqlState?: string;
	errorCode?: number;
	affectedRows?: any[];
}

export interface ProgressCallback {
	(processed: number, total: number, currentBatch: number, totalBatches: number): void;
}

export class BatchOperations {
	private connection: JdbcConnection;

	constructor(connection: JdbcConnection) {
		this.connection = connection;
	}

	async bulkInsert(
		tableName: string,
		data: any[],
		options: BatchOptions = {},
		progressCallback?: ProgressCallback,
	): Promise<BatchResult> {
		const {
			batchSize = 1000,
			continueOnError = false,
			timeout = 30,
			transactional = true,
		} = options;

		if (data.length === 0) {
			return {
				rowsProcessed: 0,
				executionTime: 0,
				errors: [],
				successfulBatches: 0,
				failedBatches: 0,
				totalBatches: 0,
			};
		}

		const startTime = Date.now();
		const errors: BatchError[] = [];
		let totalProcessed = 0;
		let successfulBatches = 0;
		let failedBatches = 0;
		const totalBatches = Math.ceil(data.length / batchSize);

		// Gerar SQL INSERT baseado na primeira linha
		const columns = Object.keys(data[0]);
		const placeholders = columns.map(() => '?').join(', ');
		const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

		const errorContext: ErrorContext = {
			operation: 'bulkInsert',
			sql: sql.substring(0, 100),
			connectionId: this.connection.id,
		};

		let statement;
		let originalAutoCommit;

		try {
			statement = await this.connection.connection.prepareStatement(sql);

			if (timeout > 0) {
				await statement.setQueryTimeout(timeout);
			}

			// Configurar transação se necessário
			if (transactional) {
				originalAutoCommit = await this.connection.connection.getAutoCommit();
				await this.connection.connection.setAutoCommit(false);
			}

			// Processar em lotes
			for (let i = 0; i < data.length; i += batchSize) {
				const currentBatch = Math.floor(i / batchSize);
				const batch = data.slice(i, Math.min(i + batchSize, data.length));

				try {
					await this.processBatch(statement, batch, columns);
					totalProcessed += batch.length;
					successfulBatches++;

					// Callback de progresso
					if (progressCallback) {
						progressCallback(totalProcessed, data.length, currentBatch + 1, totalBatches);
					}
				} catch (error: unknown) {
					const message = error instanceof Error ? error.message : String(error);

					failedBatches++;
					const batchError: BatchError = {
						batchIndex: currentBatch,
						errorMessage: message || message.toString(),
						affectedRows: batch,
					};

					function isObject(x: unknown): x is Record<string, unknown> {
						return typeof x === 'object' && x !== null;
					}

					type JavaCause = {
						getSQLState?: () => string;
						getErrorCode?: () => number;
					};

					function hasJavaCause(e: unknown): e is { cause: JavaCause } {
						if (!isObject(e)) return false;
						const cause = (e as any).cause;
						return (
							isObject(cause) &&
							(typeof cause.getSQLState === 'function' || typeof cause.getErrorCode === 'function')
						);
					}

					// Extrair informações adicionais do erro SQL (com type narrowing seguro)
					if (hasJavaCause(error)) {
						try {
							if (typeof error.cause.getSQLState === 'function') {
								batchError.sqlState = error.cause.getSQLState();
							}
							if (typeof error.cause.getErrorCode === 'function') {
								batchError.errorCode = error.cause.getErrorCode();
							}
						} catch {
							// Ignorar se não conseguir extrair
						}
					}

					errors.push(batchError);

					if (!continueOnError) {
						if (transactional) {
							await this.connection.connection.rollback();
						}
						throw error;
					}
				}
			}

			// Commit se transacional
			if (transactional) {
				await this.connection.connection.commit();
			}

			return {
				rowsProcessed: totalProcessed,
				executionTime: Date.now() - startTime,
				errors,
				successfulBatches,
				failedBatches,
				totalBatches,
			};
		} catch (error) {
			if (transactional && originalAutoCommit !== undefined) {
				try {
					await this.connection.connection.rollback();
				} catch (rollbackError) {
					// Log rollback error but throw original error
					console.error('Rollback failed:', rollbackError);
				}
			}
			throw ErrorHandler.handleJdbcError(error, 'Bulk insert failed', errorContext);
		} finally {
			if (statement) {
				try {
					await statement.close();
				} catch (closeError) {
					console.error('Failed to close statement:', closeError);
				}
			}

			if (transactional && originalAutoCommit !== undefined) {
				try {
					await this.connection.connection.setAutoCommit(originalAutoCommit);
				} catch (autoCommitError) {
					console.error('Failed to restore autocommit:', autoCommitError);
				}
			}
		}
	}

	async bulkUpdate(
		tableName: string,
		updates: { whereClause: string; setValues: any; whereParams?: any[] }[],
		options: BatchOptions = {},
		progressCallback?: ProgressCallback,
	): Promise<BatchResult> {
		const {
			batchSize = 1000,
			continueOnError = false,
			timeout = 30,
			transactional = true,
		} = options;

		if (updates.length === 0) {
			return {
				rowsProcessed: 0,
				executionTime: 0,
				errors: [],
				successfulBatches: 0,
				failedBatches: 0,
				totalBatches: 0,
			};
		}

		const startTime = Date.now();
		const errors: BatchError[] = [];
		let totalProcessed = 0;
		let successfulBatches = 0;
		let failedBatches = 0;
		const totalBatches = Math.ceil(updates.length / batchSize);

		let originalAutoCommit;
		const statements = new Map<string, any>();

		try {
			if (transactional) {
				originalAutoCommit = await this.connection.connection.getAutoCommit();
				await this.connection.connection.setAutoCommit(false);
			}

			// Processar em lotes
			for (let i = 0; i < updates.length; i += batchSize) {
				const currentBatch = Math.floor(i / batchSize);
				const batch = updates.slice(i, Math.min(i + batchSize, updates.length));

				try {
					for (const update of batch) {
						const setColumns = Object.keys(update.setValues);
						const setClause = setColumns.map(col => `${col} = ?`).join(', ');
						const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${update.whereClause}`;

						let statement = statements.get(sql);
						if (!statement) {
							statement = await this.connection.connection.prepareStatement(sql);
							if (timeout > 0) {
								await statement.setQueryTimeout(timeout);
							}
							statements.set(sql, statement);
						}

						// Bind SET values
						let paramIndex = 1;
						for (const column of setColumns) {
							await statement.setObject(paramIndex++, update.setValues[column]);
						}

						// Bind WHERE parameters if provided
						if (update.whereParams) {
							for (const param of update.whereParams) {
								await statement.setObject(paramIndex++, param);
							}
						}

						await statement.addBatch();
					}

					// Execute all prepared statements
					for (const [sql, statement] of statements) {
						await statement.executeBatch();
						await statement.clearBatch();
					}

					totalProcessed += batch.length;
					successfulBatches++;

					if (progressCallback) {
						progressCallback(totalProcessed, updates.length, currentBatch + 1, totalBatches);
					}
				} catch (error: unknown) {
					const message = error instanceof Error ? error.message : String(error);

					failedBatches++;
					errors.push({
						batchIndex: currentBatch,
						errorMessage: message || message.toString(),
						affectedRows: batch,
					});

					if (!continueOnError) {
						if (transactional) {
							await this.connection.connection.rollback();
						}
						throw error;
					}
				}
			}

			if (transactional) {
				await this.connection.connection.commit();
			}

			return {
				rowsProcessed: totalProcessed,
				executionTime: Date.now() - startTime,
				errors,
				successfulBatches,
				failedBatches,
				totalBatches,
			};
		} catch (error) {
			if (transactional && originalAutoCommit !== undefined) {
				try {
					await this.connection.connection.rollback();
				} catch (rollbackError) {
					console.error('Rollback failed:', rollbackError);
				}
			}
			throw ErrorHandler.handleJdbcError(error, 'Bulk update failed');
		} finally {
			// Close all statements
			for (const [sql, statement] of statements) {
				try {
					await statement.close();
				} catch (closeError) {
					console.error(`Failed to close statement for ${sql}:`, closeError);
				}
			}

			if (transactional && originalAutoCommit !== undefined) {
				try {
					await this.connection.connection.setAutoCommit(originalAutoCommit);
				} catch (autoCommitError) {
					console.error('Failed to restore autocommit:', autoCommitError);
				}
			}
		}
	}

	async bulkDelete(
		tableName: string,
		whereConditions: { whereClause: string; params?: any[] }[],
		options: BatchOptions = {},
		progressCallback?: ProgressCallback,
	): Promise<BatchResult> {
		const {
			batchSize = 1000,
			continueOnError = false,
			timeout = 30,
			transactional = true,
		} = options;

		if (whereConditions.length === 0) {
			return {
				rowsProcessed: 0,
				executionTime: 0,
				errors: [],
				successfulBatches: 0,
				failedBatches: 0,
				totalBatches: 0,
			};
		}

		const startTime = Date.now();
		const errors: BatchError[] = [];
		let totalProcessed = 0;
		let successfulBatches = 0;
		let failedBatches = 0;
		const totalBatches = Math.ceil(whereConditions.length / batchSize);

		let originalAutoCommit;
		const statements = new Map<string, any>();

		try {
			if (transactional) {
				originalAutoCommit = await this.connection.connection.getAutoCommit();
				await this.connection.connection.setAutoCommit(false);
			}

			// Processar em lotes
			for (let i = 0; i < whereConditions.length; i += batchSize) {
				const currentBatch = Math.floor(i / batchSize);
				const batch = whereConditions.slice(i, Math.min(i + batchSize, whereConditions.length));

				try {
					for (const deleteCondition of batch) {
						const sql = `DELETE FROM ${tableName} WHERE ${deleteCondition.whereClause}`;

						let statement = statements.get(sql);
						if (!statement) {
							statement = await this.connection.connection.prepareStatement(sql);
							if (timeout > 0) {
								await statement.setQueryTimeout(timeout);
							}
							statements.set(sql, statement);
						}

						// Bind parameters if provided
						if (deleteCondition.params) {
							for (let j = 0; j < deleteCondition.params.length; j++) {
								await statement.setObject(j + 1, deleteCondition.params[j]);
							}
						}

						await statement.addBatch();
					}

					// Execute all prepared statements
					for (const [sql, statement] of statements) {
						await statement.executeBatch();
						await statement.clearBatch();
					}

					totalProcessed += batch.length;
					successfulBatches++;

					if (progressCallback) {
						progressCallback(
							totalProcessed,
							whereConditions.length,
							currentBatch + 1,
							totalBatches,
						);
					}
				} catch (error:unknown) {
					const message = error instanceof Error ? error.message : String(error);

					failedBatches++;
					errors.push({
						batchIndex: currentBatch,
						errorMessage: message || message.toString(),
						affectedRows: batch,
					});

					if (!continueOnError) {
						if (transactional) {
							await this.connection.connection.rollback();
						}
						throw error;
					}
				}
			}

			if (transactional) {
				await this.connection.connection.commit();
			}

			return {
				rowsProcessed: totalProcessed,
				executionTime: Date.now() - startTime,
				errors,
				successfulBatches,
				failedBatches,
				totalBatches,
			};
		} catch (error) {
			if (transactional && originalAutoCommit !== undefined) {
				try {
					await this.connection.connection.rollback();
				} catch (rollbackError) {
					console.error('Rollback failed:', rollbackError);
				}
			}
			throw ErrorHandler.handleJdbcError(error, 'Bulk delete failed');
		} finally {
			// Close all statements
			for (const [sql, statement] of statements) {
				try {
					await statement.close();
				} catch (closeError) {
					console.error(`Failed to close statement for ${sql}:`, closeError);
				}
			}

			if (transactional && originalAutoCommit !== undefined) {
				try {
					await this.connection.connection.setAutoCommit(originalAutoCommit);
				} catch (autoCommitError) {
					console.error('Failed to restore autocommit:', autoCommitError);
				}
			}
		}
	}

	async bulkUpsert(
		tableName: string,
		data: any[],
		keyColumns: string[],
		options: BatchOptions = {},
		progressCallback?: ProgressCallback,
	): Promise<BatchResult> {
		// Oracle MERGE statement para upsert
		if (data.length === 0) {
			return {
				rowsProcessed: 0,
				executionTime: 0,
				errors: [],
				successfulBatches: 0,
				failedBatches: 0,
				totalBatches: 0,
			};
		}

		const columns = Object.keys(data[0]);
		const nonKeyColumns = columns.filter(col => !keyColumns.includes(col));

		const keyConditions = keyColumns.map(col => `target.${col} = source.${col}`).join(' AND ');
		const updateSet = nonKeyColumns.map(col => `target.${col} = source.${col}`).join(', ');
		const insertColumns = columns.join(', ');
		const insertValues = columns.map(col => `source.${col}`).join(', ');
		const selectValues = columns.map(() => '?').join(', ');

		const sql = `
      MERGE INTO ${tableName} target
      USING (SELECT ${selectValues} FROM dual) source
      ON (${keyConditions})
      WHEN MATCHED THEN
        UPDATE SET ${updateSet}
      WHEN NOT MATCHED THEN
        INSERT (${insertColumns}) VALUES (${insertValues})
    `;

		// Use the same logic as bulkInsert but with MERGE statement
		return this.executeGenericBatch(sql, data, columns, options, progressCallback, 'bulkUpsert');
	}

	private async processBatch(statement: any, batch: any[], columns: string[]): Promise<void> {
		// Adicionar todos os registros do lote
		for (const row of batch) {
			for (let j = 0; j < columns.length; j++) {
				const value = row[columns[j]];
				await statement.setObject(j + 1, value);
			}
			await statement.addBatch();
		}

		// Executar lote
		await statement.executeBatch();
		await statement.clearBatch();
	}

	private async executeGenericBatch(
		sql: string,
		data: any[],
		columns: string[],
		options: BatchOptions,
		progressCallback?: ProgressCallback,
		operationType: string = 'genericBatch',
	): Promise<BatchResult> {
		const {
			batchSize = 1000,
			continueOnError = false,
			timeout = 30,
			transactional = true,
		} = options;

		const startTime = Date.now();
		const errors: BatchError[] = [];
		let totalProcessed = 0;
		let successfulBatches = 0;
		let failedBatches = 0;
		const totalBatches = Math.ceil(data.length / batchSize);

		let statement;
		let originalAutoCommit;

		try {
			statement = await this.connection.connection.prepareStatement(sql);

			if (timeout > 0) {
				await statement.setQueryTimeout(timeout);
			}

			if (transactional) {
				originalAutoCommit = await this.connection.connection.getAutoCommit();
				await this.connection.connection.setAutoCommit(false);
			}

			// Processar em lotes
			for (let i = 0; i < data.length; i += batchSize) {
				const currentBatch = Math.floor(i / batchSize);
				const batch = data.slice(i, Math.min(i + batchSize, data.length));

				try {
					await this.processBatch(statement, batch, columns);
					totalProcessed += batch.length;
					successfulBatches++;

					if (progressCallback) {
						progressCallback(totalProcessed, data.length, currentBatch + 1, totalBatches);
					}
				} catch (error:unknown) {
					const message = error instanceof Error ? error.message : String(error);

					failedBatches++;
					errors.push({
						batchIndex: currentBatch,
						errorMessage: message || message.toString(),
						affectedRows: batch,
					});

					if (!continueOnError) {
						if (transactional) {
							await this.connection.connection.rollback();
						}
						throw error;
					}
				}
			}

			if (transactional) {
				await this.connection.connection.commit();
			}

			return {
				rowsProcessed: totalProcessed,
				executionTime: Date.now() - startTime,
				errors,
				successfulBatches,
				failedBatches,
				totalBatches,
			};
		} catch (error) {
			if (transactional && originalAutoCommit !== undefined) {
				try {
					await this.connection.connection.rollback();
				} catch (rollbackError) {
					console.error('Rollback failed:', rollbackError);
				}
			}
			throw ErrorHandler.handleJdbcError(error, `${operationType} failed`);
		} finally {
			if (statement) {
				try {
					await statement.close();
				} catch (closeError) {
					console.error('Failed to close statement:', closeError);
				}
			}

			if (transactional && originalAutoCommit !== undefined) {
				try {
					await this.connection.connection.setAutoCommit(originalAutoCommit);
				} catch (autoCommitError) {
					console.error('Failed to restore autocommit:', autoCommitError);
				}
			}
		}
	}
}
