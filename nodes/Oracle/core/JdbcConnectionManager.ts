/**
 * Oracle para n8n-nodes-oracle-jdbc
 * Suporte para modo JDBC
 *
 * @author Jônatas Meireles Sousa Vieira
 * @version 0.0.1-rc.1
 */
import * as java from 'java-bridge';
import { v4 as uuidv4 } from 'uuid';

import { JdbcConnection, OracleJdbcConfig, QueryResult } from '../types/JdbcTypes';

import { OracleJdbcDriver } from './OracleJdbcDriver';

export class JdbcConnectionManager {
	private static instance: JdbcConnectionManager;

	// Método initialize() agora está definido na classe
	private async initialize(): Promise<void> {
		if (!OracleJdbcDriver.isInitialized) {
			await OracleJdbcDriver.initialize();
		}
	}

	async createConnection(config: OracleJdbcConfig): Promise<JdbcConnection> {
		await this.initialize(); // Agora funciona corretamente

		const connectionId = uuidv4();

		try {
			// Solução: Usar o método público getConnectionString()
			const connectionUrl = OracleJdbcDriver.getConnectionString(config);

			const DriverManager = java.javaImport('java.sql.DriverManager');

			const connection = await DriverManager.getConnection(
				connectionUrl,
				config.username,
				config.password,
			);

			const jdbcConnection: JdbcConnection = {
				id: connectionId,
				connection,
				config,
				createdAt: new Date(),
				isActive: true,
				isPooled: false,
			};

			return jdbcConnection;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);

			throw new Error(`Failed to create connection: ${message}`);
		}
	}

	async executeQuery(
		jdbcConnection: JdbcConnection,
		sql: string,
		parameters?: any[],
	): Promise<QueryResult> {
		try {
			const startTime = Date.now();
			let statement;

			// Correção: Verificar se parameters existe antes de acessar .length
			if (parameters && parameters.length > 0) {
				statement = await jdbcConnection.connection.prepareStatement(sql);
				await this.bindParameters(statement, parameters);
			} else {
				statement = await jdbcConnection.connection.createStatement();
			}

			const isSelect = sql.trim().toLowerCase().startsWith('select');

			if (isSelect) {
				// Correção: Verificar se parameters existe e tem elementos
				const resultSet =
					parameters && parameters.length > 0
						? await statement.executeQuery()
						: await statement.executeQuery(sql);

				const rows = await this.extractResultSet(resultSet);
				await resultSet.close();

				return {
					rows,
					rowCount: rows.length,
					executionTime: Date.now() - startTime,
				};
			} else {
				// Correção: Verificar se parameters existe e tem elementos
				const updateCount =
					parameters && parameters.length > 0
						? await statement.executeUpdate()
						: await statement.executeUpdate(sql);

				return {
					rows: [],
					rowCount: updateCount,
					executionTime: Date.now() - startTime,
				};
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Query execution failed: ${message}`);
		}
	}

	// Método extractResultSet() agora está definido na classe
	private async extractResultSet(resultSet: any): Promise<any[]> {
		const rows: any[] = [];
		const metaData = await resultSet.getMetaData();
		const columnCount = await metaData.getColumnCount();

		while (await resultSet.next()) {
			const row: any = {};

			for (let i = 1; i <= columnCount; i++) {
				const columnName = await metaData.getColumnName(i);
				const columnValue = await resultSet.getObject(i);
				row[columnName] = columnValue;
			}

			rows.push(row);
		}

		return rows;
	}

	private async bindParameters(statement: any, parameters: any[]): Promise<void> {
		for (let i = 0; i < parameters.length; i++) {
			const param = parameters[i];
			const paramIndex = i + 1;

			if (param === null || param === undefined) {
				const Types = java.javaImport('java.sql.Types');
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
				const Timestamp = java.javaImport('java.sql.Timestamp');
				const timestamp = java.newInstanceSync('java.sql.Timestamp', param.getTime());
				await statement.setTimestamp(paramIndex, timestamp);
			} else {
				await statement.setObject(paramIndex, param);
			}
		}
	}

	// Método alternativo para construir connection string caso não queira modificar OracleJdbcDriver
	private buildConnectionString(config: OracleJdbcConfig): string {
		const { host, port = 1521, serviceName, sid } = config;

		if (serviceName) {
			return `jdbc:oracle:thin:@${host}:${port}/${serviceName}`;
		} else if (sid) {
			return `jdbc:oracle:thin:@${host}:${port}:${sid}`;
		} else {
			throw new Error('Either serviceName or sid must be provided');
		}
	}

	// Método singleton (caso queira usar)
	public static getInstance(): JdbcConnectionManager {
		if (!JdbcConnectionManager.instance) {
			JdbcConnectionManager.instance = new JdbcConnectionManager();
		}
		return JdbcConnectionManager.instance;
	}
}
