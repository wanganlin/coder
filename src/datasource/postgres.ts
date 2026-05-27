import pg from 'pg';
import { type DatasourceAdapter, type TableFilter } from './types.js';
import {
  type TableSchema,
  type IndexSchema,
  type ForeignKeySchema,
  processTableSchema,
} from '../schema/index.js';
import { filterTables } from './utils.js';

export class PostgreSqlAdapter implements DatasourceAdapter {
  private client: pg.Client | null = null;
  private schemaName: string = 'public';

  async connect(connectionString: string): Promise<void> {
    try {
      this.client = new pg.Client({ connectionString });
      await this.client.connect();

      // 解析 schema (默认使用 public, 或从连接串解析)
      const url = new URL(connectionString);
      const searchParams = url.searchParams;
      this.schemaName = searchParams.get('schema') || 'public';
    } catch (err: any) {
      throw new Error(`连接 PostgreSQL 失败: ${err.message}`);
    }
  }

  async getTables(filter?: TableFilter): Promise<string[]> {
    if (!this.client) throw new Error('数据库未连接');

    try {
      const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      `;
      const res = await this.client.query(query, [this.schemaName]);
      const tables = res.rows.map((r) => r.table_name);

      return filterTables(tables, filter);
    } catch (err: any) {
      throw new Error(`获取 PostgreSQL 表列表失败: ${err.message}`);
    }
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    if (!this.client) throw new Error('数据库未连接');

    try {
      // 1. 获取表注释
      const tableCommentQuery = `
        SELECT obj_description(c.oid, 'pg_class') AS comment
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2
      `;
      const tableCommentRes = await this.client.query(tableCommentQuery, [
        this.schemaName,
        tableName,
      ]);
      const tableComment = tableCommentRes.rows[0]?.comment || '';

      // 2. 获取列的注释
      const columnCommentsQuery = `
        SELECT 
          a.attname AS column_name,
          col_description(c.oid, a.attnum) AS comment
        FROM pg_class c
        JOIN pg_attribute a ON a.attrelid = c.oid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
      `;
      const colCommentsRes = await this.client.query(columnCommentsQuery, [
        this.schemaName,
        tableName,
      ]);
      const commentMap = new Map<string, string>();
      for (const row of colCommentsRes.rows) {
        commentMap.set(row.column_name, row.comment || '');
      }

      // 3. 获取主键约束列
      const pkQuery = `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      `;
      const pkRes = await this.client.query(pkQuery, [this.schemaName, tableName]);
      const primaryKeys = new Set(pkRes.rows.map((r) => r.column_name));

      // 4. 获取列信息
      const columnsQuery = `
        SELECT 
          column_name, data_type, udt_name, is_nullable, column_default, 
          character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = $2 
        ORDER BY ordinal_position
      `;
      const colsRes = await this.client.query(columnsQuery, [this.schemaName, tableName]);

      const columns = colsRes.rows.map((r): any => {
        const name = r.column_name;
        const sqlType = r.data_type;
        const udtName = r.udt_name;
        const rawType = sqlType === 'USER-DEFINED' ? udtName : sqlType;
        const isNullable = r.is_nullable === 'YES';
        const defaultValue = r.column_default || undefined;
        const comment = commentMap.get(name) || '';

        const length = r.character_maximum_length || undefined;
        const precision = r.numeric_precision || undefined;
        const scale = r.numeric_scale || undefined;

        const isPrimaryKey = primaryKeys.has(name);

        // 自动递增判断: PostgreSQL 常用 nextval('...'::regclass) 或 identity 作为自增
        const isAutoIncrement = defaultValue
          ? defaultValue.includes('nextval') || defaultValue.includes('identity')
          : false;

        return {
          name,
          sqlType: udtName || sqlType,
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

      // 5. 获取索引信息
      const indexQuery = `
        SELECT
          i.relname AS index_name,
          a.attname AS column_name,
          ix.indisunique AS unique
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = $1 AND t.relname = $2
        ORDER BY index_name
      `;
      const indexRes = await this.client.query(indexQuery, [this.schemaName, tableName]);

      const indexMap = new Map<string, { columns: string[]; unique: boolean }>();
      for (const row of indexRes.rows) {
        const idxName = row.index_name;
        const colName = row.column_name;
        const isUnique = !!row.unique;

        if (!indexMap.has(idxName)) {
          indexMap.set(idxName, {
            columns: [],
            unique: isUnique,
          });
        }
        indexMap.get(idxName)!.columns.push(colName);
      }

      const indexes: IndexSchema[] = [];
      for (const [name, val] of indexMap.entries()) {
        indexes.push({
          name,
          columns: val.columns,
          unique: val.unique,
        });
      }

      // 6. 获取外键信息
      const fkQuery = `
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS referenced_table_name,
          ccu.column_name AS referenced_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      `;
      const fkRes = await this.client.query(fkQuery, [this.schemaName, tableName]);

      const fkMap = new Map<
        string,
        { columns: string[]; refTable: string; refColumns: string[] }
      >();
      for (const row of fkRes.rows) {
        const fkName = row.constraint_name;
        const colName = row.column_name;
        const refTableName = row.referenced_table_name;
        const refColName = row.referenced_column_name;

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

      const rawTableData = {
        name: tableName,
        comment: tableComment,
        columns,
        indexes,
        foreignKeys,
      };

      // 返回修饰加工后的 TableSchema
      return processTableSchema(rawTableData, 'spring-boot');
    } catch (err: any) {
      throw new Error(`读取 PostgreSQL 表 [${tableName}] 结构失败: ${err.message}`);
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }
}
