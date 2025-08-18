import * as java from 'java-bridge';
import { OracleJdbcConfig } from '../types/JdbcTypes';
import { ErrorContext, ErrorHandler } from '../utils/ErrorHandler';

export class OracleJdbcDriver {
  private static initialized = false;
  
  static async initialize(options: DriverInitializationOptions = {}): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Ensure JVM is running
      await java.ensureJvm();
      
      // Add Oracle JDBC JARs to classpath
      await this.addJarsToClasspath();
      
      // Import and register Oracle JDBC driver
      await this.registerOracleDriver();
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Oracle JDBC driver: ${error.message}`);
    }
  }

  private static async addJarsToClasspath(): Promise<void> {
    const jars = [
      './lib/ojdbc11.jar',
      './lib/ucp.jar', 
      './lib/orai18n.jar',
      './lib/ons.jar'
    ];

    try {
      java.addClasspaths(jars);
    } catch (error) {
      console.warn('Some JAR files could not be added to classpath:', error.message);
    }
  }

  private static async registerOracleDriver(): Promise<void> {
    try {
      const OracleDriver = java.import('oracle.jdbc.OracleDriver');
      const DriverManager = java.import('java.sql.DriverManager');
      
      const driverInstance = java.newInstanceSync('oracle.jdbc.OracleDriver');
      await DriverManager.registerDriver(driverInstance);
    } catch (error) {
      throw new Error(`Failed to register Oracle JDBC driver: ${error.message}`);
    }
  }

  static async testConnection(config: OracleJdbcConfig): Promise<ConnectionTestResult> {
    await this.initialize();
    
    const startTime = Date.now();
    try {
      const connectionUrl = this.buildConnectionString(config);
      const DriverManager = java.import('java.sql.DriverManager');
      
      const connection = await DriverManager.getConnection(
        connectionUrl,
        config.username,
        config.password
      );

      // Test basic query
      const statement = await connection.createStatement();
      const resultSet = await statement.executeQuery('SELECT 1 FROM dual');
      const hasResult = await resultSet.next();
      
      await resultSet.close();
      await statement.close();
      await connection.close();

      return {
        isSuccessful: hasResult,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        isSuccessful: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }
}
