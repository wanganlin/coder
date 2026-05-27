import { type TableSchema } from '../schema/index.js';

export interface TableFilter {
  include?: string[];
  exclude?: string[];
}

export interface DatasourceAdapter {
  /**
   * 连接到数据源
   * @param connectionString 数据库连接串，或 DDL 文件路径
   */
  connect(connectionString: string): Promise<void>;

  /**
   * 获取数据库中的所有表名 (支持过滤)
   */
  getTables(filter?: TableFilter): Promise<string[]>;

  /**
   * 获取指定表的元数据 Schema 结构
   */
  getTableSchema(tableName: string): Promise<TableSchema>;

  /**
   * 关闭数据源连接
   */
  close(): Promise<void>;
}
