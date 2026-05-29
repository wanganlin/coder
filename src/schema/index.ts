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
  customTypeMappings?: Record<string, string>,
): TableSchema {
  const targetLanguage = getLanguageFromFramework(targetFramework);
  const tableName = rawTable.name;

  const processedColumns: ColumnSchema[] = (rawTable.columns || []).map((col: any) => {
    // 1. 获取目标语言的属性名称
    const propertyName = toPropertyName(col.name, targetLanguage);

    // 2. 生成所有语言对应的映射类型（用户自定义映射优先级高于内置默认）
    const rawOrSqlType = col.rawType || col.sqlType;
    const javaType = mapSqlType(rawOrSqlType, 'java', customTypeMappings);
    const goType = mapSqlType(rawOrSqlType, 'go', customTypeMappings);
    const pythonType = mapSqlType(rawOrSqlType, 'python', customTypeMappings);
    const phpType = mapSqlType(rawOrSqlType, 'php', customTypeMappings);
    const tsType = mapSqlType(rawOrSqlType, 'typescript', customTypeMappings);

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

  // 提取表级扩展（_junction, _skipJunction 等 _ 前缀的 key）
  const tableExtensions = extensions?.[tableName] || {};
  const tableLevelExt: Record<string, any> = {};
  for (const [k, v] of Object.entries(tableExtensions)) {
    if (k.startsWith('_')) {
      tableLevelExt[k] = v;
    }
  }

  return {
    name: tableName,
    className: toClassName(tableName),
    comment: rawTable.comment,
    columns: processedColumns,
    primaryKey,
    indexes: rawTable.indexes || [],
    foreignKeys: rawTable.foreignKeys || [],
    relationships: [],
    _tableExtensions: Object.keys(tableLevelExt).length > 0 ? tableLevelExt : undefined,
    isJunctionTable: false,
  };
}

/**
 * 检查列名列表中的所有列是否都在该表的某个唯一索引中
 */
function isUniqueIndexColumns(schema: TableSchema, columnNames: string[]): boolean {
  const columnSet = new Set(columnNames);
  const uniqueIndexes = (schema.indexes || []).filter((idx) => idx.unique);
  return uniqueIndexes.some((idx) => {
    const idxSet = new Set(idx.columns);
    return [...columnSet].every((col) => idxSet.has(col));
  });
}

/**
 * 判断表是否为候选中间表（ManyToMany 联结表）
 * 条件：恰好 2 个 FK、所有非 PK 列都是 FK 列（无额外业务字段）
 */
function isCandidateJunction(schema: TableSchema): boolean {
  if (schema.foreignKeys.length !== 2) return false;
  const fkColumns = new Set(schema.foreignKeys.flatMap((fk) => fk.columnNames));
  const pkSet = new Set(schema.primaryKey);
  // 所有非主键列都应该是外键列
  for (const col of schema.columns) {
    if (pkSet.has(col.name)) continue;
    if (!fkColumns.has(col.name)) return false;
  }
  return true;
}

/**
 * 从所有表的 Schema 中自动推导关联关系
 *
 * 遍历所有外键，为每张表生成：
 * - ManyToOne / OneToOne（当前表持有外键 → 关联目标表）
 * - OneToMany（其他表持有指向当前表的外键 → 反向关联）
 * - ManyToMany（通过中间表联结两端表）
 *
 * 支持通过 extensions 配置覆盖：
 *   _junction: { leftTable, rightTable, leftColumn, rightColumn } 显式声明中间表
 *   _skipJunction: true  排除误判的中间表
 *
 * @param schemas 所有已处理的 TableSchema 列表（会被原地修改）
 */
export function deriveRelationships(schemas: TableSchema[], targetFramework: string): void {
  const targetLanguage = getLanguageFromFramework(targetFramework);
  const schemaMap = new Map<string, TableSchema>();
  for (const schema of schemas) {
    schemaMap.set(schema.name, schema);
  }

  // 收集显式声明的联结表配置
  const explicitJunctions = new Map<string, { left: string; right: string; leftCol: string; rightCol: string }>();
  const skipJunctions = new Set<string>();

  for (const schema of schemas) {
    const ext = schema._tableExtensions;
    if (!ext) continue;
    if (ext._skipJunction) {
      skipJunctions.add(schema.name);
    }
    if (ext._junction) {
      const j = ext._junction;
      explicitJunctions.set(schema.name, {
        left: j.leftTable,
        right: j.rightTable,
        leftCol: j.leftColumn,
        rightCol: j.rightColumn,
      });
    }
  }

  // 检测 ManyToMany 联结表
  // 优先使用显式配置，其次使用自动检测
  const junctionTables = new Map<
    string,
    { left: string; right: string; leftCol: string; rightCol: string }
  >();

  for (const schema of schemas) {
    if (skipJunctions.has(schema.name)) continue;

    if (explicitJunctions.has(schema.name)) {
      junctionTables.set(schema.name, explicitJunctions.get(schema.name)!);
      schema.isJunctionTable = true;
    } else if (isCandidateJunction(schema)) {
      const fks = schema.foreignKeys;
      junctionTables.set(schema.name, {
        left: fks[0].referencedTableName,
        right: fks[1].referencedTableName,
        leftCol: fks[0].columnNames[0],
        rightCol: fks[1].columnNames[0],
      });
      schema.isJunctionTable = true;
    }
  }

  for (const schema of schemas) {
    const relationships: RelationshipSchema[] = [];

    // 1. ManyToOne / OneToOne：当前表的外键 → 关联目标表
    for (const fk of schema.foreignKeys) {
      const target = schemaMap.get(fk.referencedTableName);
      const isUnique = isUniqueIndexColumns(schema, fk.columnNames);

      relationships.push({
        type: isUnique ? 'OneToOne' : 'ManyToOne',
        columnNames: fk.columnNames,
        targetTable: fk.referencedTableName,
        targetColumns: fk.referencedColumnNames,
        targetClassName: target ? toClassName(target.name) : toClassName(fk.referencedTableName),
        targetPropertyName: toPropertyName(fk.referencedTableName, targetLanguage),
      });
    }

    // 2. OneToMany：其他表的外键指向当前表 → 反向关联
    for (const other of schemas) {
      if (other.name === schema.name) continue;
      for (const fk of other.foreignKeys) {
        if (fk.referencedTableName === schema.name) {
          const otherFkCol = other.columns.find(
            (c) => c.name === fk.columnNames[0] && !c.isPrimaryKey,
          );
          const mappedByCol = otherFkCol?.propertyName || other.columns[0]?.propertyName || '';

          relationships.push({
            type: 'OneToMany',
            columnNames: [],
            targetTable: other.name,
            targetColumns: fk.columnNames,
            targetClassName: toClassName(other.name),
            targetPropertyName: toPropertyName(other.name, targetLanguage),
            mappedBy: mappedByCol,
          });
        }
      }
    }

    // 3. ManyToMany：通过联结表关联
    for (const [junctionName, jConfig] of junctionTables) {
      if (jConfig.left === schema.name) {
        const rightSchema = schemaMap.get(jConfig.right);
        relationships.push({
          type: 'ManyToMany',
          columnNames: [jConfig.leftCol],
          targetTable: jConfig.right,
          targetColumns: [jConfig.rightCol],
          targetClassName: rightSchema ? toClassName(rightSchema.name) : toClassName(jConfig.right),
          targetPropertyName: toPropertyName(jConfig.right, targetLanguage),
          mappedBy: junctionName,
        });
      } else if (jConfig.right === schema.name) {
        const leftSchema = schemaMap.get(jConfig.left);
        relationships.push({
          type: 'ManyToMany',
          columnNames: [jConfig.rightCol],
          targetTable: jConfig.left,
          targetColumns: [jConfig.leftCol],
          targetClassName: leftSchema ? toClassName(leftSchema.name) : toClassName(jConfig.left),
          targetPropertyName: toPropertyName(jConfig.left, targetLanguage),
          mappedBy: junctionName,
        });
      }
    }

    schema.relationships = relationships;
  }
}
