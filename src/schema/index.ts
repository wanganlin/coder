import { toClassName, toPropertyName } from './naming.js';
import { mapSqlType } from './type-mappings.js';
import { type TableSchema, type ColumnSchema, type RelationshipSchema } from './types.js';
import { type FieldExtension } from '../config/schema.js';

export * from './types.js';
export * from './naming.js';
export * from './type-mappings.js';

/**
 * 根据目标框架推导编程语言
 */
export function getLanguageFromFramework(framework: string): string {
  const fw = framework.toLowerCase();
  if (fw.startsWith('spring-boot')) return 'java';
  if (fw.startsWith('gin')) return 'go';
  if (fw.startsWith('fastapi')) return 'python';
  if (fw.startsWith('laravel')) return 'php';
  if (fw.startsWith('nestjs')) return 'typescript';
  return 'java'; // 默认 fallback
}

/**
 * 将原始的数据库表 Schema 结构加工修饰为统一的 Schema 模型，注入语言类型、属性名称和扩展属性。
 *
 * @param rawTable 原始表 Schema (无 className 等字段)
 * @param targetFramework 目标框架 (如 'spring-boot')
 * @param extensions 扩展字段映射表 (来自 CoderConfig)
 */
export function processTableSchema(
  rawTable: any,
  targetFramework: string,
  extensions?: Record<string, Record<string, FieldExtension>>,
): TableSchema {
  const targetLanguage = getLanguageFromFramework(targetFramework);
  const tableName = rawTable.name;

  const processedColumns: ColumnSchema[] = (rawTable.columns || []).map((col: any) => {
    // 1. 获取目标语言的属性名称
    const propertyName = toPropertyName(col.name, targetLanguage);

    // 2. 生成所有语言对应的映射类型
    const rawOrSqlType = col.rawType || col.sqlType;
    const javaType = mapSqlType(rawOrSqlType, 'java');
    const goType = mapSqlType(rawOrSqlType, 'go');
    const pythonType = mapSqlType(rawOrSqlType, 'python');
    const phpType = mapSqlType(rawOrSqlType, 'php');
    const tsType = mapSqlType(rawOrSqlType, 'typescript');

    // 3. 提取并合并扩展属性
    const colExtension = extensions?.[tableName]?.[col.name] || undefined;

    return {
      name: col.name,
      propertyName,
      sqlType: col.sqlType,
      rawType: col.rawType || col.sqlType,
      length: col.length,
      precision: col.precision,
      scale: col.scale,
      nullable: col.nullable !== false, // 默认可空
      defaultValue: col.defaultValue,
      comment: col.comment,
      isPrimaryKey: !!col.isPrimaryKey,
      isAutoIncrement: !!col.isAutoIncrement,
      javaType,
      goType,
      pythonType,
      phpType,
      tsType,
      extension: colExtension,
    };
  });

  // 收集主键列名
  const primaryKey = processedColumns.filter((col) => col.isPrimaryKey).map((col) => col.name);

  return {
    name: tableName,
    className: toClassName(tableName),
    comment: rawTable.comment,
    columns: processedColumns,
    primaryKey,
    indexes: rawTable.indexes || [],
    foreignKeys: rawTable.foreignKeys || [],
    relationships: [],
  };
}

/**
 * 从所有表的 Schema 中自动推导关联关系
 *
 * 遍历所有外键，为每张表生成：
 * - @ManyToOne（当前表持有外键 → 关联目标表）
 * - @OneToMany（其他表持有指向当前表的外键 → 反向关联）
 *
 * @param schemas 所有已处理的 TableSchema 列表（会被原地修改）
 */
export function deriveRelationships(schemas: TableSchema[]): void {
  const schemaMap = new Map<string, TableSchema>();
  for (const schema of schemas) {
    schemaMap.set(schema.name, schema);
  }

  for (const schema of schemas) {
    const relationships: RelationshipSchema[] = [];

    // 1. ManyToOne：当前表的外键 → 关联目标表
    for (const fk of schema.foreignKeys) {
      const target = schemaMap.get(fk.referencedTableName);
      relationships.push({
        type: 'ManyToOne',
        columnNames: fk.columnNames,
        targetTable: fk.referencedTableName,
        targetColumns: fk.referencedColumnNames,
        targetClassName: target ? toClassName(target.name) : toClassName(fk.referencedTableName),
        targetPropertyName: toPropertyName(fk.referencedTableName, 'java'),
      });
    }

    // 2. OneToMany：其他表的外键指向当前表 → 反向关联
    for (const other of schemas) {
      if (other.name === schema.name) continue;
      for (const fk of other.foreignKeys) {
        if (fk.referencedTableName === schema.name) {
          // 找到引用当前表的列名作为 mappedBy
          const mappedByCol =
            other.columns.find(
              (c) => c.name === fk.columnNames[0] && !c.isPrimaryKey,
            )?.propertyName || other.columns[0]?.propertyName || '';

          relationships.push({
            type: 'OneToMany',
            columnNames: [],
            targetTable: other.name,
            targetColumns: fk.columnNames,
            targetClassName: toClassName(other.name),
            targetPropertyName: toPropertyName(other.name, 'java'),
            mappedBy: mappedByCol,
          });
        }
      }
    }

    schema.relationships = relationships;
  }
}
