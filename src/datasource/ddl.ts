import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import NodeSqlParser from 'node-sql-parser';
import { type DatasourceAdapter, type TableFilter } from './types.js';
import {
  type TableSchema,
  type IndexSchema,
  type ForeignKeySchema,
  processTableSchema,
} from '../schema/index.js';
import { filterTables } from './utils.js';

interface RawDdlTable {
  name: string;
  comment?: string;
  columns: any[];
  indexes: IndexSchema[];
  foreignKeys: ForeignKeySchema[];
}

export class DdlAdapter implements DatasourceAdapter {
  private tablesMap = new Map<string, RawDdlTable>();
  private parser = new NodeSqlParser.Parser();

  async connect(connectionString: string): Promise<void> {
    const filePath = resolve(process.cwd(), connectionString);
    if (!existsSync(filePath)) {
      throw new Error(`DDL 文件不存在: ${filePath}`);
    }

    try {
      const sqlContent = readFileSync(filePath, 'utf-8');
      this.parseDdl(sqlContent);
    } catch (err: any) {
      throw new Error(`解析 DDL 文件失败: ${err.message}`);
    }
  }

  async getTables(filter?: TableFilter): Promise<string[]> {
    const tableNames = Array.from(this.tablesMap.keys());
    return filterTables(tableNames, filter);
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    const rawTable = this.tablesMap.get(tableName);
    if (!rawTable) {
      throw new Error(`未在 DDL 文件中找到表: ${tableName}`);
    }

    // 将 rawTable 传递给统一的 processTableSchema 加工修饰
    return processTableSchema(rawTable, 'spring-boot');
  }

  async close(): Promise<void> {
    // DDL 适配器无需连接关闭
  }

  /**
   * 解析 DDL 文本
   */
  private parseDdl(sql: string): void {
    // 1. 将 SQL 以分号拆分为多个独立语句
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      // 仅处理 CREATE TABLE 语句
      if (!/^create\s+table/i.test(statement)) {
        continue;
      }

      try {
        // 使用 node-sql-parser 尝试解析
        const astList = this.parser.astify(statement);
        const ast = Array.isArray(astList) ? astList[0] : astList;

        if (ast && ast.type === 'create' && ast.keyword === 'table') {
          const tableName = ast.table[0].table;
          const createDefinitions = ast.create_definitions || [];

          const columns: any[] = [];
          const indexes: IndexSchema[] = [];
          const foreignKeys: ForeignKeySchema[] = [];
          const primaryKeyColumns: string[] = [];

          for (const def of createDefinitions) {
            // A. 处理列定义
            if (def.resource === 'column') {
              const colName = def.column.column;
              const dataType = def.definition.dataType;
              const suffix = def.definition.suffix || [];
              const comment = def.comment?.value?.value || '';

              const isPrimaryKey =
                suffix.includes('PRIMARY') ||
                suffix.includes('KEY') ||
                def.primary_key === 'primary key';
              const isAutoIncrement =
                suffix.includes('AUTO_INCREMENT') ||
                suffix.includes('auto_increment') ||
                def.auto_increment === 'auto_increment' ||
                statement.toLowerCase().includes(`${colName.toLowerCase()} serial`);

              if (isPrimaryKey) {
                primaryKeyColumns.push(colName);
              }

              // 查找长度与精度
              let length: number | undefined;
              let precision: number | undefined;
              let scale: number | undefined;

              if (def.definition.length !== undefined) {
                length = Number(def.definition.length);
              }

              let nullable = true;
              if (def.nullable) {
                nullable = def.nullable.value !== 'not null' && def.nullable.type !== 'not null';
              } else {
                nullable = !suffix.includes('NOT');
              }

              columns.push({
                name: colName,
                sqlType: dataType,
                rawType: dataType + (length ? `(${length})` : ''),
                nullable,
                defaultValue: undefined, // DDL parse results can omit this for simplicity
                comment,
                isPrimaryKey,
                isAutoIncrement,
                length,
                precision,
                scale,
              });
            }
            // B. 处理主键约束
            else if (def.constraint_type?.toLowerCase() === 'primary key') {
              const keys = (def.definition || []).map((k: any) => k.column || k);
              primaryKeyColumns.push(...keys);
            }
            // C. 处理外键约束
            else if (def.constraint_type?.toLowerCase() === 'foreign key') {
              const localCols = (def.definition || []).map((k: any) => k.column || k);
              const refTable = def.reference_definition.table[0].table;
              const refCols = (def.reference_definition.definition || []).map(
                (k: any) => k.column || k,
              );
              foreignKeys.push({
                name: def.constraint || `fk_${tableName}_${refTable}`,
                columnNames: localCols,
                referencedTableName: refTable,
                referencedColumnNames: refCols,
              });
            }
          }

          // 将之前收尾发现的主键标志更新到 columns
          for (const col of columns) {
            if (primaryKeyColumns.includes(col.name)) {
              col.isPrimaryKey = true;
            }
          }

          // 提取表注释（如果有）
          let tableComment: string | undefined;
          const commentMatch = statement.match(/comment\s*=\s*['"](.*?)['"]/i);
          if (commentMatch) {
            tableComment = commentMatch[1];
          }

          this.tablesMap.set(tableName, {
            name: tableName,
            comment: tableComment,
            columns,
            indexes,
            foreignKeys,
          });
          continue; // 成功解析该语句
        }
      } catch {
        // 解析 AST 失败时降级到正则表达式兜底
      }

      // 2. 正则兜底解析
      this.parseDdlWithRegex(statement);
    }
  }

  /**
   * 使用正则表达式解析单条 CREATE TABLE 语句
   */
  private parseDdlWithRegex(statement: string): void {
    const createTableRegex =
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:[`"']?(\w+)[`"']?\.)?[`"']?(\w+)[`"']?\s*\(([\s\S]*)\)(?:\s*comment\s*=\s*['"](.*?)['"])?/i;
    const match = statement.match(createTableRegex);
    if (!match) return;

    const tableName = match[2];
    const columnDefinitionsStr = match[3];
    const tableComment = match[4] || '';

    const columns: any[] = [];
    const primaryKeyColumns: string[] = [];
    const foreignKeys: ForeignKeySchema[] = [];

    // 按行/逗号拆分字段定义
    const lines = this.splitColumnDefinitions(columnDefinitionsStr);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // A. 主键约束: PRIMARY KEY (col1, col2)
      if (/^primary\s+key\s*\((.*?)\)/i.test(trimmed)) {
        const pkMatch = trimmed.match(/^primary\s+key\s*\((.*?)\)/i);
        if (pkMatch) {
          const keys = pkMatch[1].split(',').map((k) => k.replace(/[`"']/g, '').trim());
          primaryKeyColumns.push(...keys);
        }
        continue;
      }

      // B. 外键约束: CONSTRAINT fk_name FOREIGN KEY (col) REFERENCES ref_table(ref_col)
      if (/foreign\s+key/i.test(trimmed)) {
        const fkMatch = trimmed.match(
          /(?:constraint\s+[`"']?(\w+)[`"']?\s+)?foreign\s+key\s*\((.*?)\)\s*references\s+[`"']?(\w+)[`"']?\s*\((.*?)\)/i,
        );
        if (fkMatch) {
          const constraintName = fkMatch[1] || `fk_${tableName}_${fkMatch[3]}`;
          const localCols = fkMatch[2].split(',').map((c) => c.replace(/[`"']/g, '').trim());
          const refTable = fkMatch[3];
          const refCols = fkMatch[4].split(',').map((c) => c.replace(/[`"']/g, '').trim());

          foreignKeys.push({
            name: constraintName,
            columnNames: localCols,
            referencedTableName: refTable,
            referencedColumnNames: refCols,
          });
        }
        continue;
      }

      // C. 普通列定义: col_name data_type [attributes] [comment '...']
      const colMatch = trimmed.match(/^[`"']?(\w+)[`"']?\s+(\w+)(?:\((.*?)\))?([\s\S]*)$/i);
      if (colMatch) {
        const colName = colMatch[1];
        const sqlType = colMatch[2];
        const typeLengthStr = colMatch[3];
        const attributes = colMatch[4] || '';

        const isPrimaryKey = /primary\s+key/i.test(attributes);
        const isAutoIncrement = /auto_increment|serial/i.test(attributes);
        const nullable = !/not\s+null/i.test(attributes);

        let comment = '';
        const commentMatch = attributes.match(/comment\s+['"](.*?)['"]/i);
        if (commentMatch) {
          comment = commentMatch[1];
        }

        if (isPrimaryKey) {
          primaryKeyColumns.push(colName);
        }

        let length: number | undefined;
        if (typeLengthStr) {
          const parsedLen = parseInt(typeLengthStr.split(',')[0], 10);
          if (!isNaN(parsedLen)) length = parsedLen;
        }

        columns.push({
          name: colName,
          sqlType,
          rawType: sqlType + (typeLengthStr ? `(${typeLengthStr})` : ''),
          nullable,
          comment,
          isPrimaryKey,
          isAutoIncrement,
          length,
        });
      }
    }

    // 标志主键
    for (const col of columns) {
      if (primaryKeyColumns.includes(col.name)) {
        col.isPrimaryKey = true;
      }
    }

    this.tablesMap.set(tableName, {
      name: tableName,
      comment: tableComment,
      columns,
      indexes: [],
      foreignKeys,
    });
  }

  /**
   * 辅助拆分列定义串 (处理复杂的括号和逗号)
   */
  private splitColumnDefinitions(str: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;

      if (char === ',' && depth === 0) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    if (current) result.push(current);

    return result;
  }
}
