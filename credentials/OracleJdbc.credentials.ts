
/**
 * Oracle para n8n-nodes-oracle-jdbc
 * Suporte para modo JDBC
 *
 * @author Jônatas Meireles Sousa Vieira
 * @version 0.0.1-rc.1
 */

import {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
	NodeOperationError,
} from 'n8n-workflow';

export class OracleJdbc implements ICredentialType {
	name = 'oracleJdbc';
	displayName = 'Oracle Database (JDBC)';
	documentationUrl = 'https://docs.oracle.com/en/database/oracle/oracle-database/';

	icon: Icon = 'file:oracle.svg';

	properties: INodeProperties[] = [
		// === Connection Settings ===
		{
			displayName: 'Connection Settings',
			name: 'connectionSettings',
			type: 'notice',
			default: '',
			description: 'Configure Oracle database connection parameters',
		},
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: 'localhost',
			required: true,
			description: 'Oracle database server hostname or IP address',
			placeholder: 'oracle.company.com or 192.168.1.100',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 1521,
			required: true,
			description: 'Oracle database listener port (default: 1521)',
			typeOptions: {
				minValue: 1,
				maxValue: 65535,
			},
		},
		{
			displayName: 'Connection Type',
			name: 'connectionType',
			type: 'options',
			default: 'service',
			required: true,
			options: [
				{
					name: 'Service Name',
					value: 'service',
					description: 'Connect using Oracle Service Name (recommended)',
				},
				{
					name: 'SID',
					value: 'sid',
					description: 'Connect using Oracle System Identifier (SID)',
				},
				{
					name: 'TNS',
					value: 'tns',
					description: 'Connect using complete TNS connection string',
				},
				{
					name: 'Easy Connect',
					value: 'ezconnect',
					description: 'Oracle Easy Connect naming method',
				},
			],
		},
		{
			displayName: 'Service Name',
			name: 'serviceName',
			type: 'string',
			default: 'ORCL',
			required: true,
			displayOptions: {
				show: {
					connectionType: ['service'],
				},
			},
			description: 'Oracle service name (e.g., ORCL, XEPDB1, orcl.company.com)',
			placeholder: 'ORCL or XEPDB1',
		},
		{
			displayName: 'SID',
			name: 'sid',
			type: 'string',
			default: 'ORCL',
			required: true,
			displayOptions: {
				show: {
					connectionType: ['sid'],
				},
			},
			description: 'Oracle System Identifier (SID)',
			placeholder: 'ORCL or XE',
		},
		{
			displayName: 'TNS Connection String',
			name: 'tnsString',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				rows: 6,
			},
			displayOptions: {
				show: {
					connectionType: ['tns'],
				},
			},
			description: 'Complete TNS connection descriptor',
			placeholder: `(DESCRIPTION=
  (ADDRESS=(PROTOCOL=TCP)(HOST=myhost)(PORT=1521))
  (CONNECT_DATA=(SERVICE_NAME=myservice))
)`,
		},
		{
			displayName: 'Easy Connect String',
			name: 'ezConnectString',
			type: 'string',
			default: '',
			required: true,
			displayOptions: {
				show: {
					connectionType: ['ezconnect'],
				},
			},
			description: 'Oracle Easy Connect string',
			placeholder: 'hostname:port/service_name',
		},

		// === Authentication ===
		{
			displayName: 'Authentication',
			name: 'authSection',
			type: 'notice',
			default: '',
			description: 'Database authentication credentials',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'Oracle database username',
			placeholder: 'scott or hr@pdborcl',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Oracle database password',
		},
		{
			displayName: 'Schema',
			name: 'schema',
			type: 'string',
			default: '',
			description: 'Default schema to use (optional)',
			placeholder: 'HR or SCOTT',
		},

		// === Advanced Connection Options ===
		{
			displayName: 'Advanced Options',
			name: 'advancedOptions',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			options: [
				{
					displayName: 'Connection Timeout (seconds)',
					name: 'connectionTimeout',
					type: 'number',
					default: 30,
					description: 'Maximum time to wait for connection establishment',
					typeOptions: {
						minValue: 5,
						maxValue: 300,
					},
				},
				{
					displayName: 'Socket Timeout (seconds)',
					name: 'socketTimeout',
					type: 'number',
					default: 60,
					description: 'Maximum time to wait for socket operations',
					typeOptions: {
						minValue: 10,
						maxValue: 600,
					},
				},
				{
					displayName: 'Query Timeout (seconds)',
					name: 'queryTimeout',
					type: 'number',
					default: 300,
					description: 'Maximum time to wait for query execution',
					typeOptions: {
						minValue: 30,
						maxValue: 3600,
					},
				},
				{
					displayName: 'Connection Retry Attempts',
					name: 'retryAttempts',
					type: 'number',
					default: 3,
					description: 'Number of connection retry attempts',
					typeOptions: {
						minValue: 0,
						maxValue: 10,
					},
				},
				{
					displayName: 'Retry Delay (milliseconds)',
					name: 'retryDelay',
					type: 'number',
					default: 1000,
					description: 'Delay between retry attempts',
					typeOptions: {
						minValue: 100,
						maxValue: 10000,
					},
				},
			],
		},

		// === SSL Configuration ===
		{
			displayName: 'SSL Configuration',
			name: 'sslConfig',
			type: 'collection',
			placeholder: 'Add SSL Option',
			default: {},
			options: [
				{
					displayName: 'SSL Mode',
					name: 'sslMode',
					type: 'options',
					default: 'disabled',
					options: [
						{
							name: 'Disabled',
							value: 'disabled',
							description: 'No SSL encryption',
						},
						{
							name: 'Required',
							value: 'required',
							description: 'SSL encryption required',
						},
						{
							name: 'Verify CA',
							value: 'verify-ca',
							description: 'SSL with CA certificate verification',
						},
						{
							name: 'Verify Full',
							value: 'verify-full',
							description: 'SSL with full certificate verification',
						},
					],
				},
				{
					displayName: 'SSL Version',
					name: 'sslVersion',
					type: 'options',
					default: '1.2',
					displayOptions: {
						hide: {
							sslMode: ['disabled'],
						},
					},
					options: [
						{
							name: 'TLS 1.2',
							value: '1.2',
						},
						{
							name: 'TLS 1.3',
							value: '1.3',
						},
					],
				},
				{
					displayName: 'Truststore Path',
					name: 'truststorePath',
					type: 'string',
					default: '',
					displayOptions: {
						show: {
							sslMode: ['verify-ca', 'verify-full'],
						},
					},
					description: 'Path to Java truststore file',
					placeholder: '/path/to/truststore.jks',
				},
				{
					displayName: 'Truststore Password',
					name: 'truststorePassword',
					type: 'string',
					typeOptions: {
						password: true,
					},
					default: '',
					displayOptions: {
						show: {
							sslMode: ['verify-ca', 'verify-full'],
						},
					},
					description: 'Truststore password',
				},
				{
					displayName: 'Keystore Path',
					name: 'keystorePath',
					type: 'string',
					default: '',
					displayOptions: {
						show: {
							sslMode: ['verify-full'],
						},
					},
					description: 'Path to client keystore file (for mutual SSL)',
					placeholder: '/path/to/keystore.jks',
				},
				{
					displayName: 'Keystore Password',
					name: 'keystorePassword',
					type: 'string',
					typeOptions: {
						password: true,
					},
					default: '',
					displayOptions: {
						show: {
							sslMode: ['verify-full'],
						},
					},
					description: 'Keystore password',
				},
			],
		},

		// === Oracle Cloud (OCI) Configuration ===
		{
			displayName: 'Oracle Cloud Infrastructure (OCI)',
			name: 'ociConfig',
			type: 'collection',
			placeholder: 'Add OCI Option',
			default: {},
			options: [
				{
					displayName: 'Enable OCI IAM Authentication',
					name: 'enableOciIam',
					type: 'boolean',
					default: false,
					description: 'Use OCI IAM for authentication',
				},
				{
					displayName: 'OCI Config Profile',
					name: 'ociProfile',
					type: 'string',
					default: 'DEFAULT',
					displayOptions: {
						show: {
							enableOciIam: [true],
						},
					},
					description: 'OCI configuration profile name',
				},
				{
					displayName: 'Wallet Location',
					name: 'walletLocation',
					type: 'string',
					default: '',
					description: 'Path to Oracle Wallet directory',
					placeholder: '/opt/oracle/wallet',
				},
				{
					displayName: 'Use Oracle Wallet',
					name: 'useWallet',
					type: 'boolean',
					default: false,
					description: 'Use Oracle Wallet for secure connections',
				},
			],
		},

		// === Performance Tuning ===
		{
			displayName: 'Performance Tuning',
			name: 'performanceConfig',
			type: 'collection',
			placeholder: 'Add Performance Option',
			default: {},
			options: [
				{
					displayName: 'Default Fetch Size',
					name: 'defaultFetchSize',
					type: 'number',
					default: 100,
					description: 'Default number of rows to fetch at once',
					typeOptions: {
						minValue: 1,
						maxValue: 10000,
					},
				},
				{
					displayName: 'Statement Cache Size',
					name: 'statementCacheSize',
					type: 'number',
					default: 20,
					description: 'Number of prepared statements to cache',
					typeOptions: {
						minValue: 0,
						maxValue: 1000,
					},
				},
				{
					displayName: 'Row Prefetch',
					name: 'rowPrefetch',
					type: 'number',
					default: 20,
					description: 'Number of rows to prefetch',
					typeOptions: {
						minValue: 1,
						maxValue: 1000,
					},
				},
				{
					displayName: 'Enable JDBC Logging',
					name: 'enableLogging',
					type: 'boolean',
					default: false,
					description: 'Enable detailed JDBC logging (for debugging)',
				},
			],
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {},
	};

	// Suporte para uso no método test
	private buildConnectionUrl(credential: ICredentialDataDecryptedObject): string {
		const connectionType = credential.connectionType as string;
		const host = credential.host as string;
		const port = credential.port as number;
		let baseUrl: string;

		switch (connectionType) {
			case 'service':
				const serviceName = credential.serviceName as string;
				baseUrl = `jdbc:oracle:thin:@${host}:${port}/${serviceName}`;
				break;
			case 'sid':
				const sid = credential.sid as string;
				baseUrl = `jdbc:oracle:thin:@${host}:${port}:${sid}`;
				break;
			case 'tns':
				const tnsString = credential.tnsString as string;
				baseUrl = `jdbc:oracle:thin:@${tnsString}`;
				break;
			case 'ezconnect':
				const ezConnectString = credential.ezConnectString as string;
				baseUrl = `jdbc:oracle:thin:@//${ezConnectString}`;
				break;
			default:
				throw new Error(`Unsupported connection type: ${connectionType}`);
		}

		// Add SSL parameters if configured
		const sslConfig = credential.sslConfig as any;
		if (sslConfig?.sslMode && sslConfig.sslMode !== 'disabled') {
			const urlParams = new URLSearchParams();

			if (sslConfig.sslMode === 'required') {
				urlParams.append('oracle.net.ssl_client_authentication', 'false');
				urlParams.append('oracle.net.ssl_version', sslConfig.sslVersion || '1.2');
			}

			if (sslConfig.truststorePath) {
				urlParams.append('javax.net.ssl.trustStore', sslConfig.truststorePath);
				if (sslConfig.truststorePassword) {
					urlParams.append('javax.net.ssl.trustStorePassword', sslConfig.truststorePassword);
				}
			}

			if (sslConfig.keystorePath) {
				urlParams.append('javax.net.ssl.keyStore', sslConfig.keystorePath);
				if (sslConfig.keystorePassword) {
					urlParams.append('javax.net.ssl.keyStorePassword', sslConfig.keystorePassword);
				}
			}

			if (urlParams.toString()) {
				baseUrl += (baseUrl.includes('?') ? '&' : '?') + urlParams.toString();
			}
		}

		return baseUrl;
	}
}
