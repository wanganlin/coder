import mysql, { type Connection } from 'mysql2/promise';
import { type DatasourceAdapter, type TableFilter } from './types.js';
import {
  type TableSchema,
  type IndexSchema,
  type ForeignKeySchema,
} from '../schema/index.js';
import { filterTables } from './utils.js';
import { toClassName, toPropertyName } from '../schema/naming.js';

export class MySqlAdapter implements DatasourceAdapter {
  private connection: Connection | null = null;
  private databaseName: string = '';

  async connect(connectionString: string): Promise<void> {
    try {
      this.connection = await mysql.createConnection(connectionString);

      // 解析数据库名称
      const [rows] = await this.connection.query<any[]>('SELECT DATABASE() as db');
      this.databaseName = rows[0]?.db || '';
    } catch (err: any) {
      throw new Error(`连接 MySQL 失败: ${err.message}`);
    }
  }

  async getTables(filter?: TableFilter): Promise<string[]> {
    if (!this.connection) throw new Error('数据库未连接');

    try {
      const [rows] = await this.connection.query<any[]>(
        'SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = "BASE TABLE"',
        [this.databaseName],
      );

      const tables = rows.map((r) => r.TABLE_NAME || r.table_name);
      return filterTables(tables, filter);
    } catch (err: any) {
      throw new Error(`获取 MySQL 表列表失败: ${err.message}`);
    }
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    if (!this.connection) throw new Error('数据库未连接');

    try {
      // 1. 获取表注释
      const [tableRows] = await this.connection.query<any[]>(
        'SELECT table_comment FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
        [this.databaseName, tableName],
      );
      const tableComment = tableRows[0]?.TABLE_COMMENT || tableRows[0]?.table_comment || '';

      // 2. 获取列信息
      const [columnRows] = await this.connection.query<any[]>(
        `SELECT 
          column_name, data_type, column_type, is_nullable, column_default, column_comment, extra,
          character_maximum_length, numeric_precision, numeric_scale, column_key
         FROM information_schema.columns 
         WHERE table_schema = ? AND table_name = ? 
         ORDER BY ordinal_position`,
        [this.databaseName, tableName],
      );

      const columns = columnRows.map((r): any => {
        const name = r.COLUMN_NAME || r.column_name;
        const sqlType = r.DATA_TYPE || r.data_type;
        const rawType = r.COLUMN_TYPE || r.column_type;
        const isNullable = (r.IS_NULLABLE || r.is_nullable) === 'YES';
        const defaultValue = r.COLUMN_DEFAULT || r.column_default || undefined;
        const comment = r.COLUMN_COMMENT || r.column_comment || '';
        const extra = r.EXTRA || r.extra || '';
        const columnKey = r.COLUMN_KEY || r.column_key || '';

        const length = r.CHARACTER_MAXIMUM_LENGTH || r.character_maximum_length || undefined;
        const precision = r.NUMERIC_PRECISION || r.numeric_precision || undefined;
        const scale = r.NUMERIC_SCALE || r.numeric_scale || undefined;

        const isPrimaryKey = columnKey === 'PRI';
        const isAutoIncrement = extra.includes('auto_increment');

        return {
          name,
          sqlType,
          rawType,
          length: length ? Number(length) : undefined,
          precision: precision ? Number(precision) : undefined,
          scale: scale ? Number(scale) : undefined,
          nullable: isNullable,
          defaultValue,
          comment,
          isPrimaryKey,
          isAutoIncrement,
        };
      });

      // 3. 获取索引信息
      const [indexRows] = await this.connection.query<any[]>(
        `SELECT index_name, column_name, non_unique 
         FROM information_schema.statistics 
         WHERE table_schema = ? AND table_name = ? 
         ORDER BY index_name, seq_in_index`,
        [this.databaseName, tableName],
      );

      const indexMap = new Map<string, { columns: string[]; unique: boolean }>();
      for (const row of indexRows) {
        const idxName = row.INDEX_NAME || row.index_name;
        const colName = row.COLUMN_NAME || row.column_name;
        const nonUnique = row.NON_UNIQUE || row.non_unique;

        if (!indexMap.has(idxName)) {
          indexMap.set(idxName, {
            columns: [],
            unique: Number(nonUnique) === 0,
          });
        }
        indexMap.get(idxName)!.columns.push(colName);
      }

      const indexes: IndexSchema[] = [];
      for (const [name, val] of indexMap.entries()) {
        // PRI index in MySQL can be skipped or included as is
        indexes.push({
          name,
          columns: val.columns,
          unique: val.unique,
        });
      }

      // 4. 获取外键信息
      const [fkRows] = await this.connection.query<any[]>(
        `SELECT 
          k.constraint_name,
          k.column_name,
          k.referenced_table_name,
          k.referenced_column_name
         FROM information_schema.key_column_usage k
         INNER JOIN information_schema.referential_constraints r
           ON k.constraint_name = r.constraint_name
           AND k.constraint_schema = r.constraint_schema
         WHERE k.table_schema = ? AND k.table_name = ?
         ORDER BY k.constraint_name, k.position_in_unique_constraint`,
        [this.databaseName, tableName],
      );

      const fkMap = new Map<
        string,
        { columns: string[]; refTable: string; refColumns: string[] }
      >();
      for (const row of fkRows) {
        const fkName = row.CONSTRAINT_NAME || row.constraint_name;
        const colName = row.COLUMN_NAME || row.column_name;
        const refTableName = row.REFERENCED_TABLE_NAME || row.referenced_table_name;
        const refColName = row.REFERENCED_COLUMN_NAME || row.referenced_column_name;

        if (!fkMap.has(fkName)) {
          fkMap.set(fkName, {
            columns: [],
            refTable: refTableName,
            refColumns: [],
          });
        }
        const val = fkMap.get(fkName)!;
        val.columns.push(colName);
        val.refColumns.push(refColName);
      }

      const foreignKeys: ForeignKeySchema[] = [];
      for (const [name, val] of fkMap.entries()) {
        foreignKeys.push({
          name,
          columnNames: val.columns,
          referencedTableName: val.refTable,
          referencedColumnNames: val.refColumns,
        });
      }

      // 返回 TableSchema（类型映射等由 runner 中的 processTableSchema 统一完成）
      return {
        name: tableName,
        className: toClassName(tableName),
        comment: tableComment,
        columns: columns.map((c) => ({
          name: c.name,
          propertyName: toPropertyName(c.name, 'java'),
          sqlType: c.sqlType,
          rawType: c.rawType,
          length: c.length,
          precision: c.precision,
          scale: c.scale,
          nullable: c.nullable,
          defaultValue: c.defaultValue,
          comment: c.comment,
          isPrimaryKey: c.isPrimaryKey,
          isAutoIncrement: c.isAutoIncrement,
          javaType: '',
          goType: '',
          pythonType: '',
          phpType: '',
          tsType: '',
        })),
        primaryKey: columns.filter((c) => c.isPrimaryKey).map((c) => c.name),
        indexes,
        foreignKeys,
      };
    } catch (err: any) {
      throw new Error(`读取 MySQL 表 [${tableName}] 结构失败: ${err.message}`);
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }
}
