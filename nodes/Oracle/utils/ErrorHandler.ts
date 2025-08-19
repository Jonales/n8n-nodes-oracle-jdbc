/**
 * Oracle para n8n-nodes-oracle-jdbc
 * Suporte para modo JDBC
 *
 * @author Jônatas Meireles Sousa Vieira
 * @version 0.0.1-rc.1
 */
import { NodeOperationError } from 'n8n-workflow';

import { OracleErrorCodes } from '../types/OracleTypes';

export interface ErrorContext {
	operation?: string;
	connectionId?: string;
	poolId?: string;
	transactionId?: string;
	procedureName?: string;
	sql?: string;
	parameters?: any[];
	timestamp?: Date;
	stackTrace?: string;
	additionalInfo?: { [key: string]: any };
	poolName?: string;
}

export interface ErrorClassification {
	category: ErrorCategory;
	severity: ErrorSeverity;
	retryable: boolean;
	recoveryAction?: string;
	estimatedRecoveryTime?: number;
}

export enum ErrorCategory {
	CONNECTION = 'CONNECTION',
	AUTHENTICATION = 'AUTHENTICATION',
	AUTHORIZATION = 'AUTHORIZATION',
	SQL_SYNTAX = 'SQL_SYNTAX',
	CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
	RESOURCE_EXHAUSTION = 'RESOURCE_EXHAUSTION',
	TRANSACTION = 'TRANSACTION',
	TIMEOUT = 'TIMEOUT',
	NETWORK = 'NETWORK',
	CONFIGURATION = 'CONFIGURATION',
	DATA_TYPE = 'DATA_TYPE',
	PL_SQL = 'PL_SQL',
	SYSTEM = 'SYSTEM',
	POOL = 'POOL',
	UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
	LOW = 'LOW',
	MEDIUM = 'MEDIUM',
	HIGH = 'HIGH',
	CRITICAL = 'CRITICAL',
}

export interface JdbcErrorDetails {
	originalError: any;
	classification: ErrorClassification;
	context: ErrorContext;
	userMessage: string;
	technicalMessage: string;
	recoverySteps: string[];
	relatedErrors?: string[];
	documentationLinks?: string[];
}

export class ErrorHandler {
	private static errorHistory: JdbcErrorDetails[] = [];
	private static maxHistorySize = 100;

	static handleJdbcError(
		error: any,
		context: string,
		errorContext?: ErrorContext,
	): NodeOperationError {
		const timestamp = new Date();

		let classification: ErrorClassification;
		let userMessage = context;
		let technicalMessage = 'An unknown error occurred';
		let recoverySteps: string[] = [];
		let relatedErrors: string[] = [];
		let documentationLinks: string[] = [];

		if (error && typeof error === 'object') {
			// Handle Java/JDBC errors
			if (error.cause && error.cause.getClass) {
				const result = this.handleJavaError(error.cause);
				classification = result.classification;
				userMessage = result.userMessage;
				technicalMessage = result.technicalMessage;
				recoverySteps = result.recoverySteps;
				relatedErrors = result.relatedErrors;
				documentationLinks = result.documentationLinks;
			}
			// Handle Oracle-specific errors
			else if (error.message && this.isOracleError(error.message)) {
				const result = this.handleOracleError(error.message);
				classification = result.classification;
				userMessage = result.userMessage;
				technicalMessage = result.technicalMessage;
				recoverySteps = result.recoverySteps;
				relatedErrors = result.relatedErrors;
				documentationLinks = result.documentationLinks;
			}
			// Handle generic errors
			else {
				classification = {
					category: ErrorCategory.UNKNOWN,
					severity: ErrorSeverity.MEDIUM,
					retryable: false,
				};

				if (error.message) {
					userMessage = error.message;
					technicalMessage = error.message;
				}
			}
		} else {
			classification = {
				category: ErrorCategory.UNKNOWN,
				severity: ErrorSeverity.LOW,
				retryable: false,
			};
		}

		// Create error details
		const errorDetails: JdbcErrorDetails = {
			originalError: error,
			classification,
			context: {
				timestamp,
				...errorContext,
			},
			userMessage,
			technicalMessage,
			recoverySteps,
			relatedErrors,
			documentationLinks,
		};

		// Add to error history
		this.addToErrorHistory(errorDetails);

		// Log error for monitoring
		this.logError(errorDetails);

		// Create N8N error with enhanced details (CORREÇÃO: removido httpCode e cause)
		const nodeError = new NodeOperationError({} as any, userMessage, {
			description: this.formatErrorDescription(errorDetails),
		});

		return nodeError;
	}

	private static handleJavaError(javaError: any): {
		classification: ErrorClassification;
		userMessage: string;
		technicalMessage: string;
		recoverySteps: string[];
		relatedErrors: string[];
		documentationLinks: string[];
	} {
		const className = javaError.getClass().getSimpleName();
		const errorMessage = javaError.getMessage() || 'Unknown Java error';

		switch (className) {
			case 'SQLException':
				return this.handleSQLException(errorMessage);

			case 'SQLSyntaxErrorException':
				return {
					classification: {
						category: ErrorCategory.SQL_SYNTAX,
						severity: ErrorSeverity.MEDIUM,
						retryable: false,
						recoveryAction: 'Fix SQL syntax',
					},
					userMessage: `SQL Syntax Error: ${errorMessage}`,
					technicalMessage: `SQLSyntaxErrorException: ${errorMessage}`,
					recoverySteps: [
						'Check SQL syntax for typos and missing keywords',
						'Verify table and column names exist',
						'Ensure proper quoting of identifiers if needed',
						'Validate JOIN conditions and WHERE clauses',
					],
					relatedErrors: ['ORA-00904', 'ORA-00942', 'ORA-00933'],
					documentationLinks: [
						'https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/',
						'https://docs.oracle.com/en/error-help/',
					],
				};

			case 'SQLTimeoutException':
				return {
					classification: {
						category: ErrorCategory.TIMEOUT,
						severity: ErrorSeverity.HIGH,
						retryable: true,
						recoveryAction: 'Optimize query or increase timeout',
						estimatedRecoveryTime: 30000,
					},
					userMessage: `Query Timeout: ${errorMessage}`,
					technicalMessage: `SQLTimeoutException: ${errorMessage}`,
					recoverySteps: [
						'Optimize the SQL query for better performance',
						'Add appropriate indexes to tables',
						'Increase query timeout setting',
						'Consider breaking large operations into smaller chunks',
						'Check for table locks that might cause delays',
					],
					relatedErrors: ['ORA-01013', 'ORA-00051'],
					documentationLinks: [
						'https://docs.oracle.com/en/database/oracle/oracle-database/21/tgdba/',
						'https://docs.oracle.com/en/database/oracle/oracle-database/21/vldbg/',
					],
				};

			case 'ConnectException':
				return {
					classification: {
						category: ErrorCategory.CONNECTION,
						severity: ErrorSeverity.CRITICAL,
						retryable: true,
						recoveryAction: 'Check network connectivity',
						estimatedRecoveryTime: 5000,
					},
					userMessage: `Connection Failed: ${errorMessage}`,
					technicalMessage: `ConnectException: ${errorMessage}`,
					recoverySteps: [
						'Verify Oracle database server is running',
						'Check network connectivity to database host',
						'Confirm port 1521 (or configured port) is open',
						'Verify TNS configuration if using TNS names',
						'Check firewall settings',
						'Ensure database listener is running',
					],
					relatedErrors: ['ORA-12541', 'ORA-12514', 'ORA-12170'],
					documentationLinks: [
						'https://docs.oracle.com/en/database/oracle/oracle-database/21/netag/',
						'https://docs.oracle.com/en/database/oracle/oracle-database/21/netrf/',
					],
				};

			case 'SQLIntegrityConstraintViolationException':
				return {
					classification: {
						category: ErrorCategory.CONSTRAINT_VIOLATION,
						severity: ErrorSeverity.MEDIUM,
						retryable: false,
						recoveryAction: 'Fix data constraint violation',
					},
					userMessage: `Constraint Violation: ${errorMessage}`,
					technicalMessage: `SQLIntegrityConstraintViolationException: ${errorMessage}`,
					recoverySteps: [
						'Check for duplicate primary key values',
						'Verify foreign key references exist',
						'Ensure NOT NULL columns have values',
						'Validate CHECK constraint conditions',
						'Review data being inserted/updated',
					],
					relatedErrors: ['ORA-00001', 'ORA-02291', 'ORA-01400', 'ORA-02290'],
					documentationLinks: [
						'https://docs.oracle.com/en/database/oracle/oracle-database/21/cncpt/',
					],
				};

			default:
				return {
					classification: {
						category: ErrorCategory.SYSTEM,
						severity: ErrorSeverity.MEDIUM,
						retryable: false,
					},
					userMessage: `Database Error: ${errorMessage}`,
					technicalMessage: `${className}: ${errorMessage}`,
					recoverySteps: [
						'Check database logs for more details',
						'Contact database administrator',
						'Review recent database changes',
					],
					relatedErrors: [],
					documentationLinks: [],
				};
		}
	}

	private static handleSQLException(errorMessage: string): {
		classification: ErrorClassification;
		userMessage: string;
		technicalMessage: string;
		recoverySteps: string[];
		relatedErrors: string[];
		documentationLinks: string[];
	} {
		// Extract Oracle error code if present
		const oracleErrorMatch = errorMessage.match(/ORA-(\d{5})/);
		const oracleErrorCode = oracleErrorMatch ? `ORA-${oracleErrorMatch[1]}` : null;

		if (oracleErrorCode) {
			return this.handleOracleError(oracleErrorCode);
		}

		return {
			classification: {
				category: ErrorCategory.SQL_SYNTAX,
				severity: ErrorSeverity.MEDIUM,
				retryable: false,
			},
			userMessage: `SQL Error: ${errorMessage}`,
			technicalMessage: `SQLException: ${errorMessage}`,
			recoverySteps: [
				'Review SQL statement for syntax errors',
				'Check database connection is valid',
				'Verify user permissions for the operation',
			],
			relatedErrors: [],
			documentationLinks: [],
		};
	}

	private static handleOracleError(errorCode: string): {
		classification: ErrorClassification;
		userMessage: string;
		technicalMessage: string;
		recoverySteps: string[];
		relatedErrors: string[];
		documentationLinks: string[];
	} {
		switch (errorCode) {
			case OracleErrorCodes.CONNECTION_REFUSED:
				return {
					classification: {
						category: ErrorCategory.CONNECTION,
						severity: ErrorSeverity.CRITICAL,
						retryable: true,
						recoveryAction: 'Check database service',
						estimatedRecoveryTime: 10000,
					},
					userMessage: 'Database connection refused - service may be unavailable',
					technicalMessage: `${errorCode}: The connection descriptor used by the client to connect to the database`,
					recoverySteps: [
						'Verify the service name is correct',
						'Check if the database instance is running',
						'Confirm the listener is configured for this service',
						'Verify network connectivity to the database server',
					],
					relatedErrors: [
						OracleErrorCodes.TNS_LISTENER_NOT_LISTENING,
						OracleErrorCodes.TNS_COULD_NOT_RESOLVE,
					],
					documentationLinks: ['https://docs.oracle.com/error-help/db/ora-12514/'],
				};

			case OracleErrorCodes.INVALID_USERNAME_PASSWORD:
				return {
					classification: {
						category: ErrorCategory.AUTHENTICATION,
						severity: ErrorSeverity.HIGH,
						retryable: false,
						recoveryAction: 'Check credentials',
					},
					userMessage: 'Invalid username or password',
					technicalMessage: `${errorCode}: Invalid username/password; logon denied`,
					recoverySteps: [
						'Verify username and password are correct',
						'Check if account is locked or expired',
						'Confirm user exists in the database',
						'Ensure proper case sensitivity for credentials',
					],
					relatedErrors: [OracleErrorCodes.ACCOUNT_LOCKED, OracleErrorCodes.PASSWORD_EXPIRED],
					documentationLinks: ['https://docs.oracle.com/error-help/db/ora-01017/'],
				};

			case OracleErrorCodes.UNIQUE_CONSTRAINT_VIOLATED:
				return {
					classification: {
						category: ErrorCategory.CONSTRAINT_VIOLATION,
						severity: ErrorSeverity.MEDIUM,
						retryable: false,
						recoveryAction: 'Handle duplicate values',
					},
					userMessage: 'Unique constraint violation - duplicate value detected',
					technicalMessage: `${errorCode}: unique constraint violated`,
					recoverySteps: [
						'Check for duplicate primary key or unique values',
						'Use INSERT ... ON DUPLICATE KEY UPDATE if appropriate',
						'Query existing data to avoid duplicates',
						'Consider using MERGE statement for upsert operations',
					],
					relatedErrors: [
						OracleErrorCodes.CHECK_CONSTRAINT_VIOLATED,
						OracleErrorCodes.NOT_NULL_CONSTRAINT_VIOLATED,
					],
					documentationLinks: ['https://docs.oracle.com/error-help/db/ora-00001/'],
				};

			case OracleErrorCodes.DEADLOCK_DETECTED:
				return {
					classification: {
						category: ErrorCategory.TRANSACTION,
						severity: ErrorSeverity.HIGH,
						retryable: true,
						recoveryAction: 'Retry transaction',
						estimatedRecoveryTime: 1000,
					},
					userMessage: 'Deadlock detected - transaction rolled back',
					technicalMessage: `${errorCode}: deadlock detected while waiting for resource`,
					recoverySteps: [
						'Retry the transaction after a brief delay',
						'Consider changing transaction isolation level',
						'Optimize transaction order to prevent deadlocks',
						'Keep transactions as short as possible',
					],
					relatedErrors: [OracleErrorCodes.LOCK_TIMEOUT, OracleErrorCodes.TRANSACTION_BACKED_OUT],
					documentationLinks: ['https://docs.oracle.com/error-help/db/ora-00060/'],
				};

			case OracleErrorCodes.TABLESPACE_FULL:
				return {
					classification: {
						category: ErrorCategory.RESOURCE_EXHAUSTION,
						severity: ErrorSeverity.CRITICAL,
						retryable: false,
						recoveryAction: 'Free up tablespace',
					},
					userMessage: 'Tablespace is full - cannot complete operation',
					technicalMessage: `${errorCode}: unable to extend tablespace`,
					recoverySteps: [
						'Add more space to the tablespace',
						'Purge unnecessary data or logs',
						'Compress existing data if possible',
						'Contact database administrator for space management',
					],
					relatedErrors: [OracleErrorCodes.OUT_OF_MEMORY],
					documentationLinks: ['https://docs.oracle.com/error-help/db/ora-01653/'],
				};

			default:
				return {
					classification: {
						category: ErrorCategory.UNKNOWN,
						severity: ErrorSeverity.MEDIUM,
						retryable: false,
					},
					userMessage: `Oracle Error: ${errorCode}`,
					technicalMessage: `Unhandled Oracle error: ${errorCode}`,
					recoverySteps: [
						'Consult Oracle error documentation',
						'Check database logs for more information',
						'Contact support with error details',
					],
					relatedErrors: [],
					documentationLinks: [`https://docs.oracle.com/error-help/db/${errorCode.toLowerCase()}/`],
				};
		}
	}

	static isRetryableError(error: any): boolean {
		if (!error || typeof error !== 'object') {
			return false;
		}

		const retryablePatterns = [
			/connection reset/i,
			/connection timed out/i,
			/network is unreachable/i,
			/temporary failure/i,
			/deadlock/i,
			/lock timeout/i,
			/ora-00060/i, // deadlock
			/ora-30006/i, // lock timeout
			/ora-12170/i, // timeout
			/ora-12541/i, // listener not listening
		];

		const errorMessage = error.message || error.toString();
		return retryablePatterns.some(pattern => pattern.test(errorMessage));
	}

	static getRecoveryTime(error: any): number {
		// Extract error code and return estimated recovery time
		const errorMessage = error?.message || '';

		if (/deadlock/i.test(errorMessage) || /ora-00060/i.test(errorMessage)) {
			return 1000; // 1 second for deadlock
		}
		if (/timeout/i.test(errorMessage) || /ora-12170/i.test(errorMessage)) {
			return 5000; // 5 seconds for timeout
		}
		if (/connection/i.test(errorMessage)) {
			return 10000; // 10 seconds for connection issues
		}

		return 3000; // Default 3 seconds
	}

	static formatErrorForLogging(errorDetails: JdbcErrorDetails): string {
		return JSON.stringify(
			{
				timestamp: errorDetails.context.timestamp,
				category: errorDetails.classification.category,
				severity: errorDetails.classification.severity,
				message: errorDetails.technicalMessage,
				context: errorDetails.context,
				retryable: errorDetails.classification.retryable,
			},
			null,
			2,
		);
	}

	static getErrorStatistics(): {
		totalErrors: number;
		errorsByCategory: { [category: string]: number };
		errorsBySeverity: { [severity: string]: number };
		retryableErrors: number;
		recentErrors: JdbcErrorDetails[];
	} {
		const errorsByCategory: { [category: string]: number } = {};
		const errorsBySeverity: { [severity: string]: number } = {};
		let retryableErrors = 0;

		this.errorHistory.forEach(error => {
			const category = error.classification.category;
			const severity = error.classification.severity;

			errorsByCategory[category] = (errorsByCategory[category] || 0) + 1;
			errorsBySeverity[severity] = (errorsBySeverity[severity] || 0) + 1;

			if (error.classification.retryable) {
				retryableErrors++;
			}
		});

		return {
			totalErrors: this.errorHistory.length,
			errorsByCategory,
			errorsBySeverity,
			retryableErrors,
			recentErrors: this.errorHistory.slice(-10), // Last 10 errors
		};
	}

	static clearErrorHistory(): void {
		this.errorHistory = [];
	}

	private static isOracleError(message: string): boolean {
		return /ORA-\d{5}/.test(message);
	}

	private static addToErrorHistory(errorDetails: JdbcErrorDetails): void {
		this.errorHistory.push(errorDetails);

		// Keep only the most recent errors
		if (this.errorHistory.length > this.maxHistorySize) {
			this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
		}
	}

	private static logError(errorDetails: JdbcErrorDetails): void {
		const logLevel = this.getLogLevel(errorDetails.classification.severity);
		const logMessage = this.formatErrorForLogging(errorDetails);

		// Use appropriate logging based on severity
		switch (logLevel) {
			case 'error':
				console.error(`JDBC Error [${errorDetails.classification.category}]:`, logMessage);
				break;
			case 'warn':
				console.warn(`JDBC Warning [${errorDetails.classification.category}]:`, logMessage);
				break;
			case 'info':
				console.info(`JDBC Info [${errorDetails.classification.category}]:`, logMessage);
				break;
			default:
				console.log(`JDBC Log [${errorDetails.classification.category}]:`, logMessage);
		}
	}

	private static formatErrorDescription(errorDetails: JdbcErrorDetails): string {
		let description = `**Technical Details:**\n${errorDetails.technicalMessage}\n`;

		if (errorDetails.recoverySteps.length > 0) {
			description += '\n**Recovery Steps:**\n';
			errorDetails.recoverySteps.forEach((step, index) => {
				description += `${index + 1}. ${step}\n`;
			});
		}

		if (errorDetails.classification.retryable) {
			description += '\n**Retry Information:**\n';
			description += 'This error is retryable. ';
			if (errorDetails.classification.estimatedRecoveryTime) {
				description += `Recommended retry delay: ${errorDetails.classification.estimatedRecoveryTime}ms.`;
			}
		}

		if (errorDetails.relatedErrors && errorDetails.relatedErrors.length > 0) {
			description += '\n**Related Error Codes:**\n';
			description += errorDetails.relatedErrors.join(', ');
		}

		if (errorDetails.documentationLinks && errorDetails.documentationLinks.length > 0) {
			description += '\n\n**Documentation:**\n';
			errorDetails.documentationLinks.forEach(link => {
				description += `• ${link}\n`;
			});
		}

		return description;
	}

	// REMOVIDO: getHttpCodeFromClassification() - não é suportado pelo NodeOperationError

	private static getLogLevel(severity: ErrorSeverity): string {
		switch (severity) {
			case ErrorSeverity.CRITICAL:
			case ErrorSeverity.HIGH:
				return 'error';
			case ErrorSeverity.MEDIUM:
				return 'warn';
			case ErrorSeverity.LOW:
				return 'info';
			default:
				return 'log';
		}
	}

	// Utility method for creating context
	static createErrorContext(options: {
		operation?: string;
		connectionId?: string;
		sql?: string;
		parameters?: any[];
		additionalInfo?: { [key: string]: any };
	}): ErrorContext {
		return {
			timestamp: new Date(),
			stackTrace: new Error().stack,
			...options,
		};
	}

	// Métodos adicionais para análise de erros

	/**
	 * Verifica se um erro específico está acontecendo frequentemente
	 */
	static isFrequentError(errorPattern: string, timeWindowMs: number = 300000): boolean {
		const now = Date.now();
		const recentErrors = this.errorHistory.filter(error => {
			const errorTime = error.context.timestamp?.getTime() || 0;
			return now - errorTime <= timeWindowMs;
		});

		const matchingErrors = recentErrors.filter(
			error =>
				error.technicalMessage.includes(errorPattern) || error.userMessage.includes(errorPattern),
		);

		return matchingErrors.length >= 3; // 3 ou mais ocorrências na janela de tempo
	}

	/**
	 * Obtém sugestões de otimização baseadas no histórico de erros
	 */
	static getOptimizationSuggestions(): string[] {
		const suggestions: string[] = [];
		const stats = this.getErrorStatistics();

		// Sugestões baseadas em categorias frequentes
		const topCategory = Object.keys(stats.errorsByCategory).reduce(
			(a, b) => (stats.errorsByCategory[a] > stats.errorsByCategory[b] ? a : b),
			'',
		);

		switch (topCategory) {
			case ErrorCategory.CONNECTION:
				suggestions.push('Consider implementing connection pooling with proper sizing');
				suggestions.push('Review database server capacity and network stability');
				break;
			case ErrorCategory.TIMEOUT:
				suggestions.push('Analyze slow queries and add appropriate indexes');
				suggestions.push('Consider increasing query timeout values for complex operations');
				break;
			case ErrorCategory.TRANSACTION:
				suggestions.push('Optimize transaction ordering to reduce deadlock probability');
				suggestions.push('Keep transactions as short as possible');
				break;
			case ErrorCategory.RESOURCE_EXHAUSTION:
				suggestions.push('Monitor database resource usage and plan for capacity');
				suggestions.push('Implement data archiving strategies for large tables');
				break;
		}

		// Sugestões baseadas na taxa de retry
		const retryRate = (stats.retryableErrors / stats.totalErrors) * 100;
		if (retryRate > 50) {
			suggestions.push('High retry rate detected - review infrastructure stability');
		}

		return suggestions;
	}

	/**
	 * Exporta o histórico de erros para análise externa
	 */
	static exportErrorHistory(): {
		exportDate: string;
		totalErrors: number;
		errors: JdbcErrorDetails[];
		statistics: ReturnType<typeof ErrorHandler.getErrorStatistics>;
		suggestions: string[];
	} {
		return {
			exportDate: new Date().toISOString(),
			totalErrors: this.errorHistory.length,
			errors: [...this.errorHistory], // Clone do array
			statistics: this.getErrorStatistics(),
			suggestions: this.getOptimizationSuggestions(),
		};
	}
}
