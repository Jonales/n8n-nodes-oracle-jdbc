import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
  NodeConnectionType,
  IDataObject,
} from 'n8n-workflow';

import { JdbcConnectionManager } from './core/JdbcConnectionManager';
import { TransactionManager } from './core/TransactionManager';
import { BatchOperations } from './core/BatchOperations';
import { StoredProcedureExecutor } from './core/StoredProcedureExecutor';
import { OracleJdbcConfig } from './types/JdbcTypes';

export class OracleJdbcAdvanced implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Oracle Database Advanced (JDBC)',
    name: 'oracleJdbcAdvanced',
    icon: 'file:oracle.svg',
    group: ['database'],
    version: 1,
    description: 'Advanced Oracle Database operations: transactions, stored procedures, batch operations',
    defaults: {
      name: 'Oracle Advanced JDBC',
    },
    inputs: ['main' as NodeConnectionType],
    outputs: ['main' as NodeConnectionType],
    credentials: [
      {
        name: 'oracleJdbc',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation Type',
        name: 'operationType',
        type: 'options',
        default: 'transaction',
        options: [
          {
            name: 'Transaction Block',
            value: 'transaction',
            description: 'Execute multiple statements in a transaction',
          },
          {
            name: 'Batch Operations',
            value: 'batch',
            description: 'Execute batch insert/update operations',
          },
          {
            name: 'Stored Procedure',
            value: 'procedure',
            description: 'Call Oracle stored procedures',
          },
          {
            name: 'Connection Pool',
            value: 'pool',
            description: 'Use connection pooling for high performance',
          },
        ],
      },
      {
        displayName: 'SQL Statements',
        name: 'sqlStatements',
        type: 'string',
        typeOptions: {
          alwaysOpenEditWindow: true,
          rows: 15,
        },
        displayOptions: {
          show: {
            operationType: ['transaction'],
          },
        },
        default: 'INSERT INTO table1 VALUES (?, ?);\nUPDATE table2 SET col1 = ? WHERE id = ?;',
        description: 'Multiple SQL statements separated by semicolon',
      },
      {
        displayName: 'Procedure Name',
        name: 'procedureName',
        type: 'string',
        displayOptions: {
          show: {
            operationType: ['procedure'],
          },
        },
        default: '',
        required: true,
        description: 'Name of the stored procedure to execute',
      },
      {
        displayName: 'Pool Size',
        name: 'poolSize',
        type: 'number',
        displayOptions: {
          show: {
            operationType: ['pool'],
          },
        },
        default: 10,
        description: 'Maximum number of connections in pool',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const operationType = this.getNodeParameter('operationType', 0) as string;
    const credentials = await this.getCredentials('oracleJdbc');

    const config: OracleJdbcConfig = {
      host: credentials.host as string,
      port: credentials.port as number,
      connectionType: credentials.connectionType as 'service' | 'sid' | 'tns',
      serviceName: credentials.serviceName as string,
      sid: credentials.sid as string,
      tnsString: credentials.tnsString as string,
      username: credentials.username as string,
      password: credentials.password as string,
      connectionOptions: credentials.connectionOptions as any,
    };

    const manager = JdbcConnectionManager.getInstance();

    try {
      switch (operationType) {
        case 'transaction':
          await this.executeTransaction(manager, config, items, returnData);
          break;
        case 'batch':
          await this.executeBatch(manager, config, items, returnData);
          break;
        case 'procedure':
          await this.executeProcedure(manager, config, items, returnData);
          break;
        case 'pool':
          await this.executeWithPool(manager, config, items, returnData);
          break;
      }
    } catch (error) {
      throw new NodeOperationError(
        this.getNode(),
        `Oracle JDBC Advanced execution failed: ${error.message}`,
        { itemIndex: 0 }
      );
    }

    return [returnData];
  }

  private async executeTransaction(
    manager: JdbcConnectionManager,
    config: OracleJdbcConfig,
    items: INodeExecutionData[],
    returnData: INodeExecutionData[]
  ): Promise<void> {
    const connection = await manager.createConnection(config);
    const transactionManager = new TransactionManager(connection);

    try {
      await transactionManager.beginTransaction();
      
      for (let i = 0; i < items.length; i++) {
        const sqlStatements = this.getNodeParameter('sqlStatements', i) as string;
        const statements = sqlStatements.split(';').filter(sql => sql.trim());
        
        for (const statement of statements) {
          await manager.executeQuery(connection, statement.trim());
        }
      }

      await transactionManager.commit();
      
      returnData.push({
        json: {
          success: true,
          operation: 'transaction',
          statementsExecuted: items.length,
        },
      });
    } catch (error) {
      await transactionManager.rollback();
      throw error;
    } finally {
      await manager.closeConnection(connection);
    }
  }

  private async executeBatch(
    manager: JdbcConnectionManager,
    config: OracleJdbcConfig,
    items: INodeExecutionData[],
    returnData: INodeExecutionData[]
  ): Promise<void> {
    const connection = await manager.createConnection(config);
    const batchOps = new BatchOperations(connection);

    try {
      const data = items.map(item => item.json);
      const result = await batchOps.bulkInsert('target_table', data, {
        batchSize: 1000,
        continueOnError: false,
      });

      returnData.push({
        json: {
          success: true,
          operation: 'batch',
          rowsProcessed: result.rowsProcessed,
          executionTime: result.executionTime,
        },
      });
    } finally {
      await manager.closeConnection(connection);
    }
  }

  private async executeProcedure(
    manager: JdbcConnectionManager,
    config: OracleJdbcConfig,
    items: INodeExecutionData[],
    returnData: INodeExecutionData[]
  ): Promise<void> {
    const connection = await manager.createConnection(config);
    const procExecutor = new StoredProcedureExecutor(connection);

    try {
      for (let i = 0; i < items.length; i++) {
        const procedureName = this.getNodeParameter('procedureName', i) as string;
        const result = await procExecutor.callProcedure(procedureName, []);
        
        returnData.push({
          json: {
            success: true,
            operation: 'procedure',
            procedureName,
            result,
          },
          pairedItem: { item: i },
        });
      }
    } finally {
      await manager.closeConnection(connection);
    }
  }

  private async executeWithPool(
    manager: JdbcConnectionManager,
    config: OracleJdbcConfig,
    items: INodeExecutionData[],
    returnData: INodeExecutionData[]
  ): Promise<void> {
    const poolSize = this.getNodeParameter('poolSize', 0) as number;
    const poolId = await manager.createConnectionPool(config, poolSize);

    try {
      for (let i = 0; i < items.length; i++) {
        const connection = await manager.getPooledConnection(poolId);
        
        try {
          const result = await manager.executeQuery(connection, 'SELECT 1 FROM dual');
          returnData.push({
            json: {
              success: true,
              operation: 'pool',
              poolId,
              result: result.rows[0],
            },
            pairedItem: { item: i },
          });
        } finally {
          await manager.closeConnection(connection);
        }
      }
    } finally {
      await manager.closeConnectionPool(poolId);
    }
  }
}
