// Oracle SQL data types constants
export const OracleDataTypes = {
	// Character data types
	CHAR: 'CHAR',
	NCHAR: 'NCHAR',
	VARCHAR2: 'VARCHAR2',
	NVARCHAR2: 'NVARCHAR2',
	CLOB: 'CLOB',
	NCLOB: 'NCLOB',
	LONG: 'LONG',

	// Numeric data types
	NUMBER: 'NUMBER',
	FLOAT: 'FLOAT',
	BINARY_FLOAT: 'BINARY_FLOAT',
	BINARY_DOUBLE: 'BINARY_DOUBLE',
	INTEGER: 'INTEGER',
	SMALLINT: 'SMALLINT',
	DECIMAL: 'DECIMAL',
	NUMERIC: 'NUMERIC',

	// Date and time data types
	DATE: 'DATE',
	TIMESTAMP: 'TIMESTAMP',
	TIMESTAMP_WITH_TIME_ZONE: 'TIMESTAMP WITH TIME ZONE',
	TIMESTAMP_WITH_LOCAL_TIME_ZONE: 'TIMESTAMP WITH LOCAL TIME ZONE',
	INTERVAL_YEAR_TO_MONTH: 'INTERVAL YEAR TO MONTH',
	INTERVAL_DAY_TO_SECOND: 'INTERVAL DAY TO SECOND',

	// Large object data types
	BLOB: 'BLOB',
	BFILE: 'BFILE',

	// Rowid data types
	ROWID: 'ROWID',
	UROWID: 'UROWID',

	// Raw data types
	RAW: 'RAW',
	LONG_RAW: 'LONG RAW',

	// XML data type
	XMLTYPE: 'XMLTYPE',

	// JSON data type (Oracle 21c+)
	JSON: 'JSON',

	// Spatial data types
	SDO_GEOMETRY: 'SDO_GEOMETRY',
	SDO_TOPO_GEOMETRY: 'SDO_TOPO_GEOMETRY',
	SDO_GEORASTER: 'SDO_GEORASTER',

	// Oracle-specific types
	REF: 'REF',
	VARRAY: 'VARRAY',
	NESTED_TABLE: 'NESTED TABLE',
	OBJECT: 'OBJECT',
	REF_CURSOR: 'REF CURSOR',
	PLS_INTEGER: 'PLS_INTEGER',
	BINARY_INTEGER: 'BINARY_INTEGER',
	BOOLEAN: 'BOOLEAN', // PL/SQL only
} as const;

// Oracle-specific type definitions
export interface OracleSpecificTypes {
	CURSOR: 'CURSOR';
	ROWID: 'ROWID';
	UROWID: 'UROWID';
	XMLTYPE: 'XMLTYPE';
	BFILE: 'BFILE';
	JSON: 'JSON';
	SDO_GEOMETRY: 'SDO_GEOMETRY';
	REF_CURSOR: 'REF_CURSOR';
	VARRAY: 'VARRAY';
	NESTED_TABLE: 'NESTED_TABLE';
	OBJECT: 'OBJECT';
	INTERVAL_YM: 'INTERVAL_YEAR_TO_MONTH';
	INTERVAL_DS: 'INTERVAL_DAY_TO_SECOND';
	TIMESTAMP_TZ: 'TIMESTAMP_WITH_TIME_ZONE';
	TIMESTAMP_LTZ: 'TIMESTAMP_WITH_LOCAL_TIME_ZONE';
	BINARY_FLOAT: 'BINARY_FLOAT';
	BINARY_DOUBLE: 'BINARY_DOUBLE';
}

// Oracle JDBC connection properties
export interface OracleConnectionProperties {
	// Basic connection properties
	'oracle.jdbc.implicitStatementCacheSize'?: string;
	'oracle.jdbc.autoCommitSpecCompliant'?: string;
	'oracle.jdbc.defaultRowPrefetch'?: string;
	'oracle.jdbc.defaultBatchValue'?: string;
	'oracle.jdbc.ReadTimeout'?: string;
	'oracle.jdbc.loginTimeout'?: string;
	'oracle.jdbc.timestampTzInGmt'?: string;
	'oracle.jdbc.useThreadLocalBufferCache'?: string;
	'oracle.jdbc.enableQueryResultCache'?: string;
	'oracle.jdbc.disableDefineColumnType'?: string;
	'oracle.jdbc.processEscapes'?: string;
	'oracle.jdbc.fixedString'?: string;
	'oracle.jdbc.includeSynonyms'?: string;
	'oracle.jdbc.restrictGetTables'?: string;
	'oracle.jdbc.remarksReporting'?: string;
	'oracle.jdbc.AccumulateBatchResult'?: string;
	'oracle.jdbc.useFetchSizeWithLongColumn'?: string;
	'oracle.jdbc.defaultLobPrefetchSize'?: string;
	'oracle.jdbc.readTimeout'?: string;
	'oracle.jdbc.TcpNoDelay'?: string;

	// Network properties
	'oracle.net.keepAlive'?: string;
	'oracle.net.disableOob'?: string;
	'oracle.net.READ_TIMEOUT'?: string;
	'oracle.net.CONNECT_TIMEOUT'?: string;
	'oracle.net.ssl_client_authentication'?: string;
	'oracle.net.ssl_version'?: string;
	'oracle.net.authentication_services'?: string;
	'oracle.net.wallet_location'?: string;
	'oracle.net.ssl_server_dn_match'?: string;
	'oracle.net.ssl_cipher_suites'?: string;

	// Performance and optimization
	'oracle.jdbc.fanEnabled'?: string;
	'oracle.jdbc.applicationContinuity'?: string;
	'oracle.jdbc.replayMaxRetryCount'?: string;
	'oracle.jdbc.replayMaxRetryDelay'?: string;
	'oracle.jdbc.enableEndToEndMetrics'?: string;
	'oracle.jdbc.endToEndMetricsEnabled'?: string;
	'oracle.jdbc.autoConnectionClose'?: string;
	'oracle.jdbc.maxCachedBufferSize'?: string;

	// LOB handling
	'oracle.jdbc.defaultNChar'?: string;
	'oracle.jdbc.convertNcharLiterals'?: string;
	'oracle.jdbc.mapDateToTimestamp'?: string;

	// Security properties
	'oracle.jdbc.ocinativeXA'?: string;
	'oracle.jdbc.J2EE13Compliant'?: string;

	// RAC and High Availability
	'oracle.jdbc.fastConnectionFailover'?: string;
	'oracle.jdbc.ons.oraclehome'?: string;
	'oracle.jdbc.ons.walletfile'?: string;
	'oracle.jdbc.ons.walletpassword'?: string;

	// Custom properties
	[key: string]: string | undefined;
}

// Oracle UCP (Universal Connection Pool) properties
export interface OraclePoolProperties extends OracleConnectionProperties {
	// Basic UCP properties
	'oracle.ucp.connectionPoolName'?: string;
	'oracle.ucp.initialPoolSize'?: string;
	'oracle.ucp.minPoolSize'?: string;
	'oracle.ucp.maxPoolSize'?: string;
	'oracle.ucp.connectionWaitTimeout'?: string;
	'oracle.ucp.inactiveConnectionTimeout'?: string;
	'oracle.ucp.maxConnectionReuseTime'?: string;
	'oracle.ucp.maxConnectionReuseCount'?: string;
	'oracle.ucp.abandonedConnectionTimeout'?: string;
	'oracle.ucp.timeToLiveConnectionTimeout'?: string;
	'oracle.ucp.connectionCreationRetryDelay'?: string;
	'oracle.ucp.maxStatements'?: string;
	'oracle.ucp.validateConnectionOnBorrow'?: string;
	'oracle.ucp.connectionValidationTimeout'?: string;

	// Advanced UCP properties
	'oracle.ucp.connectionHarvestable'?: string;
	'oracle.ucp.connectionHarvestMaxCount'?: string;
	'oracle.ucp.connectionHarvestTriggerCount'?: string;
	'oracle.ucp.fastConnectionFailoverEnabled'?: string;
	'oracle.ucp.connectionLabelingHighCost'?: string;
	'oracle.ucp.connectionRepurposeThreshold'?: string;
	'oracle.ucp.maxConnectionsPerService'?: string;
	'oracle.ucp.connectionAffinityCallback'?: string;

	// Statistics and monitoring
	'oracle.ucp.statisticsEnabled'?: string;
	'oracle.ucp.statisticsInterval'?: string;
	'oracle.ucp.jmxEnabled'?: string;

	// Connection retry
	'oracle.ucp.connectionRetryCount'?: string;
	'oracle.ucp.connectionRetryDelay'?: string;

	// Query timeout
	'oracle.ucp.queryTimeout'?: string;

	// Connection factory
	'oracle.ucp.connectionFactoryClassName'?: string;
	'oracle.ucp.connectionFactoryProperties'?: string;

	// Custom UCP properties
	maxStatements?: string;
	fastConnectionFailoverEnabled?: string;
	connectionPoolName?: string;
}

// Oracle error codes
export const OracleErrorCodes = {
	// Connection errors
	CONNECTION_REFUSED: 'ORA-12514',
	TNS_COULD_NOT_RESOLVE: 'ORA-12154',
	TNS_LISTENER_NOT_LISTENING: 'ORA-12541',
	TNS_TIMEOUT: 'ORA-12170',
	INVALID_USERNAME_PASSWORD: 'ORA-01017',
	ACCOUNT_LOCKED: 'ORA-28000',
	PASSWORD_EXPIRED: 'ORA-28001',

	// SQL errors
	TABLE_NOT_FOUND: 'ORA-00942',
	COLUMN_NOT_FOUND: 'ORA-00904',
	INVALID_IDENTIFIER: 'ORA-00904',
	INSUFFICIENT_PRIVILEGES: 'ORA-01031',
	UNIQUE_CONSTRAINT_VIOLATED: 'ORA-00001',
	CHECK_CONSTRAINT_VIOLATED: 'ORA-02290',
	NOT_NULL_CONSTRAINT_VIOLATED: 'ORA-01400',
	FOREIGN_KEY_CONSTRAINT_VIOLATED: 'ORA-02291',

	// Resource errors
	TABLESPACE_FULL: 'ORA-01653',
	MAXIMUM_PROCESSES_EXCEEDED: 'ORA-00020',
	OUT_OF_MEMORY: 'ORA-04031',
	SNAPSHOT_TOO_OLD: 'ORA-01555',

	// Transaction errors
	DEADLOCK_DETECTED: 'ORA-00060',
	LOCK_TIMEOUT: 'ORA-30006',
	TRANSACTION_BACKED_OUT: 'ORA-00061',

	// Data type errors
	INVALID_NUMBER: 'ORA-01722',
	DATE_FORMAT_ERROR: 'ORA-01861',
	VALUE_TOO_LARGE: 'ORA-01438',

	// PL/SQL errors
	NO_DATA_FOUND: 'ORA-01403',
	TOO_MANY_ROWS: 'ORA-01422',
	VALUE_ERROR: 'ORA-06502',
	INVALID_CURSOR: 'ORA-01001',

	// System errors
	INTERNAL_ERROR: 'ORA-00600',
	ASSERTION_FAILURE: 'ORA-07445',
} as const;

// Oracle session information
export interface OracleSessionInfo {
	sessionId?: number;
	serialNumber?: number;
	username?: string;
	schemaName?: string;
	osUser?: string;
	machine?: string;
	terminal?: string;
	program?: string;
	module?: string;
	action?: string;
	clientInfo?: string;
	clientIdentifier?: string;
	status?: 'ACTIVE' | 'INACTIVE' | 'KILLED' | 'CACHED' | 'SNIPED';
	serverType?: 'DEDICATED' | 'SHARED' | 'PSEUDO' | 'POOLED';
	service?: string;
	loginTime?: Date;
	lastCallEt?: number;
	blockingSession?: number;
	waitClass?: string;
	waitEvent?: string;
	waitTime?: number;
	sql?: {
		sqlId?: string;
		sqlText?: string;
		planHashValue?: number;
		childNumber?: number;
	};
	pga?: {
		memoryUsed?: number;
		memoryMax?: number;
		memoryAlloc?: number;
	};
}

// Oracle database information
export interface OracleDatabaseInfo {
	databaseName?: string;
	instanceName?: string;
	version?: string;
	versionFull?: string;
	banner?: string;
	compatibleVersion?: string;
	characterSet?: string;
	nationalCharacterSet?: string;
	timezoneVersion?: number;
	currentTimezone?: string;
	createdDate?: Date;
	resetlogDate?: Date;
	archiveLogMode?: 'ARCHIVELOG' | 'NOARCHIVELOG';
	isRac?: boolean;
	isDataGuard?: boolean;
	instanceCount?: number;
	cpuCount?: number;
	memoryTarget?: number;
	sgaTarget?: number;
	pgaTarget?: number;
	isContainerDatabase?: boolean;
	containerId?: number;
	containerName?: string;
	isPluggable?: boolean;
	pluggableId?: number;
	pluggableName?: string;
	flashbackOn?: boolean;
	forceLogging?: boolean;
	edition?: string;
}

// Oracle object types
export interface OracleObjectMetadata {
	owner: string;
	objectName: string;
	objectType: OracleObjectType;
	status: 'VALID' | 'INVALID';
	created: Date;
	lastDdlTime: Date;
	temporary: boolean;
	generated: boolean;
	secondary: boolean;
	namespace: number;
	editionName?: string;
}

export type OracleObjectType =
	| 'TABLE'
	| 'VIEW'
	| 'MATERIALIZED VIEW'
	| 'INDEX'
	| 'SEQUENCE'
	| 'SYNONYM'
	| 'PROCEDURE'
	| 'FUNCTION'
	| 'PACKAGE'
	| 'PACKAGE BODY'
	| 'TRIGGER'
	| 'TYPE'
	| 'TYPE BODY'
	| 'JAVA SOURCE'
	| 'JAVA CLASS'
	| 'JAVA RESOURCE'
	| 'XML SCHEMA'
	| 'QUEUE'
	| 'CONSUMER GROUP'
	| 'SCHEDULE'
	| 'PROGRAM'
	| 'JOB'
	| 'RULE SET'
	| 'RULE'
	| 'EVALUATION CONTEXT'
	| 'CREDENTIAL'
	| 'CHAIN'
	| 'FILE GROUP'
	| 'WINDOW'
	| 'DESTINATION';

// Oracle constraint types
export interface OracleConstraintInfo {
	owner: string;
	constraintName: string;
	constraintType: OracleConstraintType;
	tableName: string;
	searchCondition?: string;
	referenceOwner?: string;
	referenceTableName?: string;
	deleteRule?: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT';
	status: 'ENABLED' | 'DISABLED';
	deferrable: 'DEFERRABLE' | 'NOT DEFERRABLE';
	deferred: 'DEFERRED' | 'IMMEDIATE';
	validated: 'VALIDATED' | 'NOT VALIDATED';
	generated: 'GENERATED NAME' | 'USER NAME';
	bad: 'BAD' | null;
	rely: 'RELY' | 'NORELY' | null;
	lastChange?: Date;
	indexOwner?: string;
	indexName?: string;
	invalid: 'INVALID' | null;
	viewRelated: 'DEPEND ON VIEW' | null;
}

export type OracleConstraintType =
	| 'P' // Primary Key
	| 'R' // Foreign Key
	| 'U' // Unique
	| 'C' // Check
	| 'V' // View Check
	| 'O'; // View readonly;

// Oracle index information
export interface OracleIndexInfo {
	owner: string;
	indexName: string;
	indexType: OracleIndexType;
	tableName: string;
	tableType: 'TABLE' | 'CLUSTER';
	uniqueness: 'UNIQUE' | 'NONUNIQUE';
	compression: 'ENABLED' | 'DISABLED';
	prefixLength?: number;
	tablespaceName: string;
	iniTrans: number;
	maxTrans: number;
	initialExtent?: number;
	nextExtent?: number;
	minExtents: number;
	maxExtents: number;
	pctIncrease?: number;
	pctFree?: number;
	blevel?: number;
	leafBlocks?: number;
	distinctKeys?: number;
	avgLeafBlocksPerKey?: number;
	avgDataBlocksPerKey?: number;
	clusteringFactor?: number;
	status: 'VALID' | 'UNUSABLE' | 'INPROGRESS';
	numRows?: number;
	sampleSize?: number;
	lastAnalyzed?: Date;
	degree: string;
	instances: string;
	partitioned: 'YES' | 'NO';
	temporary: 'Y' | 'N';
	generated: 'Y' | 'N';
	secondary: 'Y' | 'N';
	bufferPool: 'KEEP' | 'RECYCLE' | 'DEFAULT';
	flashCache: 'KEEP' | 'NONE' | 'DEFAULT';
	cellFlashCache: 'KEEP' | 'NONE' | 'DEFAULT';
	userStats: 'YES' | 'NO';
	duration: string;
	pctDirectAccess?: number;
	ityType?: string;
	parameters?: string;
	global: 'YES' | 'NO';
	domidxStatus?: string;
	domidxOpstatus?: string;
	funcidxStatus?: string;
	joinIndex: 'YES' | 'NO';
	iot: 'IOT' | 'IOT_OVERFLOW' | 'IOT_MAPPING' | null;
	dropped: 'YES' | 'NO';
	visibility: 'VISIBLE' | 'INVISIBLE';
	orphanedEntries: 'YES' | 'NO';
}

export type OracleIndexType =
	| 'NORMAL'
	| 'BITMAP'
	| 'FUNCTION-BASED NORMAL'
	| 'FUNCTION-BASED BITMAP'
	| 'DOMAIN'
	| 'IOT - TOP'
	| 'IOT - NESTED'
	| 'IOT - MAPPING'
	| 'CLUSTER';

// Oracle tablespace information
export interface OracleTablespaceInfo {
	tablespaceName: string;
	blockSize: number;
	initialExtent?: number;
	nextExtent?: number;
	minExtents: number;
	maxExtents: number;
	pctIncrease?: number;
	minExtlen: number;
	status: 'ONLINE' | 'OFFLINE' | 'READ ONLY';
	contents: 'PERMANENT' | 'TEMPORARY' | 'UNDO';
	logging: 'LOGGING' | 'NOLOGGING';
	forceLogging: 'YES' | 'NO';
	extentManagement: 'LOCAL' | 'DICTIONARY';
	allocationType: 'SYSTEM' | 'UNIFORM' | 'USER';
	uniformSize?: number;
	segmentSpaceManagement: 'AUTO' | 'MANUAL';
	defTabCompression: 'ENABLED' | 'DISABLED';
	retention: 'GUARANTEE' | 'NOGUARANTEE' | 'NOT APPLY';
	bigfile: 'YES' | 'NO';
	predicateEvaluation: 'HOST' | 'STORAGE';
	encrypted: 'YES' | 'NO';
	compressFor:
		| 'BASIC'
		| 'OLTP'
		| 'QUERY LOW'
		| 'QUERY HIGH'
		| 'ARCHIVE LOW'
		| 'ARCHIVE HIGH'
		| null;
}

// Oracle privilege information
export interface OraclePrivilegeInfo {
	grantee: string;
	privilege: string;
	admin: 'YES' | 'NO';
	common: 'YES' | 'NO';
	inherited: 'YES' | 'NO';
}

export interface OracleObjectPrivilegeInfo {
	grantee: string;
	owner: string;
	tableName: string;
	grantor: string;
	privilege: string;
	grantable: 'YES' | 'NO';
	hierarchy: 'YES' | 'NO';
	common: 'YES' | 'NO';
	type: string;
	inherited: 'YES' | 'NO';
}

// Oracle role information
export interface OracleRoleInfo {
	role: string;
	passwordRequired: 'YES' | 'NO';
	authentication: 'NONE' | 'PASSWORD' | 'EXTERNAL' | 'GLOBAL';
	common: 'YES' | 'NO';
	oracleMaintained: 'YES' | 'NO';
	inherited: 'YES' | 'NO';
	implicit: 'YES' | 'NO';
}

// Oracle performance statistics
export interface OraclePerformanceStats {
	statistic: string;
	value: number;
	displayValue?: string;
	isDefault: 'TRUE' | 'FALSE';
	description?: string;
}

// Oracle wait events
export interface OracleWaitEvent {
	event: string;
	waitClass: string;
	totalWaits: number;
	totalTimeouts: number;
	timeWaitedMicro: number;
	averageWaitMicro: number;
}

// Oracle SQL plan information
export interface OracleSqlPlan {
	sqlId: string;
	planHashValue: number;
	childNumber: number;
	id: number;
	parentId?: number;
	operation: string;
	options?: string;
	objectNode?: string;
	objectOwner?: string;
	objectName?: string;
	objectAlias?: string;
	objectType?: string;
	optimizer?: string;
	searchColumns?: number;
	cost?: number;
	cardinality?: number;
	bytes?: number;
	otherTag?: string;
	partitionStart?: string;
	partitionStop?: string;
	partitionId?: number;
	other?: string;
	distribution?: string;
	cpuCost?: number;
	ioCost?: number;
	tempSpace?: number;
	accessPredicates?: string;
	filterPredicates?: string;
	projection?: string;
	time?: number;
	qblockName?: string;
	remarks?: string;
}

// Oracle AWR (Automatic Workload Repository) snapshot info
export interface OracleAwrSnapshotInfo {
	snapId: number;
	dbid: number;
	instanceNumber: number;
	snapLevel: number;
	beginIntervalTime: Date;
	endIntervalTime: Date;
	elapsed: number;
	dbTime: number;
	startupTime: Date;
	sessionCount: number;
	cursorsCount: number;
	errorCount: number;
}

// Oracle data types mapping
export const OracleTypeMapping: { [key: string]: string } = {
	VARCHAR2: 'string',
	NVARCHAR2: 'string',
	CHAR: 'string',
	NCHAR: 'string',
	CLOB: 'string',
	NCLOB: 'string',
	LONG: 'string',
	NUMBER: 'number',
	FLOAT: 'number',
	BINARY_FLOAT: 'number',
	BINARY_DOUBLE: 'number',
	INTEGER: 'number',
	DATE: 'Date',
	TIMESTAMP: 'Date',
	'TIMESTAMP WITH TIME ZONE': 'Date',
	'TIMESTAMP WITH LOCAL TIME ZONE': 'Date',
	BLOB: 'Buffer',
	BFILE: 'Buffer',
	RAW: 'Buffer',
	'LONG RAW': 'Buffer',
	ROWID: 'string',
	UROWID: 'string',
	XMLTYPE: 'string',
	JSON: 'object',
	BOOLEAN: 'boolean',
};

// Oracle feature support matrix
export interface OracleFeatureSupport {
	version: string;
	features: {
		json: boolean;
		jsonDataType: boolean;
		identityColumns: boolean;
		invisibleColumns: boolean;
		virtualColumns: boolean;
		partitioning: boolean;
		compression: boolean;
		encryption: boolean;
		flashback: boolean;
		applicationContinuity: boolean;
		sharding: boolean;
		multitenantArchitecture: boolean;
		inmemoryColumnStore: boolean;
		advancedAnalytics: boolean;
		spatialAndGraph: boolean;
		textSearch: boolean;
		xmlSupport: boolean;
		blockchain: boolean;
		automl: boolean;
	};
}

// Utility functions for Oracle types
export namespace OracleTypeUtils {
	export function isNumericType(oracleType: string): boolean {
		const numericTypes = [
			'NUMBER',
			'FLOAT',
			'BINARY_FLOAT',
			'BINARY_DOUBLE',
			'INTEGER',
			'SMALLINT',
		];
		return numericTypes.includes(oracleType.toUpperCase());
	}

	export function isCharacterType(oracleType: string): boolean {
		const charTypes = ['VARCHAR2', 'NVARCHAR2', 'CHAR', 'NCHAR', 'CLOB', 'NCLOB', 'LONG'];
		return charTypes.includes(oracleType.toUpperCase());
	}

	export function isDateTimeType(oracleType: string): boolean {
		const dateTypes = [
			'DATE',
			'TIMESTAMP',
			'TIMESTAMP WITH TIME ZONE',
			'TIMESTAMP WITH LOCAL TIME ZONE',
		];
		return dateTypes.some(type => oracleType.toUpperCase().includes(type));
	}

	export function isBinaryType(oracleType: string): boolean {
		const binaryTypes = ['BLOB', 'BFILE', 'RAW', 'LONG RAW'];
		return binaryTypes.includes(oracleType.toUpperCase());
	}

	export function isLobType(oracleType: string): boolean {
		const lobTypes = ['CLOB', 'NCLOB', 'BLOB', 'BFILE'];
		return lobTypes.includes(oracleType.toUpperCase());
	}

	export function getJavaScriptType(oracleType: string): string {
		return OracleTypeMapping[oracleType.toUpperCase()] || 'any';
	}

	export function getOracleTypeCategory(oracleType: string): string {
		const type = oracleType.toUpperCase();

		if (isNumericType(type)) return 'NUMERIC';
		if (isCharacterType(type)) return 'CHARACTER';
		if (isDateTimeType(type)) return 'DATETIME';
		if (isBinaryType(type)) return 'BINARY';
		if (type === 'XMLTYPE') return 'XML';
		if (type === 'JSON') return 'JSON';
		if (type.includes('INTERVAL')) return 'INTERVAL';
		if (type.includes('ROWID')) return 'ROWID';

		return 'OTHER';
	}

	export function isOracleReservedWord(word: string): boolean {
		const reservedWords = [
			'SELECT',
			'INSERT',
			'UPDATE',
			'DELETE',
			'CREATE',
			'DROP',
			'ALTER',
			'TABLE',
			'INDEX',
			'VIEW',
			'SEQUENCE',
			'TRIGGER',
			'FUNCTION',
			'PROCEDURE',
			'PACKAGE',
			'TYPE',
			'CONSTRAINT',
			'PRIMARY',
			'FOREIGN',
			'UNIQUE',
			'CHECK',
			'NOT',
			'NULL',
			'DEFAULT',
			'REFERENCES',
			'CASCADE',
			'RESTRICT',
			'ON',
			'AND',
			'OR',
			'IN',
			'LIKE',
			'BETWEEN',
			'EXISTS',
			'UNION',
			'INTERSECT',
			'MINUS',
			'ORDER',
			'GROUP',
			'HAVING',
			'WHERE',
			'FROM',
			'JOIN',
			'INNER',
			'LEFT',
			'RIGHT',
			'FULL',
			'OUTER',
			'CROSS',
			'NATURAL',
			'CONNECT',
			'START',
			'WITH',
			'PRIOR',
			'LEVEL',
			'ROWNUM',
			'SYSDATE',
			'USER',
			'DUAL',
			'ALL',
			'ANY',
			'SOME',
			'AS',
			'CASE',
			'WHEN',
			'THEN',
			'ELSE',
			'END',
			'IF',
			'ELSIF',
			'ELSE',
			'LOOP',
			'WHILE',
			'FOR',
			'EXIT',
			'CONTINUE',
			'GOTO',
			'RETURN',
			'BEGIN',
			'DECLARE',
			'EXCEPTION',
			'RAISE',
			'PRAGMA',
			'CURSOR',
			'FETCH',
			'OPEN',
			'CLOSE',
			'COMMIT',
			'ROLLBACK',
			'SAVEPOINT',
			'LOCK',
			'GRANT',
			'REVOKE',
			'PUBLIC',
			'ROLE',
			'USER',
			'IDENTIFIED',
			'BY',
			'PASSWORD',
		];

		return reservedWords.includes(word.toUpperCase());
	}

	export function formatOracleIdentifier(identifier: string): string {
		// If identifier contains special characters or is a reserved word, quote it
		if (
			isOracleReservedWord(identifier) ||
			!/^[A-Za-z][A-Za-z0-9_$#]*$/.test(identifier) ||
			identifier !== identifier.toUpperCase()
		) {
			return `"${identifier}"`;
		}
		return identifier.toUpperCase();
	}

	export function getDefaultPrecisionScale(oracleType: string): {
		precision?: number;
		scale?: number;
	} {
		const type = oracleType.toUpperCase();

		switch (type) {
			case 'NUMBER':
				return { precision: 38, scale: 0 };
			case 'FLOAT':
				return { precision: 126 };
			case 'BINARY_FLOAT':
				return { precision: 7 };
			case 'BINARY_DOUBLE':
				return { precision: 15 };
			case 'VARCHAR2':
			case 'NVARCHAR2':
				return { precision: 4000 };
			case 'CHAR':
			case 'NCHAR':
				return { precision: 2000 };
			case 'RAW':
				return { precision: 2000 };
			default:
				return {};
		}
	}
}

// Export all Oracle-related types and constants
export type OracleDataType = keyof typeof OracleDataTypes;
export type OracleErrorCode = keyof typeof OracleErrorCodes;

// Type guards
export function isOracleSpecificType(type: string): type is keyof OracleSpecificTypes {
	return type in OracleDataTypes;
}

export function isOracleErrorCode(code: string): code is keyof typeof OracleErrorCodes {
	const errorCodes = Object.values(OracleErrorCodes);
	return errorCodes.includes(code as any);
}
