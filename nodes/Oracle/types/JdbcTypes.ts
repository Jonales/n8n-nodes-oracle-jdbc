import { AdvancedPoolConfig, OracleConnectionConfig, SSLConfiguration } from './ConfigTypes';

// Core JDBC configuration
export interface OracleJdbcConfig extends OracleConnectionConfig {
	username: string;
	password: string;
	connectionOptions?: OracleJdbcConnectionOptions;
	jdbcUrl?: string;
	driverClassName?: string;
	validationQuery?: string;
	isSuccessful: boolean;
	responseTime: number;
	error?: string;
}

export interface DriverInitializationOptions {
	classpath?: string[];
	enableLogging?: boolean;
}

export interface ConnectionTestResult {
	isSuccessful: boolean;
	responseTime: number;
	error?: string;
}

// Extended JDBC connection options
export interface OracleJdbcConnectionOptions {
	connectionTimeout?: number;
	socketTimeout?: number;
	loginTimeout?: number;
	queryTimeout?: number;
	sslMode?: 'disabled' | 'required' | 'verify-ca' | 'verify-full';
	schema?: string;
	role?: string;
	sysdba?: boolean;
	sysoper?: boolean;
	internal?: boolean;
	prelim?: boolean;
	autoCommit?: boolean;
	readOnly?: boolean;
	isolationLevel?: TransactionIsolationLevel;
	fetchSize?: number;
	maxFieldSize?: number;
	maxRows?: number;
	escapeProcessing?: boolean;
	cursorName?: string;
	poolable?: boolean;
	closeOnCompletion?: boolean;
	largeMaxRows?: number;
	// Oracle-specific options
	oracleConnectionAttributes?: { [key: string]: string };
	oracleProxyAuthentication?: OracleProxyAuthConfig;
	oracleApplicationContext?: OracleApplicationContext[];
}

// Oracle proxy authentication
export interface OracleProxyAuthConfig {
	proxyUser?: string;
	proxyPassword?: string;
	distinguishedName?: string;
	certificate?: Buffer;
	roles?: string[];
}

// Oracle application context
export interface OracleApplicationContext {
	namespace: string;
	attribute: string;
	value: string;
}

// Transaction isolation levels
export type TransactionIsolationLevel =
	| 'NONE'
	| 'READ_UNCOMMITTED'
	| 'READ_COMMITTED'
	| 'REPEATABLE_READ'
	| 'SERIALIZABLE';

// Enhanced JDBC connection with metadata
export interface JdbcConnection {
	id: string;
	connection: any; // Java Connection object
	config: OracleJdbcConfig;
	createdAt: Date;
	lastUsed?: Date;
	usageCount?: number;
	isActive: boolean;
	isPooled?: boolean;
	poolId?: string;
	labels?: ConnectionLabel[];
	metadata?: ConnectionMetadata;
	statistics?: ConnectionStatistics;
	transactionInfo?: ActiveTransactionInfo;
}

// Connection labels for session state management
export interface ConnectionLabel {
	key: string;
	value: string;
	cost?: number;
	applyCallback?: string;
	removeCallback?: string;
}

// Connection metadata
export interface ConnectionMetadata {
	databaseProductName?: string;
	databaseProductVersion?: string;
	databaseMajorVersion?: number;
	databaseMinorVersion?: number;
	driverName?: string;
	driverVersion?: string;
	driverMajorVersion?: number;
	driverMinorVersion?: number;
	jdbcMajorVersion?: number;
	jdbcMinorVersion?: number;
	url?: string;
	userName?: string;
	schema?: string;
	catalog?: string;
	serverName?: string;
	portNumber?: number;
	instanceName?: string;
	serviceName?: string;
	sid?: string;
	characterSet?: string;
	nationalCharacterSet?: string;
	supportsTransactions?: boolean;
	supportsMultipleTransactions?: boolean;
	supportsSavepoints?: boolean;
	supportsNamedParameters?: boolean;
	supportsMultipleResultSets?: boolean;
	supportsBatchUpdates?: boolean;
	supportsStoredProcedures?: boolean;
	supportsStoredFunctions?: boolean;
	maxConnections?: number;
	maxStatements?: number;
	maxTablesInSelect?: number;
	maxColumnsInTable?: number;
	maxColumnsInSelect?: number;
	maxRowSize?: number;
	maxStatementLength?: number;
	maxTableNameLength?: number;
	maxColumnNameLength?: number;
	isReadOnly?: boolean;
	autoCommit?: boolean;
	transactionIsolation?: TransactionIsolationLevel;
}

// Connection statistics
export interface ConnectionStatistics {
	totalQueries?: number;
	totalUpdates?: number;
	totalTransactions?: number;
	totalCommits?: number;
	totalRollbacks?: number;
	totalErrors?: number;
	averageQueryTime?: number;
	averageUpdateTime?: number;
	longestQuery?: number;
	shortestQuery?: number;
	bytesReceived?: number;
	bytesSent?: number;
	lastQueryTime?: Date;
	lastUpdateTime?: Date;
	lastCommitTime?: Date;
	lastRollbackTime?: Date;
	lastErrorTime?: Date;
	connectionUptime?: number;
}

// Active transaction information
export interface ActiveTransactionInfo {
	transactionId?: string;
	startTime?: Date;
	isolationLevel?: TransactionIsolationLevel;
	isReadOnly?: boolean;
	savepoints?: SavepointInfo[];
	operations?: TransactionOperation[];
}

export interface SavepointInfo {
	name: string;
	id?: number;
	createdAt: Date;
	isNamed: boolean;
}

export interface TransactionOperation {
	timestamp: Date;
	type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CALL' | 'DDL';
	statement?: string;
	rowsAffected?: number;
	executionTime?: number;
}

// Enhanced query result with extended metadata
export interface QueryResult {
	rows: any[];
	rowCount: number;
	executionTime: number;
	fetchTime?: number;
	metadata?: QueryResultMetadata;
	warnings?: QueryWarning[];
	statistics?: QueryStatistics;
	moreResults?: boolean;
	updateCounts?: number[];
}

// Query result metadata
export interface QueryResultMetadata {
	columns?: ColumnMetadata[];
	totalColumns?: number;
	hasGeneratedKeys?: boolean;
	generatedKeys?: any[];
	statementType?: StatementType;
	isScrollable?: boolean;
	isUpdatable?: boolean;
	concurrency?: ResultSetConcurrency;
	holdability?: ResultSetHoldability;
	fetchDirection?: FetchDirection;
	fetchSize?: number;
}

// Enhanced column metadata
export interface ColumnMetadata {
	name: string;
	label?: string;
	type: string;
	typeName?: string;
	className?: string;
	sqlType?: number;
	size?: number;
	precision?: number;
	scale?: number;
	displaySize?: number;
	nullable?: boolean;
	autoIncrement?: boolean;
	caseSensitive?: boolean;
	searchable?: boolean;
	signed?: boolean;
	readOnly?: boolean;
	writable?: boolean;
	definitelyWritable?: boolean;
	tableName?: string;
	schemaName?: string;
	catalogName?: string;
	comment?: string;
	defaultValue?: any;
	ordinalPosition?: number;
	isGenerated?: boolean;
	generatedType?: 'ALWAYS' | 'BY_DEFAULT';
}

// Statement types
export type StatementType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CALL' | 'DDL' | 'UNKNOWN';

// ResultSet properties
export type ResultSetConcurrency = 'READ_ONLY' | 'UPDATABLE';
export type ResultSetHoldability = 'CLOSE_CURSORS_AT_COMMIT' | 'HOLD_CURSORS_OVER_COMMIT';
export type FetchDirection = 'FORWARD' | 'REVERSE' | 'UNKNOWN';

// Query warnings
export interface QueryWarning {
	code: string;
	message: string;
	state?: string;
	severity?: 'INFO' | 'WARNING' | 'ERROR';
	cause?: string;
}

// Query statistics
export interface QueryStatistics {
	parseTime?: number;
	bindTime?: number;
	executeTime?: number;
	fetchTime?: number;
	totalTime?: number;
	rowsExamined?: number;
	rowsReturned?: number;
	logicalReads?: number;
	physicalReads?: number;
	cpuTime?: number;
	waitTime?: number;
	lockWaitTime?: number;
	memoryUsed?: number;
	tempSpaceUsed?: number;
	ioWaitTime?: number;
	networkRoundTrips?: number;
	planHashValue?: number;
	executionPlan?: ExecutionPlanStep[];
}

// Query execution plan
export interface ExecutionPlanStep {
	id: number;
	parentId?: number;
	operation: string;
	objectName?: string;
	objectType?: string;
	optimizer?: string;
	cost?: number;
	cardinality?: number;
	bytes?: number;
	cpuCost?: number;
	ioCost?: number;
	tempSpace?: number;
	accessPredicates?: string;
	filterPredicates?: string;
	projection?: string;
	time?: number;
	depth: number;
	position: number;
}

// Query options for execution
export interface QueryOptions {
	fetchSize?: number;
	maxRows?: number;
	queryTimeout?: number;
	cursorName?: string;
	escapeProcessing?: boolean;
	poolable?: boolean;
	closeOnCompletion?: boolean;
	largeMaxRows?: number;
	resultSetType?: ResultSetType;
	resultSetConcurrency?: ResultSetConcurrency;
	resultSetHoldability?: ResultSetHoldability;
	autoGeneratedKeys?: boolean | string[] | number[];
	columnIndexes?: number[];
	columnNames?: string[];
	enableStatistics?: boolean;
	enableProfiling?: boolean;
	explainPlan?: boolean;
	hints?: string[];
	tags?: { [key: string]: string };
	timeout?: number;
}

// ResultSet types
export type ResultSetType = 'FORWARD_ONLY' | 'SCROLL_INSENSITIVE' | 'SCROLL_SENSITIVE';

// Parameter definition with enhanced metadata
export interface ParameterDefinition {
	name?: string;
	value: any;
	type: ParameterType;
	sqlType?: number;
	mode?: ParameterMode;
	size?: number;
	precision?: number;
	scale?: number;
	nullable?: boolean;
	description?: string;
	defaultValue?: any;
	constraints?: ParameterConstraints;
}

// Parameter types
export type ParameterType =
	| 'string'
	| 'number'
	| 'boolean'
	| 'date'
	| 'timestamp'
	| 'time'
	| 'null'
	| 'clob'
	| 'blob'
	| 'cursor'
	| 'array'
	| 'object'
	| 'xml'
	| 'json'
	| 'rowid'
	| 'urowid'
	| 'bfile'
	| 'raw'
	| 'long'
	| 'long_raw';

// Parameter modes
export type ParameterMode = 'IN' | 'OUT' | 'INOUT';

// Parameter constraints
export interface ParameterConstraints {
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	minValue?: number;
	maxValue?: number;
	pattern?: RegExp | string;
	enumValues?: any[];
	customValidator?: (value: any) => boolean | string;
}

// Batch operation interfaces
export interface BatchOperation {
	sql: string;
	parameters?: any[];
	options?: BatchOperationOptions;
}

export interface BatchOperationOptions {
	continueOnError?: boolean;
	validateParameters?: boolean;
	enableStatistics?: boolean;
	timeout?: number;
	priority?: 'LOW' | 'NORMAL' | 'HIGH';
	tags?: { [key: string]: string };
}

export interface BatchResult {
	results: BatchOperationResult[];
	totalExecutionTime: number;
	successCount: number;
	errorCount: number;
	statistics?: BatchStatistics;
	warnings?: QueryWarning[];
}

export interface BatchOperationResult {
	index: number;
	success: boolean;
	rowCount?: number;
	executionTime?: number;
	error?: Error;
	generatedKeys?: any[];
	warnings?: QueryWarning[];
}

export interface BatchStatistics {
	totalOperations: number;
	averageExecutionTime: number;
	minExecutionTime: number;
	maxExecutionTime: number;
	totalRowsAffected: number;
	throughput: number; // operations per second
	errorRate: number; // percentage
}

// Connection pool statistics
export interface PoolStatistics {
	poolId: string;
	poolName: string;
	totalConnections: number;
	activeConnections: number;
	idleConnections: number;
	availableConnections: number;
	borrowedConnections: number;
	peakConnections: number;
	connectionsCreated: number;
	connectionsClosed: number;
	connectionsDestroyed: number;
	failedConnections: number;
	connectionWaitTime: number;
	connectionBorrowTime: number;
	connectionReturnTime: number;
	cumulativeConnectionBorrowTime: number;
	cumulativeConnectionReturnTime: number;
	averageBorrowWaitTime: number;
	averageCreationTime: number;
	maxBorrowWaitTime: number;
	minBorrowWaitTime: number;
	totalBorrowedConnections: number;
	totalReturnedConnections: number;
	validationErrors: number;
	lastBorrowTime?: Date;
	lastReturnTime?: Date;
	lastValidationTime?: Date;
	poolStartTime?: Date;
	poolUptime?: number;
}

// Error types
export interface JdbcError extends Error {
	code?: string;
	sqlState?: string;
	vendorCode?: number;
	severity?: 'WARNING' | 'ERROR' | 'FATAL';
	retryable?: boolean;
	category?: 'CONNECTION' | 'SYNTAX' | 'CONSTRAINT' | 'PERMISSION' | 'RESOURCE' | 'UNKNOWN';
	context?: ErrorContext;
}

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
}

// Type utilities and type guards
export namespace JdbcTypes {
	export function isJdbcConnection(obj: any): obj is JdbcConnection {
		return obj && typeof obj.id === 'string' && obj.connection && obj.config;
	}

	export function isQueryResult(obj: any): obj is QueryResult {
		return obj && Array.isArray(obj.rows) && typeof obj.rowCount === 'number';
	}

	export function isBatchResult(obj: any): obj is BatchResult {
		return obj && Array.isArray(obj.results) && typeof obj.totalExecutionTime === 'number';
	}

	export function isJdbcError(obj: any): obj is JdbcError {
		return obj instanceof Error && 'sqlState' in obj;
	}

	export function createParameterDefinition(
		value: any,
		type?: ParameterType,
		options?: Partial<ParameterDefinition>,
	): ParameterDefinition {
		const inferredType = type || inferParameterType(value);
		return {
			value,
			type: inferredType,
			...options,
		};
	}

	export function inferParameterType(value: any): ParameterType {
		if (value === null || value === undefined) return 'null';
		if (typeof value === 'string') return 'string';
		if (typeof value === 'number') return 'number';
		if (typeof value === 'boolean') return 'boolean';
		if (value instanceof Date) return 'timestamp';
		if (Buffer.isBuffer(value)) return 'blob';
		if (Array.isArray(value)) return 'array';
		if (typeof value === 'object') return 'object';
		return 'string';
	}

	export function validateConfig(config: OracleJdbcConfig): string[] {
		const errors: string[] = [];

		if (!config.host) errors.push('Host is required');
		if (!config.port || config.port <= 0 || config.port > 65535) {
			errors.push('Port must be between 1 and 65535');
		}
		if (!config.username) errors.push('Username is required');
		if (!config.password) errors.push('Password is required');

		if (config.connectionType === 'service' && !config.serviceName) {
			errors.push('Service name is required for service connection type');
		}
		if (config.connectionType === 'sid' && !config.sid) {
			errors.push('SID is required for sid connection type');
		}
		if (config.connectionType === 'tns' && !config.tnsString) {
			errors.push('TNS string is required for tns connection type');
		}

		return errors;
	}
}

// Re-export common types for convenience
export type { SSLConfiguration, AdvancedPoolConfig } from './ConfigTypes';
