
/**
 * Oracle para n8n-nodes-oracle-jdbc
 * Suporte para modo JDBC
 *
 * @author Jônatas Meireles Sousa Vieira
 * @version 0.0.1-rc.1
 */

import * as java from 'java-bridge';

import { IDataObject, INodeExecutionData } from 'n8n-workflow';

import { ParameterDefinition, ParameterMode, ParameterType } from '../types/JdbcTypes';
import { OracleTypeUtils } from '../types/OracleTypes';
import { string } from 'sql-formatter/dist/cjs/lexer/regexFactory';

export interface ParameterBindingOptions {
	validateTypes?: boolean;
	convertTypes?: boolean;
	truncateStrings?: boolean;
	maxStringLength?: number;
	dateFormat?: string;
	nullHandling?: 'null' | 'empty' | 'default';
	arrayHandling?: 'join' | 'json' | 'error';
	objectHandling?: 'json' | 'toString' | 'error';
	timezone?: string;
}

export interface ParameterValidationResult {
	valid: boolean;
	errors: ParameterValidationError[];
	warnings: ParameterValidationWarning[];
}

export interface ParameterValidationError {
	parameterIndex: number;
	parameterName?: string;
	error: string;
	expectedType: string;
	actualType: string;
	value: any;
}

export interface ParameterValidationWarning {
	parameterIndex: number;
	parameterName?: string;
	warning: string;
	suggestion?: string;
}

export interface ProcessedParameter {
	originalValue: any;
	processedValue: any;
	sqlType: number;
	javaValue: any;
	metadata: {
		type: ParameterType;
		mode: ParameterMode;
		size?: number;
		precision?: number;
		scale?: number;
		nullable: boolean;
	};
}

export class ParameterBinder {
	private static readonly DEFAULT_OPTIONS: ParameterBindingOptions = {
		validateTypes: true,
		convertTypes: true,
		truncateStrings: true,
		maxStringLength: 4000,
		dateFormat: 'ISO',
		nullHandling: 'null',
		arrayHandling: 'json',
		objectHandling: 'json',
		timezone: 'UTC',
	};

	static processParameters(
		parameters: ParameterDefinition[],
		inputData: IDataObject,
		options: ParameterBindingOptions = {},
	): ProcessedParameter[] {
		if (!parameters || parameters.length === 0) {
			return [];
		}

		const opts = { ...this.DEFAULT_OPTIONS, ...options };
		const processedParams: ProcessedParameter[] = [];

		for (let i = 0; i < parameters.length; i++) {
			const param = parameters[i];
			try {
				const processed = this.processParameter(param, inputData, opts, i);
				processedParams.push(processed);
			} catch (error: unknown) {
				const message =
					error instanceof Error ? error.message : String(error);

				throw new Error(`Parameter ${i + 1} (${param.name || 'unnamed'}): ${message}`);
			}
		}

		return processedParams;
	}

	static processParametersAdvanced(
		parameters: ParameterDefinition[],
		executionData: INodeExecutionData[],
		itemIndex: number = 0,
		options: ParameterBindingOptions = {},
	): ProcessedParameter[] {
		const inputData = executionData[itemIndex]?.json || {};
		const binaryData = executionData[itemIndex]?.binary;

		// Merge binary data references into inputData for expression resolution
		const contextData = {
			...inputData,
			$binary: binaryData || {},
			$index: itemIndex,
			$item: executionData[itemIndex],
			$items: executionData,
			$now: new Date(),
			$today: new Date().toISOString().split('T')[0],
			$workflow: {
				id: process.env.WORKFLOW_ID || 'unknown',
				name: process.env.WORKFLOW_NAME || 'unknown',
			},
		};

		return this.processParameters(parameters, contextData, options);
	}

	static validateParameters(
		parameters: ParameterDefinition[],
		inputData: IDataObject,
		options: ParameterBindingOptions = {},
	): ParameterValidationResult {
		const errors: ParameterValidationError[] = [];
		const warnings: ParameterValidationWarning[] = [];

		for (let i = 0; i < parameters.length; i++) {
			const param = parameters[i];
			let value = param.value;

			// Resolve expressions
			if (typeof value === 'string' && value.includes('{{')) {
				try {
					value = this.resolveExpressions(value, inputData);
				} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);

						errors.push({
							parameterIndex: i,
							parameterName: param.name,
							error: `Expression resolution failed: ${errorMessage}`,
							expectedType: param.type || 'any',
							actualType: typeof value,
							value,
						});
					}
			}

			// Type validation
			const expectedType = param.type || this.inferType(value);
			const actualType = this.getActualType(value);

			if (!this.isTypeCompatible(actualType, expectedType)) {
				if (options.convertTypes) {
					try {
						value = this.convertType(value, expectedType, options); 
						warnings.push({
							parameterIndex: i,
							parameterName: param.name,
							warning: `Type conversion from ${actualType} to ${expectedType}`,
							suggestion: 'Consider providing the correct type directly',
						});
					} catch (conversionError) {
						const conversionMessage = conversionError instanceof Error ? conversionError.message : String(conversionError);

						errors.push({
							parameterIndex: i,
							parameterName: param.name,
							error: `Type conversion failed: ${conversionMessage}`,
							expectedType,
							actualType,
							value,
						});
					}

				} else {
					errors.push({
						parameterIndex: i,
						parameterName: param.name,
						error: `Type mismatch: expected ${expectedType}, got ${actualType}`,
						expectedType,
						actualType,
						value,
					});
				}
			}

			// Value constraints validation
			if (param.constraints) {
				const constraintValidation = this.validateConstraints(value, param.constraints);
				if (!constraintValidation.valid) {
					errors.push(
						...constraintValidation.errors.map(err => ({
							parameterIndex: i,
							parameterName: param.name,
							error: err,
							expectedType,
							actualType,
							value,
						})),
					);
				}
			}

			// Size validation for strings
			if (expectedType === 'string' && typeof value === 'string') {
				if (options.maxStringLength && value.length > options.maxStringLength) {
					if (options.truncateStrings) {
						warnings.push({
							parameterIndex: i,
							parameterName: param.name,
							warning: `String truncated from ${value.length} to ${options.maxStringLength} characters`,
						});
					} else {
						errors.push({
							parameterIndex: i,
							parameterName: param.name,
							error: `String too long: ${value.length} > ${options.maxStringLength}`,
							expectedType,
							actualType,
							value,
						});
					}
				}
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	static bindParametersToStatement(
		statement: any,
		processedParams: ProcessedParameter[],
		startIndex: number = 1,
	): Promise<void> {
		return Promise.all(
			processedParams.map(async (param, index) => {
				const paramIndex = startIndex + index;
				await this.bindSingleParameter(statement, paramIndex, param);
			}),
		).then(() => {});
	}

	private static processParameter(
		param: ParameterDefinition,
		inputData: IDataObject,
		options: ParameterBindingOptions,
		index: number,
	): ProcessedParameter {
		let value = param.value;
		const originalValue = value;

		// Resolve expressions
		if (typeof value === 'string' && value.includes('{{')) {
			value = this.resolveExpressions(value, inputData);
		}

		// Infer type if not specified
		const paramType = param.type || this.inferType(value);

		// Convert and validate
		if (options.convertTypes) {
			value = this.convertType(value, paramType, options);
		}

		// Convert to Java type
		const javaValue = this.convertToJavaType(value, paramType, options);
		const sqlType = this.getSQLType(paramType);

		return {
			originalValue,
			processedValue: value,
			sqlType,
			javaValue,
			metadata: {
				type: paramType,
				mode: param.mode || 'IN',
				size: param.size,
				precision: param.precision,
				scale: param.scale,
				nullable: param.nullable !== false,
			},
		};
	}

	private static resolveExpressions(value: string, data: IDataObject): any {
		return value.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
			try {
				const trimmedExpr = expression.trim();

				// Handle different expression patterns
				if (trimmedExpr.startsWith('$json.')) {
					return this.resolveJsonPath(trimmedExpr.substring(6), data);
				} else if (trimmedExpr.startsWith('$binary.')) {
					return this.resolveBinaryPath(trimmedExpr.substring(8), data);
				} else if (trimmedExpr.startsWith('$item.')) {
					return this.resolveItemPath(trimmedExpr.substring(6), data);
				} else if (trimmedExpr === '$now') {
					return new Date().toISOString();
				} else if (trimmedExpr === '$today') {
					return new Date().toISOString().split('T')[0];
				} else if (trimmedExpr.startsWith('$index')) {
					return data.$index || 0;
				} else if (trimmedExpr.includes('(') && trimmedExpr.includes(')')) {
					// Function calls
					return this.resolveFunctionCall(trimmedExpr, data);
				} else {
					// Simple property access
					return this.resolvePropertyPath(trimmedExpr, data);
				}
			} catch (error) {
				console.warn(`Failed to resolve expression: ${expression}`, error);
				return match; // Return original if resolution fails
			}
		});
	}

	private static resolveJsonPath(path: string, data: IDataObject): any {
		const parts = path.split('.');
		let current: any = data;

		for (const part of parts) {
			if (current === null || current === undefined) return null;
			if (typeof current !== 'object') return null;
			current = current[part];
		}

		return current;
	}

	private static resolveBinaryPath(path: string, data: IDataObject): any {
		const binaryData = data.$binary as any;
		if (!binaryData) return null;

		const parts = path.split('.');
		let current = binaryData;

		for (const part of parts) {
			if (current === null || current === undefined) return null;
			current = current[part];
		}

		return current;
	}

	private static resolveItemPath(path: string, data: IDataObject): any {
		const item = data.$item as any;
		if (!item) return null;

		const parts = path.split('.');
		let current = item;

		for (const part of parts) {
			if (current === null || current === undefined) return null;
			current = current[part];
		}

		return current;
	}

	private static resolveFunctionCall(expression: string, data: IDataObject): any {
		// Simple function support
		const functionMatch = expression.match(/^(\w+)\(([^)]*)\)$/);
		if (!functionMatch) return expression;

		const [, funcName, argsStr] = functionMatch;
		const args = argsStr ? argsStr.split(',').map(arg => arg.trim()) : [];

		switch (funcName) {
			case 'now':
				return new Date().toISOString();
			case 'uuid':
				return this.generateUUID();
			case 'random':
				return Math.random();
			case 'randomInt':
				const max = parseInt(args[0]) || 100;
				return Math.floor(Math.random() * max);
			case 'formatDate': {
				const date = new Date(args[0] || Date.now());
				const format = args[1] || 'ISO';
				return this.formatDate(date, format);
			}
			case 'length': {
				if (!args[0]) return 0;
				const value = this.resolvePropertyPath(args[0], data);
				return Array.isArray(value) || typeof value === 'string' ? value.length : 0;
			}
			default:
				return expression;
		}
	}

	private static resolvePropertyPath(path: string, data: IDataObject): any {
		if (data.hasOwnProperty(path)) {
			return data[path];
		}

		// Try nested path
		const parts = path.split('.');
		let current: any = data;

		for (const part of parts) {
			if (current === null || current === undefined) return null;
			if (typeof current !== 'object') return null;
			current = current[part];
		}

		return current;
	}

	private static convertType(
		value: any,
		targetType: ParameterType,
		options: ParameterBindingOptions,
	): any {
		if (value === null || value === undefined) {
			return options.nullHandling === 'null'
				? null
				: options.nullHandling === 'empty'
					? ''
					: this.getDefaultValue(targetType);
		}

		switch (targetType) {
			case 'string':
				if (Array.isArray(value)) {
					return options.arrayHandling === 'join'
						? value.join(',')
						: options.arrayHandling === 'json'
							? JSON.stringify(value)
							: String(value);
				}
				if (typeof value === 'object') {
					return options.objectHandling === 'json'
						? JSON.stringify(value)
						: options.objectHandling === 'toString'
							? String(value)
							: '[object Object]';
				}
				let strValue = String(value);
				if (
					options.truncateStrings &&
					options.maxStringLength &&
					strValue.length > options.maxStringLength
				) {
					strValue = strValue.substring(0, options.maxStringLength);
				}
				return strValue;

			case 'number':
				if (typeof value === 'string') {
					const numValue = parseFloat(value);
					if (isNaN(numValue)) {
						throw new Error(`Cannot convert "${value}" to number`);
					}
					return numValue;
				}
				if (typeof value === 'boolean') {
					return value ? 1 : 0;
				}
				if (typeof value === 'number') {
					return value;
				}
				throw new Error(`Cannot convert ${typeof value} to number`);

			case 'boolean':
				if (typeof value === 'string') {
					const lower = value.toLowerCase();
					if (['true', '1', 'yes', 'on'].includes(lower)) return true;
					if (['false', '0', 'no', 'off'].includes(lower)) return false;
					throw new Error(`Cannot convert "${value}" to boolean`);
				}
				if (typeof value === 'number') {
					return value !== 0;
				}
				return Boolean(value);

			case 'date':
			case 'timestamp':
				if (value instanceof Date) return value;
				if (typeof value === 'string') {
					const dateValue = new Date(value);
					if (isNaN(dateValue.getTime())) {
						throw new Error(`Cannot convert "${value}" to date`);
					}
					return dateValue;
				}
				if (typeof value === 'number') {
					return new Date(value);
				}
				throw new Error(`Cannot convert ${typeof value} to date`);

			case 'clob':
			case 'blob':
				return value;

			default:
				return value;
		}
	}

	private static convertToJavaType(
		value: any,
		type: ParameterType,
		options: ParameterBindingOptions,
	): any {
		if (value === null || value === undefined) {
			return null;
		}

		switch (type) {
			case 'string':
				return String(value);

			case 'number':
				if (Number.isInteger(value)) {
					return java.newInstanceSync('java.lang.Long', value);
				} else {
					return java.newInstanceSync('java.math.BigDecimal', String(value));
				}

			case 'boolean':
				return Boolean(value);

			case 'date':
			case 'timestamp':
				const date = value instanceof Date ? value : new Date(value);
				return java.newInstanceSync('java.sql.Timestamp', date.getTime());

			case 'time':
				const timeDate = value instanceof Date ? value : new Date(value);
				return java.newInstanceSync('java.sql.Time', timeDate.getTime());

			case 'clob':
				return String(value);

			case 'blob':
				return Buffer.isBuffer(value) ? value : Buffer.from(String(value));

			case 'raw':
				return Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'hex');

			default:
				return value;
		}
	}

	private static async bindSingleParameter(
		statement: any,
		paramIndex: number,
		processedParam: ProcessedParameter,
	): Promise<void> {
		const { javaValue, metadata } = processedParam;

		if (javaValue === null) {
			await statement.setNull(paramIndex, processedParam.sqlType);
			return;
		}

		switch (metadata.type) {
			case 'string':
				await statement.setString(paramIndex, javaValue);
				break;
			case 'number':
				if (Number.isInteger(processedParam.processedValue)) {
					await statement.setLong(paramIndex, processedParam.processedValue);
				} else {
					await statement.setBigDecimal(paramIndex, javaValue);
				}
				break;
			case 'boolean':
				await statement.setBoolean(paramIndex, javaValue);
				break;
			case 'date':
				await statement.setDate(paramIndex, javaValue);
				break;
			case 'timestamp':
				await statement.setTimestamp(paramIndex, javaValue);
				break;
			case 'time':
				await statement.setTime(paramIndex, javaValue);
				break;
			case 'clob':
				await statement.setClob(paramIndex, javaValue);
				break;
			case 'blob':
				await statement.setBlob(paramIndex, javaValue);
				break;
			case 'raw':
				await statement.setBytes(paramIndex, javaValue);
				break;
			default:
				await statement.setObject(paramIndex, javaValue);
		}
	}

	private static inferType(value: any): ParameterType {
		if (value === null || value === undefined) return 'string';
		if (typeof value === 'string') return 'string';
		if (typeof value === 'number') return 'number';
		if (typeof value === 'boolean') return 'boolean';
		if (value instanceof Date) return 'timestamp';
		if (Buffer.isBuffer(value)) return 'blob';
		if (Array.isArray(value)) return 'string'; // Will be JSON stringified
		if (typeof value === 'object') return 'string'; // Will be JSON stringified
		return 'string';
	}

	private static getActualType(value: any): string {
		if (value === null || value === undefined) return 'null';
		if (typeof value === 'string') return 'string';
		if (typeof value === 'number') return 'number';
		if (typeof value === 'boolean') return 'boolean';
		if (value instanceof Date) return 'date';
		if (Buffer.isBuffer(value)) return 'buffer';
		if (Array.isArray(value)) return 'array';
		if (typeof value === 'object') return 'object';
		return typeof value;
	}

	private static isTypeCompatible(actualType: string, expectedType: ParameterType): boolean {
		if (actualType === 'null') return true; // null is compatible with all types
		if (actualType === expectedType) return true;

		// Compatible conversions
		const compatibilityMap: { [key: string]: ParameterType[] } = {
			string: ['string', 'clob'],
			number: ['number', 'string'],
			boolean: ['boolean', 'string', 'number'],
			date: ['timestamp', 'date', 'time', 'string'],
			array: ['string'],
			object: ['string'],
			buffer: ['blob', 'raw', 'string'],
		};

		return compatibilityMap[actualType]?.includes(expectedType) || false;
	}

	private static validateConstraints(
		value: any,
		constraints: any,
	): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (constraints.required && (value === null || value === undefined || value === '')) {
			errors.push('Value is required');
		}

		if (typeof value === 'string') {
			if (constraints.minLength && value.length < constraints.minLength) {
				errors.push(`String too short: ${value.length} < ${constraints.minLength}`);
			}
			if (constraints.maxLength && value.length > constraints.maxLength) {
				errors.push(`String too long: ${value.length} > ${constraints.maxLength}`);
			}
			if (constraints.pattern) {
				const regex =
					constraints.pattern instanceof RegExp
						? constraints.pattern
						: new RegExp(constraints.pattern);
				if (!regex.test(value)) {
					errors.push(`Value does not match pattern: ${constraints.pattern}`);
				}
			}
		}

		if (typeof value === 'number') {
			if (constraints.minValue !== undefined && value < constraints.minValue) {
				errors.push(`Value too small: ${value} < ${constraints.minValue}`);
			}
			if (constraints.maxValue !== undefined && value > constraints.maxValue) {
				errors.push(`Value too large: ${value} > ${constraints.maxValue}`);
			}
		}

		if (constraints.enumValues && !constraints.enumValues.includes(value)) {
			errors.push(`Value not in allowed list: ${constraints.enumValues.join(', ')}`);
		}

		if (constraints.customValidator && typeof constraints.customValidator === 'function') {
			const result = constraints.customValidator(value);
			if (result !== true) {
				errors.push(typeof result === 'string' ? result : 'Custom validation failed');
			}
		}

		return { valid: errors.length === 0, errors };
	}

	private static getSQLType(paramType: ParameterType): number {
		const Types = java.javaImport('java.sql.Types');

		switch (paramType) {
			case 'string':
				return Types.VARCHAR;
			case 'number':
				return Types.NUMERIC;
			case 'boolean':
				return Types.BOOLEAN;
			case 'date':
				return Types.DATE;
			case 'timestamp':
				return Types.TIMESTAMP;
			case 'time':
				return Types.TIME;
			case 'clob':
				return Types.CLOB;
			case 'blob':
				return Types.BLOB;
			case 'raw':
				return Types.VARBINARY;
			default:
				return Types.OTHER;
		}
	}

	private static getDefaultValue(type: ParameterType): any {
		switch (type) {
			case 'string':
				return '';
			case 'number':
				return 0;
			case 'boolean':
				return false;
			case 'date':
			case 'timestamp':
			case 'time':
				return new Date();
			default:
				return null;
		}
	}

	private static generateUUID(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	private static formatDate(date: Date, format: string): string {
		switch (format) {
			case 'ISO':
				return date.toISOString();
			case 'UTC':
				return date.toUTCString();
			case 'LOCAL':
				return date.toLocaleString();
			case 'DATE':
				return date.toISOString().split('T')[0];
			case 'TIME':
				return date.toISOString().split('T')[1].split('.')[0];
			case 'EPOCH':
				return date.getTime().toString();
			default:
				return date.toISOString();
		}
	}

	// Static utility methods
	static createParameter(
		value: any,
		type?: ParameterType,
		options?: Partial<ParameterDefinition>,
	): ParameterDefinition {
		return {
			value,
			type: type || this.inferType(value),
			mode: 'IN',
			nullable: true,
			...options,
		};
	}

	static createParameters(values: any[], types?: ParameterType[]): ParameterDefinition[] {
		return values.map((value, index) => this.createParameter(value, types?.[index]));
	}

	static createNamedParameters(
		data: IDataObject,
		typeOverrides?: { [key: string]: ParameterType },
	): ParameterDefinition[] {
		return Object.entries(data).map(([name, value]) => ({
			name,
			value,
			type: typeOverrides?.[name] || this.inferType(value),
			mode: 'IN' as ParameterMode,
			nullable: true,
		}));
	}
}
