declare module 'java-bridge' {
  export const addClasspath: (path: string) => void;
  export const addClasspaths: (paths: string[]) => void;
  export const classpath: () => (paths: string[]) => any;

  // evitar palavra reservada
  const _import: <T = any>(className: string) => T;
  export { _import as javaImport };

  export const newInstanceSync: <T = any>(className: string, ...args: any[]) => T;
  export const callStaticMethodSync: <T = any>(className: string, methodName: string, ...args: any[]) => T;
  export const ensureJvm: () => Promise<void>;
}
declare module 'java-bridge/types/OracleTypes' {
  export interface OracleTypes {
    // Oracle JDBC driver properties
    'oracle.jdbc.ReadTimeout'?: string;
    'oracle.jdbc.ConnectionTimeout'?: string;
    'oracle.jdbc.ImplicitStatementCacheSize'?: string;
    'oracle.jdbc.ImplicitStatementCacheEnabled'?: string;
    'oracle.jdbc.ImplicitResultSetCacheSize'?: string;
    'oracle.jdbc.ImplicitResultSetCacheEnabled'?: string;

    // UCP properties
    'oracle.ucp.connectionFactoryClassName'?: string;
    'oracle.ucp.initialPoolSize'?: string;
    'oracle.ucp.minPoolSize'?: string;
    'oracle.ucp.maxPoolSize'?: string;
    'oracle.ucp.maxStatementsPerConnection'?: string;
  }; // IGNORE: This is a placeholder for Oracle JDBC properties 
  export interface OracleTypes {
    // UCP connection factory properties
    'oracle.ucp.connectionFactoryProperties'?: string;

    // Custom UCP properties
    maxStatements?: string;
    fastConnectionFailoverEnabled?: string;
    connectionPoolName?: string;
  } // IGNORE: This is a placeholder for custom UCP properties
}