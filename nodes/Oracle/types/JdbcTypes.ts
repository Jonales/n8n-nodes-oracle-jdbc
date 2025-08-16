export interface OracleJdbcConfig {
  host: string;
  port: number;
  connectionType: 'service' | 'sid' | 'tns';
  serviceName?: string;
  sid?: string;
  tnsString?: string;
  username: string;
  password: string;
  connectionOptions?: {
    connectionTimeout?: number;
    socketTimeout?: number;
    sslMode?: 'disabled' | 'required' | 'verify-ca';
    schema?: string;
  };
}

export interface JdbcConnection {
  id: string;
  connection: any; // Java Connection object
  config: OracleJdbcConfig;
  createdAt: Date;
  isActive: boolean;
  isPooled?: boolean;
  poolId?: string;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  executionTime: number;
  metadata?: {
    columns?: ColumnMetadata[];
  };
}

export interface ColumnMetadata {
  name: string;
  type: string;
  size?: number;
  nullable?: boolean;
}

export interface ParameterDefinition {
  value: any;
  type: 'string' | 'number' | 'boolean' | 'date' | 'null';
}
