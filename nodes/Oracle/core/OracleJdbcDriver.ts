import { java } from 'java';
import { OracleJdbcConfig } from '../types/JdbcTypes';
import { ErrorHandler } from '../utils/ErrorHandler';

export class OracleJdbcDriver {
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Adicionar JARs ao classpath
      java.classpath.push('./lib/ojdbc11.jar');
      java.classpath.push('./lib/ucp.jar');
      java.classpath.push('./lib/orai18n.jar');

      // Registrar driver Oracle
      java.import('oracle.jdbc.OracleDriver');
      
      // Configurar propriedades globais
      const systemProperties = java.import('java.lang.System');
      await systemProperties.setProperty('oracle.jdbc.fanEnabled', 'false');
      await systemProperties.setProperty('oracle.net.keepAlive', 'true');

      this.initialized = true;
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to initialize Oracle JDBC driver');
    }
  }

  static buildConnectionString(config: OracleJdbcConfig): string {
    let baseUrl: string;

    switch (config.connectionType) {
      case 'service':
        baseUrl = `jdbc:oracle:thin:@${config.host}:${config.port}/${config.serviceName}`;
        break;
      case 'sid':
        baseUrl = `jdbc:oracle:thin:@${config.host}:${config.port}:${config.sid}`;
        break;
      case 'tns':
        baseUrl = `jdbc:oracle:thin:@${config.tnsString}`;
        break;
      default:
        throw new Error(`Unsupported connection type: ${config.connectionType}`);
    }

    // Adicionar parâmetros SSL se configurado
    if (config.connectionOptions?.sslMode === 'required') {
      baseUrl += '?oracle.net.ssl_client_authentication=false';
      baseUrl += '&oracle.net.ssl_version=1.2';
    }

    return baseUrl;
  }

  static async testConnection(config: OracleJdbcConfig): Promise<boolean> {
    await this.initialize();
    
    try {
      const connectionUrl = this.buildConnectionString(config);
      const driverManager = java.import('java.sql.DriverManager');
      
      const connection = await driverManager.getConnection(
        connectionUrl,
        config.username,
        config.password
      );

      // Testar conexão simples
      const statement = await connection.createStatement();
      const resultSet = await statement.executeQuery('SELECT 1 FROM dual');
      const hasResult = await resultSet.next();
      
      await resultSet.close();
      await statement.close();
      await connection.close();

      return hasResult;
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Connection test failed');
    }
  }
}
