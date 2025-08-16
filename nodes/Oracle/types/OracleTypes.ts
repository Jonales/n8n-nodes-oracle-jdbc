export interface OracleSpecificTypes {
  CURSOR: 'CURSOR';
  ROWID: 'ROWID';
  UROWID: 'UROWID';
  XMLTYPE: 'XMLTYPE';
  BFILE: 'BFILE';
}

export interface OracleConnectionProperties {
  'oracle.jdbc.implicitStatementCacheSize'?: string;
  'oracle.jdbc.autoCommitSpecCompliant'?: string;
  'oracle.net.keepAlive'?: string;
  'oracle.net.ssl_client_authentication'?: string;
  'oracle.net.ssl_version'?: string;
  'oracle.jdbc.fanEnabled'?: string;
}

export interface OraclePoolProperties extends OracleConnectionProperties {
  maxStatements?: number;
  fastConnectionFailoverEnabled?: boolean;
  connectionPoolName?: string;
}
