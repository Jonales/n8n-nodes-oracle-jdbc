
/**
 * Oracle para n8n-nodes-oracle-jdbc
 * Suporte para modo JDBC
 *
 * @author Jônatas Meireles Sousa Vieira
 * @version 0.0.1-rc.1
 */

import * as java from 'java-bridge';

import { JdbcConnection } from '../types/JdbcTypes';

import { ErrorContext, ErrorHandler } from '../utils/ErrorHandler';

export interface ProcedureParameter {
	name: string;
	value?: any;
	type: 'IN' | 'OUT' | 'INOUT';
	dataType: string;
	size?: number;
	scale?: number;
	precision?: number;
}

export interface CursorParameter extends ProcedureParameter {
	dataType: 'CURSOR';
	fetchSize?: number;
	maxRows?: number;
}

export interface ProcedureResult {
	outputParameters: { [key: string]: any };
	resultSets: any[][];
	cursors: { [key: string]: any[] };
	executionTime: number;
	returnValue?: any;
}

export interface ProcedureExecutionOptions {
	timeout?: number;
	fetchSize?: number;
	enableCursorOptimization?: boolean;
	maxCursorRows?: number;
	streamCursors?: boolean;
	validateParameters?: boolean;
}

export interface PackageInfo {
	owner: string;
	packageName: string;
	procedureName: string;
}

export class StoredProcedureExecutor {
	private connection: JdbcConnection;
	private cursorStatements = new Map<string, any>();

	constructor(connection: JdbcConnection) {
		this.connection = connection;
	}

	async callProcedure(
		procedureName: string,
		parameters: ProcedureParameter[] = [],
		options: ProcedureExecutionOptions = {},
	): Promise<ProcedureResult> {
		const errorContext: ErrorContext = {
			operation: 'callProcedure',
			connectionId: this.connection.id,
			procedureName,
		};

		const startTime = Date.now();
		let callableStatement;

		try {
			// Validate parameters if enabled
			if (options.validateParameters) {
				await this.validateParameters(procedureName, parameters);
			}

			// Build SQL call
			const paramPlaceholders = parameters.map(() => '?').join(', ');
			const callSql = `{ call ${procedureName}(${paramPlaceholders}) }`;

			callableStatement = await this.connection.connection.prepareCall(callSql);

			// Configure statement
			if (options.timeout) {
				await callableStatement.setQueryTimeout(options.timeout);
			}

			if (options.fetchSize) {
				await callableStatement.setFetchSize(options.fetchSize);
			}

			// Register parameters
			await this.registerParameters(callableStatement, parameters);

			// Execute procedure
			const hasResultSet = await callableStatement.execute();

			// Extract results
			const outputParameters = await this.extractOutputParameters(callableStatement, parameters);
			const { resultSets, cursors } = await this.extractAllResultSets(
				callableStatement,
				parameters,
				options,
			);

			return {
				outputParameters,
				resultSets,
				cursors,
				executionTime: Date.now() - startTime,
			};
		} catch (error) {
			throw ErrorHandler.handleJdbcError(
				error,
				`Failed to execute procedure: ${procedureName}`,
				errorContext,
			);
		} finally {
			if (callableStatement) {
				await callableStatement.close();
			}
		}
	}

	async callFunction(
		functionName: string,
		returnType: string,
		parameters: ProcedureParameter[] = [],
		options: ProcedureExecutionOptions = {},
	): Promise<ProcedureResult> {
		const errorContext: ErrorContext = {
			operation: 'callFunction',
			connectionId: this.connection.id,
			procedureName: functionName,
		};

		const startTime = Date.now();
		let callableStatement;

		try {
			// Build SQL call for function
			const paramPlaceholders =
				parameters.length > 0 ? ', ' + parameters.map(() => '?').join(', ') : '';

			const callSql =
				parameters.length > 0
					? `{ ? = call ${functionName}(${paramPlaceholders.substring(2)}) }`
					: `{ ? = call ${functionName}() }`;

			callableStatement = await this.connection.connection.prepareCall(callSql);

			// Configure statement
			if (options.timeout) {
				await callableStatement.setQueryTimeout(options.timeout);
			}

			// Register return parameter
			await this.registerReturnParameter(callableStatement, returnType);

			// Register other parameters (starting from index 2)
			await this.registerParameters(callableStatement, parameters, 2);

			// Execute function
			await callableStatement.execute();

			// Extract results
			const returnValue = await callableStatement.getObject(1);
			const outputParameters = await this.extractOutputParameters(callableStatement, parameters, 2);

			// Add return value to output
			outputParameters['RETURN_VALUE'] = this.convertJavaValue(returnValue);

			const { resultSets, cursors } = await this.extractAllResultSets(
				callableStatement,
				parameters,
				options,
			);

			return {
				outputParameters,
				resultSets,
				cursors,
				executionTime: Date.now() - startTime,
				returnValue: outputParameters['RETURN_VALUE'],
			};
		} catch (error) {
			throw ErrorHandler.handleJdbcError(
				error,
				`Failed to execute function: ${functionName}`,
				errorContext,
			);
		} finally {
			if (callableStatement) {
				await callableStatement.close();
			}
		}
	}

	async callPackageProcedure(
		packageName: string,
		procedureName: string,
		parameters: ProcedureParameter[] = [],
		options: ProcedureExecutionOptions = {},
	): Promise<ProcedureResult> {
		const fullProcedureName = `${packageName}.${procedureName}`;
		return this.callProcedure(fullProcedureName, parameters, options);
	}

	async callPackageFunction(
		packageName: string,
		functionName: string,
		returnType: string,
		parameters: ProcedureParameter[] = [],
		options: ProcedureExecutionOptions = {},
	): Promise<ProcedureResult> {
		const fullFunctionName = `${packageName}.${functionName}`;
		return this.callFunction(fullFunctionName, returnType, parameters, options);
	}

	async executePLSQLBlock(
		plsqlBlock: string,
		parameters: ProcedureParameter[] = [],
		options: ProcedureExecutionOptions = {},
	): Promise<ProcedureResult> {
		const errorContext: ErrorContext = {
			operation: 'executePLSQLBlock',
			connectionId: this.connection.id,
			sql: plsqlBlock.substring(0, 100),
		};

		const startTime = Date.now();
		let callableStatement;

		try {
			callableStatement = await this.connection.connection.prepareCall(plsqlBlock);

			// Configure statement
			if (options.timeout) {
				await callableStatement.setQueryTimeout(options.timeout);
			}

			// Register parameters
			if (parameters.length > 0) {
				await this.registerParameters(callableStatement, parameters);
			}

			// Execute PL/SQL block
			await callableStatement.execute();

			// Extract results
			const outputParameters = await this.extractOutputParameters(callableStatement, parameters);
			const { resultSets, cursors } = await this.extractAllResultSets(
				callableStatement,
				parameters,
				options,
			);

			return {
				outputParameters,
				resultSets,
				cursors,
				executionTime: Date.now() - startTime,
			};
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, 'Failed to execute PL/SQL block', errorContext);
		} finally {
			if (callableStatement) {
				await callableStatement.close();
			}
		}
	}

	async fetchCursorData(
		cursorName: string,
		options: { fetchSize?: number; maxRows?: number } = {},
	): Promise<any[]> {
		const cursorStatement = this.cursorStatements.get(cursorName);

		if (!cursorStatement) {
			throw new Error(`Cursor ${cursorName} not found or already closed`);
		}

		try {
			return await this.extractResultSetFromCursor(cursorStatement, options);
		} catch (error) {
			throw ErrorHandler.handleJdbcError(error, `Failed to fetch cursor data: ${cursorName}`);
		}
	}

	async closeCursor(cursorName: string): Promise<void> {
		const cursorStatement = this.cursorStatements.get(cursorName);

		if (cursorStatement) {
			try {
				await cursorStatement.close();
				this.cursorStatements.delete(cursorName);
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				console.warn(`Failed to close cursor ${cursorName}:`, message);
			}
		}
	}

	async closeAllCursors(): Promise<void> {
		const closePromises = Array.from(this.cursorStatements.keys()).map(cursorName =>
			this.closeCursor(cursorName),
		);

		await Promise.all(closePromises);
	}

	private async registerParameters(
		statement: any,
		parameters: ProcedureParameter[],
		startIndex = 1,
	): Promise<void> {
		for (let i = 0; i < parameters.length; i++) {
			const param = parameters[i];
			const paramIndex = startIndex + i;

			if (param.type === 'IN' || param.type === 'INOUT') {
				await this.setInputParameter(statement, paramIndex, param);
			}

			if (param.type === 'OUT' || param.type === 'INOUT') {
				await this.registerOutputParameter(statement, paramIndex, param);
			}
		}
	}

	private async registerReturnParameter(statement: any, returnType: string): Promise<void> {
		const sqlType = this.getSqlType(returnType);
		await statement.registerOutParameter(1, sqlType);
	}

	private async setInputParameter(
		statement: any,
		index: number,
		param: ProcedureParameter,
	): Promise<void> {
		const value = param.value;

		if (value === null || value === undefined) {
			const sqlType = this.getSqlType(param.dataType);
			await statement.setNull(index, sqlType);
			return;
		}

		try {
			switch (param.dataType.toUpperCase()) {
				case 'VARCHAR2':
				case 'CHAR':
				case 'NVARCHAR2':
				case 'NCHAR':
				case 'LONG':
					await statement.setString(index, String(value));
					break;

				case 'NUMBER':
				case 'NUMERIC':
				case 'DECIMAL':
					const BigDecimal = java.javaImport('java.math.BigDecimal');
					const decimal = new BigDecimal(String(value));
					await statement.setBigDecimal(index, decimal);
					break;

				case 'INTEGER':
				case 'INT':
					await statement.setInt(index, parseInt(String(value)));
					break;

				case 'FLOAT':
				case 'REAL':
					await statement.setFloat(index, parseFloat(String(value)));
					break;

				case 'DOUBLE':
					await statement.setDouble(index, parseFloat(String(value)));
					break;

				case 'DATE':
				case 'TIMESTAMP':
					const date = value instanceof Date ? value : new Date(value);
					const Timestamp = java.javaImport('java.sql.Timestamp');
					const timestamp = new Timestamp(date.getTime());
					await statement.setTimestamp(index, timestamp);
					break;

				case 'CLOB':
				case 'NCLOB':
					await this.setClobParameter(statement, index, value);
					break;

				case 'BLOB':
					await this.setBlobParameter(statement, index, value);
					break;

				case 'XMLTYPE':
					await this.setXMLTypeParameter(statement, index, value);
					break;

				case 'RAW':
				case 'LONG RAW':
					const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
					await statement.setBytes(index, bytes);
					break;

				case 'BOOLEAN':
					await statement.setBoolean(index, Boolean(value));
					break;

				case 'ARRAY':
				case 'VARRAY':
				case 'NESTED TABLE':
					await this.setArrayParameter(statement, index, value, param);
					break;

				default:
					await statement.setObject(index, value);
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to bind parameter ${param.name} at index ${index}: ${message}`);
		}
	}

	private async registerOutputParameter(
		statement: any,
		index: number,
		param: ProcedureParameter,
	): Promise<void> {
		const sqlType = this.getSqlType(param.dataType);

		if (param.size && param.scale) {
			await statement.registerOutParameter(index, sqlType, param.size, param.scale);
		} else if (param.size) {
			await statement.registerOutParameter(index, sqlType, param.size);
		} else {
			await statement.registerOutParameter(index, sqlType);
		}
	}

	private async extractOutputParameters(
		statement: any,
		parameters: ProcedureParameter[],
		startIndex = 1,
	): Promise<{ [key: string]: any }> {
		const output: { [key: string]: any } = {};

		for (let i = 0; i < parameters.length; i++) {
			const param = parameters[i];

			if (param.type === 'OUT' || param.type === 'INOUT') {
				const paramIndex = startIndex + i;

				try {
					let value;

					if (param.dataType.toUpperCase() === 'CURSOR') {
						// Handle cursor parameters
						value = await this.handleCursorParameter(statement, paramIndex, param);
					} else {
						value = await statement.getObject(paramIndex);
						value = this.convertJavaValue(value, param.dataType);
					}

					output[param.name] = value;
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					console.warn(`Failed to extract parameter ${param.name}:`, message);
					output[param.name] = [];
				}
			}
		}

		return output;
	}

	private async extractAllResultSets(
		statement: any,
		parameters: ProcedureParameter[],
		options: ProcedureExecutionOptions,
	): Promise<{ resultSets: any[][]; cursors: { [key: string]: any[] } }> {
		const resultSets: any[][] = [];
		const cursors: { [key: string]: any[] } = {};

		// Extract direct result sets
		let hasMoreResults = true;
		while (hasMoreResults) {
			try {
				const resultSet = await statement.getResultSet();
				if (resultSet) {
					const rows = await this.extractResultSet(resultSet, options);
					resultSets.push(rows);
					await resultSet.close();
				}

				hasMoreResults = await statement.getMoreResults();
			} catch (error) {
				hasMoreResults = false;
			}
		}

		// Extract cursor result sets
		for (const param of parameters) {
			if (
				param.dataType.toUpperCase() === 'CURSOR' &&
				(param.type === 'OUT' || param.type === 'INOUT')
			) {
				try {
					const cursorData = await this.fetchCursorData(param.name, {
						fetchSize: options.fetchSize,
						maxRows: options.maxCursorRows,
					});
					cursors[param.name] = cursorData;
				}  catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					console.warn(`Failed to extract cursor ${param.name}:`, message);
					cursors[param.name] = [];
				}
			}
		}

		return { resultSets, cursors };
	}

	private async extractResultSet(
		resultSet: any,
		options: ProcedureExecutionOptions = {},
	): Promise<any[]> {
		const rows: any[] = [];
		const metaData = await resultSet.getMetaData();
		const columnCount = await metaData.getColumnCount();

		// Configure fetch size
		if (options.fetchSize) {
			await resultSet.setFetchSize(options.fetchSize);
		}

		// Extract column names and types
		const columnInfo: Array<{ name: string; type: string; index: number }> = [];
		for (let i = 1; i <= columnCount; i++) {
			columnInfo.push({
				name: await metaData.getColumnName(i),
				type: await metaData.getColumnTypeName(i),
				index: i,
			});
		}

		// Extract data
		const maxRows = options.maxCursorRows || Number.MAX_SAFE_INTEGER;
		let rowCount = 0;

		while ((await resultSet.next()) && rowCount < maxRows) {
			const row: any = {};

			for (const col of columnInfo) {
				try {
					const value = await resultSet.getObject(col.index);
					row[col.name] = this.convertJavaValue(value, col.type);
				} catch (error) {
					row[col.name] = null;
				}
			}

			rows.push(row);
			rowCount++;

			// Yield control for streaming if enabled
			if (options.streamCursors && rowCount % 1000 === 0) {
				await new Promise(resolve => setImmediate(resolve));
			}
		}

		return rows;
	}

	private async extractResultSetFromCursor(
		cursorResultSet: any,
		options: { fetchSize?: number; maxRows?: number } = {},
	): Promise<any[]> {
		return this.extractResultSet(cursorResultSet, {
			fetchSize: options.fetchSize,
			maxCursorRows: options.maxRows,
		});
	}

	private async handleCursorParameter(
		statement: any,
		paramIndex: number,
		param: ProcedureParameter,
	): Promise<string | null> {
		try {
			const cursorResultSet = await statement.getObject(paramIndex);

			if (cursorResultSet) {
				const cursorName = param.name;
				this.cursorStatements.set(cursorName, cursorResultSet);
				return `CURSOR:${cursorName}`;
			}

			return null; // Agora permitido pelo tipo
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to handle cursor parameter ${param.name}: ${message}`);
		}
	}

	private async setClobParameter(statement: any, index: number, value: any): Promise<void> {
		const stringValue = String(value);

		if (stringValue.length > 4000) {
			// Use CLOB for large strings
			const connection = this.connection.connection;
			const clob = await connection.createClob();
			await clob.setString(1, stringValue);
			await statement.setClob(index, clob);
		} else {
			await statement.setString(index, stringValue);
		}
	}

	private async setBlobParameter(statement: any, index: number, value: any): Promise<void> {
		let bytes: Buffer;

		if (Buffer.isBuffer(value)) {
			bytes = value;
		} else if (typeof value === 'string') {
			bytes = Buffer.from(value, 'base64');
		} else {
			bytes = Buffer.from(String(value));
		}

		if (bytes.length > 2000) {
			// Use BLOB for large data
			const connection = this.connection.connection;
			const blob = await connection.createBlob();
			await blob.setBytes(1, bytes);
			await statement.setBlob(index, blob);
		} else {
			await statement.setBytes(index, bytes);
		}
	}

	private async setXMLTypeParameter(statement: any, index: number, value: any): Promise<void> {
		try {
			const XMLType = java.javaImport('oracle.xdb.XMLType');
			const connection = this.connection.connection;

			let xmlString: string;
			if (typeof value === 'object') {
				xmlString = JSON.stringify(value);
			} else {
				xmlString = String(value);
			}

			const xmlType = XMLType.createXML(connection, xmlString);
			await statement.setObject(index, xmlType);
		} catch (error) {
			// Fallback to string if XMLType is not available
			await statement.setString(index, String(value));
		}
	}

	private async setArrayParameter(
		statement: any,
		index: number,
		value: any,
		param: ProcedureParameter,
	): Promise<void> {
		try {
			if (Array.isArray(value)) {
				const connection = this.connection.connection;
				const Array = java.javaImport('java.sql.Array');

				// Convert array elements to appropriate Java types
				const javaArray = value.map(item => this.convertToJavaType(item));

				// Create SQL array
				const sqlArray = await connection.createArrayOf('VARCHAR', javaArray);
				await statement.setArray(index, sqlArray);
			} else {
				throw new Error(`Parameter ${param.name} expected array but got ${typeof value}`);
			}
		} catch (error) {
			// Fallback to object
			await statement.setObject(index, value);
		}
	}

	private convertToJavaType(value: any): any {
		if (value === null || value === undefined) {
			return null;
		}

		if (typeof value === 'string') return value;
		if (typeof value === 'number') return value;
		if (typeof value === 'boolean') return value;
		if (value instanceof Date) {
			const Timestamp = java.javaImport('java.sql.Timestamp');
			return new Timestamp(value.getTime());
		}

		return String(value);
	}

	private getSqlType(dataType: string): any {
		const Types = java.javaImport('java.sql.Types');

		switch (dataType.toUpperCase()) {
			case 'VARCHAR2':
			case 'VARCHAR':
			case 'CHAR':
			case 'NVARCHAR2':
			case 'NCHAR':
			case 'LONG':
				return Types.VARCHAR;

			case 'NUMBER':
			case 'NUMERIC':
			case 'DECIMAL':
				return Types.NUMERIC;

			case 'INTEGER':
			case 'INT':
				return Types.INTEGER;

			case 'FLOAT':
			case 'REAL':
				return Types.REAL;

			case 'DOUBLE':
				return Types.DOUBLE;

			case 'DATE':
				return Types.DATE;

			case 'TIMESTAMP':
				return Types.TIMESTAMP;

			case 'CLOB':
			case 'NCLOB':
				return Types.CLOB;

			case 'BLOB':
				return Types.BLOB;

			case 'RAW':
			case 'LONG RAW':
				return Types.BINARY;

			case 'CURSOR':
				return Types.REF_CURSOR;

			case 'BOOLEAN':
				return Types.BOOLEAN;

			case 'XMLTYPE':
				return Types.SQLXML;

			case 'ARRAY':
			case 'VARRAY':
			case 'NESTED TABLE':
				return Types.ARRAY;

			case 'ROWID':
				return Types.ROWID;

			default:
				return Types.OTHER;
		}
	}

	private convertJavaValue(value: any, dataType?: string): any {
		if (value === null || value === undefined) {
			return null;
		}

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
				case 'oracle.sql.NCLOB':
					return value.getSubString(1, value.length());

				case 'oracle.sql.BLOB':
					return Buffer.from(value.getBytes(1, value.length()));

				case 'oracle.sql.ROWID':
				case 'oracle.sql.UROWID':
					return value.toString();

				case 'oracle.sql.NUMBER':
					return value.doubleValue();

				case 'oracle.xdb.XMLType':
					return value.getStringVal();

				case 'java.sql.Array':
					try {
						const arrayData = value.getArray();
						return Array.from(arrayData).map(item => this.convertJavaValue(item));
					} catch {
						return value.toString();
					}

				case 'java.lang.Boolean':
					return Boolean(value);

				case 'java.lang.Integer':
				case 'java.lang.Long':
				case 'java.lang.Double':
				case 'java.lang.Float':
					return Number(value);

				case 'java.lang.String':
					return String(value);

				default:
					return value.toString();
			}
		}

		return value;
	}

	private async validateParameters(
		procedureName: string,
		parameters: ProcedureParameter[],
	): Promise<void> {
		// Basic parameter validation
		const paramNames = new Set();

		for (const param of parameters) {
			if (!param.name) {
				throw new Error('Parameter name is required');
			}

			if (paramNames.has(param.name)) {
				throw new Error(`Duplicate parameter name: ${param.name}`);
			}

			paramNames.add(param.name);

			if (!['IN', 'OUT', 'INOUT'].includes(param.type)) {
				throw new Error(`Invalid parameter type for ${param.name}: ${param.type}`);
			}

			if (!param.dataType) {
				throw new Error(`Data type is required for parameter: ${param.name}`);
			}
		}
	}

	async getStoredProcedureMetadata(procedureName: string): Promise<{
		parameters: Array<{
			name: string;
			dataType: string;
			direction: string;
			position: number;
		}>;
	}> {
		try {
			const sql = `
        SELECT argument_name, data_type, in_out, position
        FROM user_arguments
        WHERE object_name = UPPER(?)
        AND package_name IS NULL
        ORDER BY position
      `;

			const QueryExecutor = java.javaImport('../QueryExecutor');
			const executor = new QueryExecutor(this.connection);
			const result = await executor.executeSelect(sql, [procedureName]);

			const parameters = result.rows.map((row: any) => ({
				name: row.ARGUMENT_NAME,
				dataType: row.DATA_TYPE,
				direction: row.IN_OUT,
				position: row.POSITION,
			}));

			return { parameters };
		} catch (error) {
			throw ErrorHandler.handleJdbcError(
				error,
				`Failed to get metadata for procedure: ${procedureName}`,
			);
		}
	}

	async close(): Promise<void> {
		await this.closeAllCursors();
	}

	// Utility methods for common Oracle operations
	static createInputParameter(name: string, dataType: string, value: any): ProcedureParameter {
		return { name, dataType, value, type: 'IN' };
	}

	static createOutputParameter(name: string, dataType: string, size?: number): ProcedureParameter {
		return { name, dataType, type: 'OUT', size };
	}

	static createInOutParameter(
		name: string,
		dataType: string,
		value: any,
		size?: number,
	): ProcedureParameter {
		return { name, dataType, value, type: 'INOUT', size };
	}

	static createCursorParameter(name: string, fetchSize?: number): CursorParameter {
		return { name, dataType: 'CURSOR', type: 'OUT', fetchSize };
	}

	static parsePackageName(fullName: string): PackageInfo {
		const parts = fullName.split('.');

		if (parts.length === 1) {
			return {
				owner: '',
				packageName: '',
				procedureName: parts[0],
			};
		} else if (parts.length === 2) {
			return {
				owner: '',
				packageName: parts[0], // 🟢 Corrigido
				procedureName: parts[1],
			};
		} else if (parts.length === 3) {
			return {
				owner: parts[0],        // 🟢 Corrigido
				packageName: parts[1],
				procedureName: parts[2],
			};
		} else {
			throw new Error(`Invalid procedure name format: ${fullName}`);
		}
	}

}