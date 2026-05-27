import { type DatasourceAdapter } from './types.js';
import { MySqlAdapter } from './mysql.js';
import { PostgreSqlAdapter } from './postgres.js';
import { DdlAdapter } from './ddl.js';

export * from './types.js';
export * from './utils.js';
export * from './mysql.js';
export * from './postgres.js';
export * from './ddl.js';

/**
 * 根据数据源类型创建对应的数据源适配器实例
 */
export function createDatasourceAdapter(type: 'mysql' | 'postgresql' | 'ddl'): DatasourceAdapter {
  switch (type) {
    case 'mysql':
      return new MySqlAdapter();
    case 'postgresql':
      return new PostgreSqlAdapter();
    case 'ddl':
      return new DdlAdapter();
    default:
      throw new Error(`不支持的数据源类型: ${type}`);
  }
}
