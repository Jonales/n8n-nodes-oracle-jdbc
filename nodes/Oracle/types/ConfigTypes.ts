export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database?: string;
  schema?: string;
  options?: { [key: string]: any };
}

export interface SSLConfiguration {
  enabled: boolean;
  mode: 'disable' | 'require' | 'verify-ca' | 'verify-full';
  ca?: string;
  cert?: string;
  key?: string;
  passphrase?: string;
}

export interface ConnectionTimeouts {
  connection?: number;
  socket?: number;
  query?: number;
}
