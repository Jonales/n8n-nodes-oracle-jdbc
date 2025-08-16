import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class OracleJdbc implements ICredentialType {
  name = 'oracleJdbc';
  displayName = 'Oracle Database (JDBC)';
  documentationUrl = 'https://docs.oracle.com/en/database/oracle/oracle-database/';
  icon = 'file:oracle.svg';
  
  properties: INodeProperties[] = [
    {
      displayName: 'Host',
      name: 'host',
      type: 'string',
      default: 'localhost',
      required: true,
      description: 'Oracle database server hostname or IP address',
    },
    {
      displayName: 'Port',
      name: 'port',
      type: 'number',
      default: 1521,
      required: true,
      description: 'Oracle database port (default: 1521)',
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
          description: 'Connect using Oracle Service Name',
        },
        {
          name: 'SID',
          value: 'sid',
          description: 'Connect using Oracle System Identifier (SID)',
        },
        {
          name: 'TNS',
          value: 'tns',
          description: 'Connect using TNS connection string',
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
      description: 'Oracle service name (e.g., ORCL, XEPDB1)',
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
    },
    {
      displayName: 'TNS Connection String',
      name: 'tnsString',
      type: 'string',
      default: '',
      required: true,
      typeOptions: {
        rows: 4,
      },
      displayOptions: {
        show: {
          connectionType: ['tns'],
        },
      },
      description: 'Complete TNS connection string',
      placeholder: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=myhost)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=myservice)))',
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      required: true,
      description: 'Oracle database username',
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
      displayName: 'Connection Options',
      name: 'connectionOptions',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Connection Timeout (seconds)',
          name: 'connectionTimeout',
          type: 'number',
          default: 30,
          description: 'Connection timeout in seconds',
        },
        {
          displayName: 'Socket Timeout (seconds)',
          name: 'socketTimeout',
          type: 'number',
          default: 60,
          description: 'Socket timeout in seconds',
        },
        {
          displayName: 'SSL Mode',
          name: 'sslMode',
          type: 'options',
          default: 'disabled',
          options: [
            {
              name: 'Disabled',
              value: 'disabled',
            },
            {
              name: 'Required',
              value: 'required',
            },
            {
              name: 'Verify CA',
              value: 'verify-ca',
            },
          ],
        },
        {
          displayName: 'Schema',
          name: 'schema',
          type: 'string',
          default: '',
          description: 'Default schema to use',
        },
      ],
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {},
      body: {},
      qs: {},
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.host}}',
      url: '',
      method: 'GET',
    },
  };
}
