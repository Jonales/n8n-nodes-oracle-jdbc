import { JdbcConnection } from '../types/JdbcTypes';
import { ErrorHandler } from '../utils/ErrorHandler';

export interface TransactionOptions {
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  timeout?: number;
  savepoints?: boolean;
}

export class TransactionManager {
  private connection: JdbcConnection;
  private inTransaction = false;
  private savepoints: string[] = [];
  private originalAutoCommit?: boolean;

  constructor(connection: JdbcConnection) {
    this.connection = connection;
  }

  async beginTransaction(options: TransactionOptions = {}): Promise<void> {
    try {
      // Salvar estado original do autocommit
      this.originalAutoCommit = await this.connection.connection.getAutoCommit();
      
      // Desabilitar autocommit
      await this.connection.connection.setAutoCommit(false);

      // Configurar nível de isolamento se especificado
      if (options.isolationLevel) {
        const isolationLevel = this.getIsolationLevel(options.isolationLevel);
        await this.connection.connection.setTransactionIsolation(isolationLevel);
      }

      // Configurar timeout se especificado
      if (options.timeout) {
        await this.connection.connection.setNetworkTimeout(null, options.timeout * 1000);
      }

      this.inTransaction = true;
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to begin transaction');
    }
  }

  async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }

    try {
      await this.connection.connection.commit();
      await this.restoreAutoCommit();
      this.inTransaction = false;
      this.savepoints = [];
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to commit transaction');
    }
  }

  async rollback(savepointName?: string): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }

    try {
      if (savepointName) {
        const savepoint = await this.connection.connection.setSavepoint(savepointName);
        await this.connection.connection.rollback(savepoint);
        // Remove savepoints após o especificado
        const index = this.savepoints.indexOf(savepointName);
        if (index >= 0) {
          this.savepoints = this.savepoints.slice(0, index);
        }
      } else {
        await this.connection.connection.rollback();
        await this.restoreAutoCommit();
        this.inTransaction = false;
        this.savepoints = [];
      }
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, 'Failed to rollback transaction');
    }
  }

  async createSavepoint(name: string): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }

    try {
      await this.connection.connection.setSavepoint(name);
      this.savepoints.push(name);
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, `Failed to create savepoint: ${name}`);
    }
  }

  async releaseSavepoint(name: string): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }

    try {
      const savepoint = await this.connection.connection.setSavepoint(name);
      await this.connection.connection.releaseSavepoint(savepoint);
      
      const index = this.savepoints.indexOf(name);
      if (index >= 0) {
        this.savepoints.splice(index, 1);
      }
    } catch (error) {
      throw ErrorHandler.handleJdbcError(error, `Failed to release savepoint: ${name}`);
    }
  }

  isInTransaction(): boolean {
    return this.inTransaction;
  }

  getSavepoints(): string[] {
    return [...this.savepoints];
  }

  private async restoreAutoCommit(): Promise<void> {
    if (this.originalAutoCommit !== undefined) {
      await this.connection.connection.setAutoCommit(this.originalAutoCommit);
    }
  }

  private getIsolationLevel(level: string): any {
    const Connection = java.import('java.sql.Connection');
    
    switch (level) {
      case 'READ_UNCOMMITTED':
        return Connection.TRANSACTION_READ_UNCOMMITTED;
      case 'READ_COMMITTED':
        return Connection.TRANSACTION_READ_COMMITTED;
      case 'REPEATABLE_READ':
        return Connection.TRANSACTION_REPEATABLE_READ;
      case 'SERIALIZABLE':
        return Connection.TRANSACTION_SERIALIZABLE;
      default:
        throw new Error(`Unknown isolation level: ${level}`);
    }
  }
}
