import { JdbcConnection } from '../types/JdbcTypes';
import { ErrorHandler } from '../utils/ErrorHandler';

export interface BatchOptions {
  batchSize?: number;
  continueOnError?: boolean;
  timeout?: number;
}

export interface BatchResult {
  rowsProcessed: number;
  executionTime: number;
  errors: any[];
}

export class BatchOperations {
  private connection: JdbcConnection;

  constructor(connection: JdbcConnection) {
    this.connection = connection;
  }

  async bulkInsert(
    tableName: string,
    data: any[],
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const { batchSize = 1000, continueOnError = false, timeout = 30 } = options;
    const startTime = Date.now();
    const errors: any[] = [];
    let totalProcessed = 0;

    if (data.length === 0) {
      return { rowsProcessed: 0, executionTime: 0, errors: [] };
    }

    // Gerar SQL INSERT baseado na primeira linha
    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    let statement;
    try {
      statement = await this.connection.connection.prepareStatement(sql);
      
      if (timeout > 0) {
        await statement.setQueryTimeout(timeout);
      }

      // Processar em lotes
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, Math.min(i + batchSize, data.length));
        
        try {
          await this.processBatch(statement, batch, columns);
          totalProcessed += batch.length;
        } catch (error) {
          if (continueOnError) {
            errors.push({ batch: i / batchSize, error: error.message, rows: batch });
          } else {
            throw error;
          }
        }
      }

      return {
        rowsProcessed: totalProcessed,
        executionTime: Date.now() - startTime,
        errors,
      };
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Bulk insert failed');
    } finally {
      if (statement) {
        await statement.close();
      }
    }
  }

  private async processBatch(statement: any, batch: any[], columns: string[]): Promise<void> {
    // Adicionar todos os registros do lote
    for (const row of batch) {
      for (let j = 0; j < columns.length; j++) {
        const value = row[columns[j]];
        await statement.setObject(j + 1, value);
      }
      await statement.addBatch();
    }

    // Executar lote
    await statement.executeBatch();
    await statement.clearBatch();
  }
}
