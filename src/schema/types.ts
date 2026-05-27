import { type FieldExtension } from '../config/schema.js';

export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ForeignKeySchema {
  name: string;
  columnNames: string[];
  referencedTableName: string;
  referencedColumnNames: string[];
}

export interface ColumnSchema {
  name: string; // 原始列名 (e.g. user_id)
  propertyName: string; // 目标语言属性名 (e.g. userId, UserId, user_id)
  sqlType: string; // 原始 SQL 类型 (e.g. varchar, bigint, int)
  rawType: string; // 保留数据库特有类型 (e.g. varchar(255), jsonb)
  length?: number; // 字符或数值长度
  precision?: number; // 浮点数精度
  scale?: number; // 浮点数刻度
  nullable: boolean; // 是否可空
  defaultValue?: string; // 默认值
  comment?: string; // 列注释
  isPrimaryKey: boolean; // 是否为主键
  isAutoIncrement: boolean; // 是否自增

  // 映射后的各语言类型
  javaType: string;
  goType: string;
  pythonType: string;
  phpType: string;
  tsType: string;

  // 扩展属性
  extension?: FieldExtension;
}

export interface TableSchema {
  name: string; // 原始表名 (e.g. sys_user)
  className: string; // 目标类名 (e.g. SysUser)
  comment?: string; // 表注释
  columns: ColumnSchema[]; // 所有列
  primaryKey: string[]; // 主键列名列表
  indexes: IndexSchema[]; // 所有索引
  foreignKeys: ForeignKeySchema[]; // 所有外键
}
