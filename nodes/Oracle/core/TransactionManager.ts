import * as java from 'java-bridge';
import { JdbcConnection } from '../types/JdbcTypes';

import { ErrorContext, ErrorHandler } from '../utils/ErrorHandler';

export interface TransactionOptions {
	isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
	timeout?: number;
	enableSavepoints?: boolean;
	readOnly?: boolean;
	autoRollbackOnError?: boolean;
	maxRetryAttempts?: number;
	retryDelayMs?: number;
}

export interface SavepointInfo {
	name: string;
	savepoint: any; // Java Savepoint object
	createdAt: Date;
	description?: string;
}

export interface TransactionInfo {
	id: string;
	connectionId: string;
	startTime: Date;
	isolationLevel?: string;
	isReadOnly: boolean;
	savepoints: SavepointInfo[];
	operations: TransactionOperation[];
}

export interface TransactionOperation {
	timestamp: Date;
	operation:
		| 'BEGIN'
		| 'COMMIT'
		| 'ROLLBACK'
		| 'SAVEPOINT'
		| 'ROLLBACK_TO_SAVEPOINT'
		| 'RELEASE_SAVEPOINT';
	description?: string;
	savepointName?: string;
}

export interface TransactionStatistics {
	transactionId: string;
	duration: number;
	operationsCount: number;
	savepointsCreated: number;
	rollbacksPerformed: number;
	isActive: boolean;
}

export interface DistributedTransactionConfig {
	transactionManagerUrl?: string;
	resourceManagerName?: string;
	enableXA?: boolean;
	timeoutSeconds?: number;
}

export class TransactionManager {
	private connection: JdbcConnection;
	private transactionInfo: TransactionInfo | null = null;
	private originalAutoCommit?: boolean;
	private originalIsolationLevel?: number;
	private originalReadOnly?: boolean;
	private distributedConfig?: DistributedTransactionConfig;

	constructor(connection: JdbcConnection, distributedConfig?: DistributedTransactionConfig) {
		this.connection = connection;
		this.distributedConfig = distributedConfig;
	}

	async beginTransaction(options: TransactionOptions = {}): Promise<string> {
		const errorContext: ErrorContext = {
			operation: 'beginTransaction',
			connectionId: this.connection.id,
		};

		if (this.transactionInfo) {
			throw new Error('Transaction already in progress');
		}

		try {
			// Save original connection state
			this.originalAutoCommit = await this.connection.connection.getAutoCommit();
			this.originalIsolationLevel = await this.connection.connection.getTransactionIsolation();
			this.originalReadOnly = await this.connection.connection.isReadOnly();

			// Configure transaction
			await this.connection.connection.setAutoCommit(false);

			// Set isolation level if specified
			if (options.isolationLevel) {
				const isolationLevel = this.getIsolationLevel(options.isolationLevel);
				await this.connection.connection.setTransactionIsolation(isolationLevel);
			}

			// Set read-only mode if specified
			if (options.readOnly !== undefined) {
				await this.connection.connection.setReadOnly(options.readOnly);
			}

			// Set transaction timeout if specified
			if (options.timeout) {
				await this.connection.connection.setNetworkTimeout(null, options.timeout * 1000);
			}

			// Initialize transaction info
			const transactionId = this.generateTransactionId();
			this.transactionInfo = {
				id: transactionId,
				connectionId: this.connection.id,
				startTime: new Date(),
				isolationLevel: options.isolationLevel,
				isReadOnly: options.readOnly || false,
				savepoints: [],
				operations: [
					{
						timestamp: new Date(),
						operation: 'BEGIN',
						description: `Transaction started with isolation level: ${options.isolationLevel || 'default'}`,
					},
				],
			};

			return transactionId;
		} catch (error) {
			// Restore original state if transaction failed to start
			await this.restoreConnectionState();
			throw ErrorHandler.handleJdbcError(error, 'Failed to begin transaction', errorContext);
		}
	}

	async commit(): Promise<void> {
		const errorContext: ErrorContext = {
			operation: 'commit',
			connectionId: this.connection.id,
			transactionId: this.transactionInfo?.id,
		};

		if (!this.transactionInfo) {
			throw new Error('No transaction in progress');
		}

		try {
			await this.connection.connection.commit();

			// Add operation to history
			this.transactionInfo.operations.push({
				timestamp: new Date(),
				operation: 'COMMIT',
				description: 'Transaction committed successfully',
			});

			// Cleanup
			await this.restoreConnectionState();
			this.transactionInfo = null;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to commit transaction', errorContext);
		}
	}

	async rollback(savepointName?: string): Promise<void> {
		const errorContext: ErrorContext = {
			operation: 'rollback',
			connectionId: this.connection.id,
			transactionId: this.transactionInfo?.id,
		};

		if (!this.transactionInfo) {
			throw new Error('No transaction in progress');
		}

		try {
			if (savepointName) {
				// Rollback to specific savepoint
				const savepointInfo = this.transactionInfo.savepoints.find(sp => sp.name === savepointName);

				if (!savepointInfo) {
					throw new Error(`Savepoint '${savepointName}' not found`);
				}

				await this.connection.connection.rollback(savepointInfo.savepoint);

				// Remove savepoints created after this one
				this.transactionInfo.savepoints = this.transactionInfo.savepoints.filter(
					sp => sp.createdAt <= savepointInfo.createdAt,
				);

				// Add operation to history
				this.transactionInfo.operations.push({
					timestamp: new Date(),
					operation: 'ROLLBACK_TO_SAVEPOINT',
					description: `Rolled back to savepoint: ${savepointName}`,
					savepointName,
				});
			} else {
				// Full rollback
				await this.connection.connection.rollback();

				// Add operation to history
				this.transactionInfo.operations.push({
					timestamp: new Date(),
					operation: 'ROLLBACK',
					description: 'Transaction rolled back completely',
				});

				// Cleanup
				await this.restoreConnectionState();
				this.transactionInfo = null;
			}
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to rollback transaction', errorContext);
		}
	}

	async createSavepoint(name?: string, description?: string): Promise<string> {
		const errorContext: ErrorContext = {
			operation: 'createSavepoint',
			connectionId: this.connection.id,
			transactionId: this.transactionInfo?.id,
		};

		if (!this.transactionInfo) {
			throw new Error('No transaction in progress');
		}

		const savepointName = name || this.generateSavepointName();

		// Check for duplicate savepoint names
		if (this.transactionInfo.savepoints.some(sp => sp.name === savepointName)) {
			throw new Error(`Savepoint '${savepointName}' already exists`);
		}

		try {
			const savepoint = await this.connection.connection.setSavepoint(savepointName);

			const savepointInfo: SavepointInfo = {
				name: savepointName,
				savepoint,
				createdAt: new Date(),
				description,
			};

			this.transactionInfo.savepoints.push(savepointInfo);

			// Add operation to history
			this.transactionInfo.operations.push({
				timestamp: new Date(),
				operation: 'SAVEPOINT',
				description: description || `Savepoint created: ${savepointName}`,
				savepointName,
			});

			return savepointName;
		} catch (error) {
			throw ErrorHandler.handleJdbcError(
				error,
				`Failed to create savepoint: ${savepointName}`,
				errorContext,
			);
		}
	}

	async releaseSavepoint(name: string): Promise<void> {
		const errorContext: ErrorContext = {
			operation: 'releaseSavepoint',
			connectionId: this.connection.id,
			transactionId: this.transactionInfo?.id,
		};

		if (!this.transactionInfo) {
			throw new Error('No transaction in progress');
		}

		const savepointIndex = this.transactionInfo.savepoints.findIndex(sp => sp.name === name);

		if (savepointIndex === -1) {
			throw new Error(`Savepoint '${name}' not found`);
		}

		try {
			const savepointInfo = this.transactionInfo.savepoints[savepointIndex];
			await this.connection.connection.releaseSavepoint(savepointInfo.savepoint);

			// Remove the savepoint and all subsequent ones
			this.transactionInfo.savepoints = this.transactionInfo.savepoints.slice(0, savepointIndex);

			// Add operation to history
			this.transactionInfo.operations.push({
				timestamp: new Date(),
				operation: 'RELEASE_SAVEPOINT',
				description: `Savepoint released: ${name}`,
				savepointName: name,
			});
		} catch (error) {
			throw ErrorHandler.handleJdbcError(
				error,
				`Failed to release savepoint: ${name}`,
				errorContext,
			);
		}
	}

	async executeWithSavepoint<T>(
		operation: () => Promise<T>,
		savepointName?: string,
		autoRollbackOnError = true,
	): Promise<T> {
		const spName = await this.createSavepoint(savepointName, 'Auto-created for operation');

		try {
			const result = await operation();
			await this.releaseSavepoint(spName);
			return result;
		} catch (error) {
			if (autoRollbackOnError) {
				await this.rollback(spName);
			}
			throw error;
		}
	}

	async executeWithRetry<T>(
		operation: () => Promise<T>,
		options: {
			maxRetries?: number;
			retryDelayMs?: number;
			savepointName?: string;
		} = {},
	): Promise<T> {
		const { maxRetries = 3, retryDelayMs = 1000, savepointName } = options;
		let lastError;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			const spName = savepointName || `retry_attempt_${attempt}`;

			try {
				await this.createSavepoint(spName, `Retry attempt ${attempt}`);
				const result = await operation();
				await this.releaseSavepoint(spName);
				return result;
			} catch (error) {
				lastError = error;

				if (attempt < maxRetries) {
					await this.rollback(spName);
					await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
				} else {
					await this.rollback(spName);
				}
			}
		}

		throw lastError;
	}

	async executeBatch(
		operations: Array<() => Promise<any>>,
		options: {
			stopOnFirstError?: boolean;
			createSavepointPerOperation?: boolean;
		} = {},
	): Promise<Array<{ success: boolean; result?: any; error?: any }>> {
		const { stopOnFirstError = false, createSavepointPerOperation = true } = options;
		const results: Array<{ success: boolean; result?: any; error?: any }> = [];

		for (let i = 0; i < operations.length; i++) {
			const operation = operations[i];
			let savepointName: string | undefined;

			try {
				if (createSavepointPerOperation) {
					savepointName = await this.createSavepoint(`batch_op_${i}`, `Batch operation ${i + 1}`);
				}

				const result = await operation();
				results.push({ success: true, result });

				if (savepointName) {
					await this.releaseSavepoint(savepointName);
				}
			} catch (error) {
				results.push({ success: false, error });

				if (savepointName) {
					await this.rollback(savepointName);
				}

				if (stopOnFirstError) {
					break;
				}
			}
		}

		return results;
	}

	isInTransaction(): boolean {
		return this.transactionInfo !== null;
	}

	getCurrentTransactionInfo(): TransactionInfo | null {
		return this.transactionInfo ? { ...this.transactionInfo } : null;
	}

	getTransactionStatistics(): TransactionStatistics | null {
		if (!this.transactionInfo) {
			return null;
		}

		const duration = Date.now() - this.transactionInfo.startTime.getTime();
		const rollbackCount = this.transactionInfo.operations.filter(
			op => op.operation === 'ROLLBACK' || op.operation === 'ROLLBACK_TO_SAVEPOINT',
		).length;

		return {
			transactionId: this.transactionInfo.id,
			duration,
			operationsCount: this.transactionInfo.operations.length,
			savepointsCreated: this.transactionInfo.savepoints.length,
			rollbacksPerformed: rollbackCount,
			isActive: true,
		};
	}

	getSavepoints(): string[] {
		return this.transactionInfo ? this.transactionInfo.savepoints.map(sp => sp.name) : [];
	}

	getSavepointInfo(name: string): SavepointInfo | null {
		if (!this.transactionInfo) {
			return null;
		}

		const savepoint = this.transactionInfo.savepoints.find(sp => sp.name === name);
		return savepoint || null;
	}

	async validateTransaction(): Promise<{
		isValid: boolean;
		issues: string[];
		warnings: string[];
	}> {
		const issues: string[] = [];
		const warnings: string[] = [];

		if (!this.transactionInfo) {
			issues.push('No active transaction');
			return { isValid: false, issues, warnings };
		}

		try {
			// Check if connection is still valid
			const isValid = await this.connection.connection.isValid(5);
			if (!isValid) {
				issues.push('Database connection is no longer valid');
			}

			// Check transaction duration
			const duration = Date.now() - this.transactionInfo.startTime.getTime();
			if (duration > 300000) {
				// 5 minutes
				warnings.push(`Transaction has been active for ${Math.round(duration / 1000)} seconds`);
			}

			// Check number of savepoints
			if (this.transactionInfo.savepoints.length > 20) {
				warnings.push(`High number of savepoints: ${this.transactionInfo.savepoints.length}`);
			}

			return {
				isValid: issues.length === 0,
				issues,
				warnings,
			};
		} catch (error) {
			issues.push(`Error validating transaction: ${error.message}`);
			return { isValid: false, issues, warnings };
		}
	}

	async getConnectionInfo(): Promise<{
		autoCommit: boolean;
		isolationLevel: string;
		readOnly: boolean;
		transactionIsolation: number;
	}> {
		try {
			const autoCommit = await this.connection.connection.getAutoCommit();
			const isolationLevel = await this.connection.connection.getTransactionIsolation();
			const readOnly = await this.connection.connection.isReadOnly();

			return {
				autoCommit,
				isolationLevel: this.getIsolationLevelName(isolationLevel),
				readOnly,
				transactionIsolation: isolationLevel,
			};
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to get connection info');
		}
	}

	async forceRollback(): Promise<void> {
		if (!this.transactionInfo) {
			return;
		}

		try {
			await this.connection.connection.rollback();
		} catch (error) {
			console.warn('Failed to rollback during force cleanup:', error.message);
		}

		await this.restoreConnectionState();
		this.transactionInfo = null;
	}

	private async restoreConnectionState(): Promise<void> {
		try {
			if (this.originalAutoCommit !== undefined) {
				await this.connection.connection.setAutoCommit(this.originalAutoCommit);
			}

			if (this.originalIsolationLevel !== undefined) {
				await this.connection.connection.setTransactionIsolation(this.originalIsolationLevel);
			}

			if (this.originalReadOnly !== undefined) {
				await this.connection.connection.setReadOnly(this.originalReadOnly);
			}
		} catch (error) {
			console.warn('Failed to restore connection state:', error.message);
		}
	}

	private getIsolationLevel(level: string): number {
		const Connection = java.import('java.sql.Connection');

		switch (level) {
			case 'READ_UNCOMMITTED':
				return Connection.TRANSACTION_READ_UNCOMMITTED;
			case 'READ_COMMITTED':
				return Connection.TRANSACTION_READ_COMMITTED;
			case 'REPEATABLE_READ':
				return Connection.TRANSACTION_REPEATABLE_READ;
			case 'SERIALIZABLE':
				return Connection.TRANSACTION_SERIALIZABLE;
			default:
				throw new Error(`Unknown isolation level: ${level}`);
		}
	}

	private getIsolationLevelName(level: number): string {
		const Connection = java.import('java.sql.Connection');

		switch (level) {
			case Connection.TRANSACTION_READ_UNCOMMITTED:
				return 'READ_UNCOMMITTED';
			case Connection.TRANSACTION_READ_COMMITTED:
				return 'READ_COMMITTED';
			case Connection.TRANSACTION_REPEATABLE_READ:
				return 'REPEATABLE_READ';
			case Connection.TRANSACTION_SERIALIZABLE:
				return 'SERIALIZABLE';
			case Connection.TRANSACTION_NONE:
				return 'NONE';
			default:
				return 'UNKNOWN';
		}
	}

	private generateTransactionId(): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substr(2, 9);
		return `TXN_${timestamp}_${random}`;
	}

	private generateSavepointName(): string {
		const timestamp = Date.now();
		const count = this.transactionInfo?.savepoints.length || 0;
		return `SP_${timestamp}_${count + 1}`;
	}

	// Distributed transaction support (basic implementation)
	async beginDistributedTransaction(): Promise<string> {
		if (!this.distributedConfig?.enableXA) {
			throw new Error('XA transactions not enabled');
		}

		// This would integrate with a transaction manager like Atomikos or Bitronix
		// For now, this is a placeholder for future XA implementation
		throw new Error('Distributed transactions not yet implemented');
	}

	async prepareDistributedTransaction(): Promise<void> {
		if (!this.distributedConfig?.enableXA) {
			throw new Error('XA transactions not enabled');
		}

		// XA prepare phase implementation would go here
		throw new Error('Distributed transactions not yet implemented');
	}

	// Utility methods
	static async executeInTransaction<T>(
		connection: JdbcConnection,
		operation: (txManager: TransactionManager) => Promise<T>,
		options?: TransactionOptions,
	): Promise<T> {
		const txManager = new TransactionManager(connection);

		try {
			await txManager.beginTransaction(options);
			const result = await operation(txManager);
			await txManager.commit();
			return result;
		} catch (error) {
			await txManager.rollback();
			throw error;
		}
	}

	static async executeWithSavepoint<T>(
		connection: JdbcConnection,
		operation: (txManager: TransactionManager) => Promise<T>,
		savepointName?: string,
	): Promise<T> {
		const txManager = new TransactionManager(connection);

		if (!txManager.isInTransaction()) {
			throw new Error('No active transaction for savepoint operation');
		}

		return txManager.executeWithSavepoint(async () => {
			return operation(txManager);
		}, savepointName);
	}

	async close(): Promise<void> {
		if (this.isInTransaction()) {
			console.warn('Force rolling back active transaction during close');
			await this.forceRollback();
		}
	}
}
