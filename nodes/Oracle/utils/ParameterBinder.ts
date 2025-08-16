import { IDataObject } from 'n8n-workflow';
import { ParameterDefinition } from '../types/JdbcTypes';

export class ParameterBinder {
  static processParameters(
    parameters: ParameterDefinition[],
    inputData: IDataObject
  ): any[] {
    if (!parameters || parameters.length === 0) {
      return [];
    }

    return parameters.map((param) => {
      let value = param.value;

      // Resolver expressões do n8n se necessário
      if (typeof value === 'string' && value.includes('{{')) {
        // Substituir variáveis do item atual
        value = this.resolveExpressions(value, inputData);
      }

      return this.convertToJavaType(value, param.type);
    });
  }

  private static resolveExpressions(value: string, data: IDataObject): any {
    // Substituir {{$json.field}} por valores reais
    return value.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      try {
        // Expressão simples $json.field
        if (expression.startsWith('$json.')) {
          const field = expression.substring(6);
          return data[field] || '';
        }
        return match;
      } catch {
        return match;
      }
    });
  }

  private static convertToJavaType(value: any, type: string): any {
    switch (type) {
      case 'string':
        return value ? String(value) : null;
      
      case 'number':
        return value !== null && value !== undefined ? Number(value) : null;
      
      case 'boolean':
        return value !== null && value !== undefined ? Boolean(value) : null;
      
      case 'date':
        if (value) {
          const date = new Date(value);
          return isNaN(date.getTime()) ? null : date;
        }
        return null;
      
      case 'null':
        return null;
      
      default:
        return value;
    }
  }
}
