import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import { OracleJdbcConfig, ParameterDefinition } from './types/JdbcTypes';

import { PoolConfigurationPresets } from './core/AdvancedPoolConfig';
import { BatchOperations } from './core/BatchOperations';
import { EnterpriseConnectionPool } from './core/EnterpriseConnectionPool';
import { JdbcConnectionManager } from './core/JdbcConnectionManager';
import { PoolManager } from './core/PoolManager';
import { QueryExecutor } from './core/QueryExecutor';
import { StoredProcedureExecutor } from './core/StoredProcedureExecutor';
import { TransactionManager } from './core/TransactionManager';

import { ParameterBinder } from './utils/ParameterBinder';
import { ResultMapper } from './utils/ResultMapper';
import { SqlParser } from './utils/SqlParser';

export class OracleJdbcAdvanced implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Oracle Database Advanced (JDBC)',
		name: 'oracleJdbcAdvanced',
		icon: 'file:oracle.svg',
		group: ['database'],
		version: 1,
		description: 'Execute advanced Oracle Database operations with enterprise features',
		subtitle: '={{$parameter["operationType"]}}',
		defaults: {
			name: 'Oracle Advanced JDBC',
		},
		inputs: ['main' as NodeConnectionType],
		outputs: ['main' as NodeConnectionType],
		credentials: [
			{
				name: 'oracleJdbc',
				required: true,
			},
		],
		properties: [
			// === Operation Type ===
			{
				displayName: 'Operation',
				name: 'operationType',
				type: 'options',
				noDataExpression: true,
				default: 'query',
				options: [
					{
						name: 'Execute Query',
						value: 'query',
						description: 'Execute SELECT, INSERT, UPDATE, DELETE statements',
						action: 'Execute a query',
					},
					{
						name: 'Transaction Block',
						value: 'transaction',
						description: 'Execute multiple statements in a transaction',
						action: 'Execute transaction',
					},
					{
						name: 'Batch Operations',
						value: 'batch',
						description: 'Execute high-performance batch operations',
						action: 'Execute batch operations',
					},
					{
						name: 'Stored Procedure',
						value: 'procedure',
						description: 'Call Oracle stored procedures and functions',
						action: 'Call stored procedure',
					},
					{
						name: 'Connection Pool',
						value: 'pool',
						description: 'Use enterprise connection pooling',
						action: 'Use connection pool',
					},
					{
						name: 'PL/SQL Block',
						value: 'plsql',
						description: 'Execute PL/SQL blocks',
						action: 'Execute PL/SQL',
					},
				],
			},

			// === Query Operation ===
			{
				displayName: 'SQL Query',
				name: 'sqlQuery',
				type: 'string',
				typeOptions: {
					alwaysOpenEditWindow: true,
					rows: 10,
					editor: 'sql',
				},
				displayOptions: {
					show: {
						operationType: ['query'],
					},
				},
				default: 'SELECT * FROM dual',
				required: true,
				description: 'SQL query to execute',
				placeholder: 'SELECT * FROM employees WHERE department_id = ?',
			},

			// === Transaction Operation ===
			{
				displayName: 'SQL Statements',
				name: 'sqlStatements',
				type: 'string',
				typeOptions: {
					alwaysOpenEditWindow: true,
					rows: 15,
					editor: 'sql',
				},
				displayOptions: {
					show: {
						operationType: ['transaction'],
					},
				},
				default: `BEGIN
  INSERT INTO table1 VALUES (?, ?);
  UPDATE table2 SET col1 = ? WHERE id = ?;
  COMMIT;
END;`,
				required: true,
				description: 'Multiple SQL statements or PL/SQL block',
			},

			// === Batch Operation ===
			{
				displayName: 'Batch Type',
				name: 'batchType',
				type: 'options',
				displayOptions: {
					show: {
						operationType: ['batch'],
					},
				},
				default: 'insert',
				options: [
					{
						name: 'Bulk Insert',
						value: 'insert',
						description: 'High-performance bulk insert',
					},
					{
						name: 'Bulk Update',
						value: 'update',
						description: 'High-performance bulk update',
					},
					{
						name: 'Bulk Upsert',
						value: 'upsert',
						description: 'Insert or update based on key',
					},
				],
			},
			{
				displayName: 'Target Table',
				name: 'targetTable',
				type: 'string',
				displayOptions: {
					show: {
						operationType: ['batch'],
					},
				},
				default: '',
				required: true,
				description: 'Target table for batch operations',
				placeholder: 'employees',
			},

			// === Stored Procedure ===
			{
				displayName: 'Procedure Type',
				name: 'procedureType',
				type: 'options',
				displayOptions: {
					show: {
						operationType: ['procedure'],
					},
				},
				default: 'procedure',
				options: [
					{
						name: 'Stored Procedure',
						value: 'procedure',
						description: 'Call a stored procedure',
					},
					{
						name: 'Function',
						value: 'function',
						description: 'Call a function',
					},
					{
						name: 'Package Procedure',
						value: 'package',
						description: 'Call a procedure from a package',
					},
				],
			},
			{
				displayName: 'Procedure Name',
				name: 'procedureName',
				type: 'string',
				displayOptions: {
					show: {
						operationType: ['procedure'],
						procedureType: ['procedure', 'function'],
					},
				},
				default: '',
				required: true,
				description: 'Name of the stored procedure or function',
				placeholder: 'get_employee_details',
			},
			{
				displayName: 'Package Name',
				name: 'packageName',
				type: 'string',
				displayOptions: {
					show: {
						operationType: ['procedure'],
						procedureType: ['package'],
					},
				},
				default: '',
				required: true,
				description: 'Name of the package',
				placeholder: 'HR_UTILS',
			},
			{
				displayName: 'Procedure Name',
				name: 'packageProcedureName',
				type: 'string',
				displayOptions: {
					show: {
						operationType: ['procedure'],
						procedureType: ['package'],
					},
				},
				default: '',
				required: true,
				description: 'Name of the procedure within the package',
				placeholder: 'get_employee_details',
			},

			// === PL/SQL Block ===
			{
				displayName: 'PL/SQL Block',
				name: 'plsqlBlock',
				type: 'string',
				typeOptions: {
					alwaysOpenEditWindow: true,
					rows: 15,
					editor: 'sql',
				},
				displayOptions: {
					show: {
						operationType: ['plsql'],
					},
				},
				default: `DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM dual;
  DBMS_OUTPUT.PUT_LINE('Count: ' || v_count);
END;`,
				required: true,
				description: 'PL/SQL block to execute',
			},

			// === Connection Pool ===
			{
				displayName: 'Pool Configuration',
				name: 'poolConfiguration',
				type: 'options',
				displayOptions: {
					show: {
						operationType: ['pool'],
					},
				},
				default: 'highVolume',
				options: [
					{
						name: 'High Volume OLTP',
						value: 'highVolume',
						description: 'Optimized for high-volume transactional workloads',
					},
					{
						name: 'Analytics Workload',
						value: 'analytics',
						description: 'Optimized for analytical queries',
					},
					{
						name: 'Oracle Cloud',
						value: 'cloud',
						description: 'Optimized for Oracle Cloud Infrastructure',
					},
					{
						name: 'Custom',
						value: 'custom',
						description: 'Custom pool configuration',
					},
				],
			},

			// === Parameters ===
			{
				displayName: 'Parameters',
				name: 'parameters',
				type: 'collection',
				placeholder: 'Add Parameter',
				default: {},
				displayOptions: {
					show: {
						operationType: ['query', 'procedure', 'plsql'],
					},
				},
				options: [
					{
						displayName: 'Parameter Definitions',
						name: 'parameterDefinitions',
						type: 'fixedCollection',
						default: {},
						typeOptions: {
							multipleValues: true,
						},
						options: [
							{
								name: 'parameter',
								displayName: 'Parameter',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										description: 'Parameter name (for debugging)',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'Parameter value (supports expressions)',
									},
									{
										displayName: 'Type',
										name: 'type',
										type: 'options',
										default: 'string',
										options: [
											{ name: 'String', value: 'string' },
											{ name: 'Number', value: 'number' },
											{ name: 'Boolean', value: 'boolean' },
											{ name: 'Date', value: 'date' },
											{ name: 'Timestamp', value: 'timestamp' },
											{ name: 'CLOB', value: 'clob' },
											{ name: 'BLOB', value: 'blob' },
										],
									},
								],
							},
						],
					},
				],
			},

			// === Advanced Options ===
			{
				displayName: 'Advanced Options',
				name: 'advancedOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Fetch Size',
						name: 'fetchSize',
						type: 'number',
						default: 100,
						description: 'Number of rows to fetch at once',
						typeOptions: {
							minValue: 1,
							maxValue: 10000,
						},
					},
					{
						displayName: 'Query Timeout (seconds)',
						name: 'queryTimeout',
						type: 'number',
						default: 300,
						description: 'Maximum time to wait for query execution',
						typeOptions: {
							minValue: 1,
							maxValue: 3600,
						},
					},
					{
						displayName: 'Continue on Error',
						name: 'continueOnError',
						type: 'boolean',
						default: false,
						description: 'Continue processing even if some operations fail',
					},
					{
						displayName: 'Return Metadata',
						name: 'returnMetadata',
						type: 'boolean',
						default: false,
						description: 'Include column metadata in results',
					},
					{
						displayName: 'Use Result Mapper',
						name: 'useResultMapper',
						type: 'boolean',
						default: true,
						description: 'Apply Oracle type mapping to results',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operationType = this.getNodeParameter('operationType', 0) as string;

		// Get credentials and build config
		const credentials = await this.getCredentials('oracleJdbc');
		const config: OracleJdbcConfig = this.buildOracleConfig(credentials);

		try {
			switch (operationType) {
				case 'query':
					await this.executeQuery(config, items, returnData);
					break;
				case 'transaction':
					await this.executeTransaction(config, items, returnData);
					break;
				case 'batch':
					await this.executeBatch(config, items, returnData);
					break;
				case 'procedure':
					await this.executeProcedure(config, items, returnData);
					break;
				case 'pool':
					await this.executeWithPool(config, items, returnData);
					break;
				case 'plsql':
					await this.executePlsql(config, items, returnData);
					break;
				default:
					throw new NodeOperationError(this.getNode(), `Unknown operation type: ${operationType}`);
			}
		} catch (error: any) {
			if (this.getNodeParameter('advancedOptions.continueOnError', 0, false)) {
				returnData.push({
					json: {
						error: true,
						message: error.message,
						operation: operationType,
					},
					pairedItem: { item: 0 },
				});
			} else {
				throw new NodeOperationError(
					this.getNode(),
					`Oracle JDBC execution failed: ${error.message}`,
					{ itemIndex: 0 },
				);
			}
		}

		return [returnData];
	}


	// chame sempre com o ctx vindo do execute()
	private async executeQuery(
		ctx: IExecuteFunctions,
		config: OracleJdbcConfig,
		items: INodeExecutionData[],
		returnData: INodeExecutionData[],
		): Promise<void> {
		const sqlQuery = ctx.getNodeParameter('sqlQuery', 0) as string;
		const advancedOptions = ctx.getNodeParameter('advancedOptions', 0, {}) as IDataObject;

		const execOptions: ExecutionOptions = {
			// garanta que sua interface ExecutionOptions tenha 'timeout?: number'
			timeout: (advancedOptions.queryTimeout as number) ?? 300,
		};

		// use ctx.getNode() para erros
		// throw new NodeOperationError(ctx.getNode(), 'mensagem');
	}


	private async executeTransaction(
		config: OracleJdbcConfig,
		items: INodeExecutionData[],
		returnData: INodeExecutionData[],
	): Promise<void> {
		const manager = JdbcConnectionManager.getInstance();
		const connection = await manager.createConnection(config);
		const transactionManager = new TransactionManager(connection);

		try {
			await transactionManager.beginTransaction({
				isolationLevel: 'READ_COMMITTED',
				timeout: this.getNodeParameter('advancedOptions.queryTimeout', 0, 300) as number,
			});

			let totalExecuted = 0;
			for (let i = 0; i < items.length; i++) {
				const sqlStatements = this.getNodeParameter('sqlStatements', i) as string;
				const statements = SqlParser.splitStatements(sqlStatements);
				const parameters = this.processParameters(i, items[i].json);

				for (const statement of statements) {
					const parsed = SqlParser.parseStatement(statement);
					if (parsed.isPLSQL) {
						await manager.executeQuery(connection, statement, parameters);
					} else {
						await manager.executeQuery(connection, statement, parameters);
					}
					totalExecuted++;
				}
			}

			await transactionManager.commit();

			returnData.push({
				json: {
					success: true,
					operation: 'transaction',
					statementsExecuted: totalExecuted,
					itemsProcessed: items.length,
				},
			});
		} catch (error) {
			await transactionManager.rollback();
			throw error;
		} finally {
			await manager.closeConnection(connection);
		}
	}

	private async executeBatch(
		config: OracleJdbcConfig,
		items: INodeExecutionData[],
		returnData: INodeExecutionData[],
	): Promise<void> {
		const manager = JdbcConnectionManager.getInstance();
		const connection = await manager.createConnection(config);
		const batchOps = new BatchOperations(connection);

		try {
			const batchType = this.getNodeParameter('batchType', 0) as string;
			const targetTable = this.getNodeParameter('targetTable', 0) as string;
			const advancedOptions = this.getNodeParameter('advancedOptions', 0, {}) as IDataObject;

			const data = items.map(item => item.json);

			let result;
			switch (batchType) {
				case 'insert':
					result = await batchOps.bulkInsert(targetTable, data, {
						batchSize: 1000,
						continueOnError: advancedOptions.continueOnError as boolean,
						timeout: advancedOptions.queryTimeout as number,
					});
					break;
				case 'update':
					// Implement bulk update
					throw new NodeOperationError(this.getNode(), 'Bulk update not yet implemented');
				case 'upsert':
					// Implement bulk upsert
					throw new NodeOperationError(this.getNode(), 'Bulk upsert not yet implemented');
				default:
					throw new NodeOperationError(this.getNode(), `Unknown batch type: ${batchType}`);
			}

			returnData.push({
				json: {
					success: true,
					operation: 'batch',
					batchType,
					targetTable,
					...result,
				},
			});
		} finally {
			await manager.closeConnection(connection);
		}
	}

	private async executeProcedure(
		config: OracleJdbcConfig,
		items: INodeExecutionData[],
		returnData: INodeExecutionData[],
	): Promise<void> {
		const manager = JdbcConnectionManager.getInstance();
		const connection = await manager.createConnection(config);
		const procExecutor = new StoredProcedureExecutor(connection);

		try {
			const procedureType = this.getNodeParameter('procedureType', 0) as string;

			for (let i = 0; i < items.length; i++) {
				const parameters = this.processProcedureParameters(i, items[i].json);

				let result;
				switch (procedureType) {
					case 'procedure':
						const procedureName = this.getNodeParameter('procedureName', i) as string;
						result = await procExecutor.callProcedure(procedureName, parameters);
						break;
					case 'function':
						const functionName = this.getNodeParameter('procedureName', i) as string;
						result = await procExecutor.callFunction(functionName, 'VARCHAR2', parameters);
						break;
					case 'package':
						const packageName = this.getNodeParameter('packageName', i) as string;
						const packageProcedureName = this.getNodeParameter('packageProcedureName', i) as string;
						result = await procExecutor.callPackageProcedure(
							packageName,
							packageProcedureName,
							parameters,
						);
						break;
					default:
						throw new NodeOperationError(
							this.getNode(),
							`Unknown procedure type: ${procedureType}`,
						);
				}

				returnData.push({
					json: {
						success: true,
						operation: 'procedure',
						procedureType,
						...result,
					},
					pairedItem: { item: i },
				});
			}
		} finally {
			await manager.closeConnection(connection);
		}
	}

	private async executePlsql(
		config: OracleJdbcConfig,
		items: INodeExecutionData[],
		returnData: INodeExecutionData[],
	): Promise<void> {
		const manager = JdbcConnectionManager.getInstance();
		const connection = await manager.createConnection(config);
		const queryExecutor = new QueryExecutor(connection);

		try {
			for (let i = 0; i < items.length; i++) {
				const plsqlBlock = this.getNodeParameter('plsqlBlock', i) as string;
				const parameters = this.processParameters(i, items[i].json);

				const result = await queryExecutor.executePLSQL(plsqlBlock, parameters);

				returnData.push({
					json: {
						success: true,
						operation: 'plsql',
						...result,
					},
					pairedItem: { item: i },
				});
			}
		} finally {
			await manager.closeConnection(connection);
		}
	}

	private async executeWithPool(
		config: OracleJdbcConfig,
		items: INodeExecutionData[],
		returnData: INodeExecutionData[],
	): Promise<void> {
		const poolManager = PoolManager.getInstance();
		const poolConfiguration = this.getNodeParameter('poolConfiguration', 0) as string;

		let poolConfig;
		switch (poolConfiguration) {
			case 'highVolume':
				poolConfig = PoolConfigurationPresets.getHighVolumeOLTP();
				break;
			case 'analytics':
				poolConfig = PoolConfigurationPresets.getAnalyticsWorkload();
				break;
			case 'cloud':
				poolConfig = PoolConfigurationPresets.getOracleCloudConfig();
				break;
			default:
				poolConfig = {};
		}

		const poolName = `n8n_pool_${Date.now()}`;

		try {
			await poolManager.createPool(poolName, config, poolConfig);
			const pool = poolManager.getPool(poolName);

			for (let i = 0; i < items.length; i++) {
				const connection = await pool.getConnection();

				try {
					const result = await JdbcConnectionManager.getInstance().executeQuery(
						connection,
						'SELECT 1 as status FROM dual',
					);

					returnData.push({
						json: {
							success: true,
							operation: 'pool',
							poolConfiguration,
							result: result.rows[0],
							poolStats: await pool.getPoolStatistics(),
						},
						pairedItem: { item: i },
					});
				} finally {
					await pool.returnConnection(connection);
				}
			}
		} finally {
			await poolManager.closePool(poolName);
		}
	}

	private buildOracleConfig(credentials: IDataObject): OracleJdbcConfig {
		return {
			host: credentials.host as string,
			port: credentials.port as number,
			connectionType: credentials.connectionType as 'service' | 'sid' | 'tns',
			serviceName: credentials.serviceName as string,
			sid: credentials.sid as string,
			tnsString: credentials.tnsString as string,
			username: credentials.username as string,
			password: credentials.password as string,
			connectionOptions: {
				connectionTimeout: credentials.advancedOptions?.connectionTimeout as number,
				socketTimeout: credentials.advancedOptions?.socketTimeout as number,
				sslMode: credentials.sslConfig?.sslMode as 'disabled' | 'required' | 'verify-ca',
				schema: credentials.schema as string,
			},
		};
	}

	private processParameters(itemIndex: number, inputData: IDataObject): any[] {
		const parametersConfig = this.getNodeParameter('parameters', itemIndex, {}) as IDataObject;
		const parameterDefinitions = parametersConfig.parameterDefinitions as any;

		if (!parameterDefinitions?.parameter) {
			return [];
		}

		const parameters: ParameterDefinition[] = parameterDefinitions.parameter.map((p: any) => ({
			name: p.name,
			value: p.value,
			type: p.type,
			mode: 'IN',
			nullable: true,
		}));

		return ParameterBinder.processParameters(parameters, inputData);
	}

	private processProcedureParameters(itemIndex: number, inputData: IDataObject): any[] {
		// Similar to processParameters but for stored procedures
		// Would include parameter modes (IN, OUT, INOUT) and data types
		return this.processParameters(itemIndex, inputData);
	}
}
