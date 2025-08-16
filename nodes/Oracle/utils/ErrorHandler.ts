import { NodeOperationError } from 'n8n-workflow';

export class ErrorHandler {
  static handleJdbcError(error: any, context: string): NodeOperationError {
    let message = context;
    let description = 'An unknown error occurred';

    if (error && typeof error === 'object') {
      // Erros Java/JDBC
      if (error.cause && error.cause.getClass) {
        const className = error.cause.getClass().getSimpleName();
        const errorMessage = error.cause.getMessage();
        
        switch (className) {
          case 'SQLException':
            message = `SQL Error: ${errorMessage}`;
            description = 'Check your SQL syntax and database connection';
            break;
          
          case 'SQLSyntaxErrorException':
            message = `SQL Syntax Error: ${errorMessage}`;
            description = 'Review your SQL query for syntax errors';
            break;
          
          case 'SQLTimeoutException':
            message = `Query Timeout: ${errorMessage}`;
            description = 'The query took too long to execute. Consider optimizing it or increasing timeout';
            break;
          
          case 'ConnectException':
            message = `Connection Failed: ${errorMessage}`;
            description = 'Could not connect to Oracle database. Check host, port, and network connectivity';
            break;
          
          default:
            message = `Database Error: ${errorMessage}`;
            description = 'An error occurred while executing the database operation';
        }
      } else if (error.message) {
        message = error.message;
      }
    }

    return new NodeOperationError(
      {} as any, // Node será preenchido pelo chamador
      message,
      { description }
    );
  }

  static isRetryableError(error: any): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const retryableErrors = [
      'Connection reset',
      'Connection timed out',
      'Network is unreachable',
      'Temporary failure',
    ];

    const errorMessage = error.message || error.toString();
    return retryableErrors.some(retryable => 
      errorMessage.toLowerCase().includes(retryable.toLowerCase())
    );
  }
}
