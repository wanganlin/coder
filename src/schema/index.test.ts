import { describe, it, expect } from 'vitest';
import {
  getLanguageFromFramework,
  toClassName,
  toPropertyName,
  toFileName,
  mapSqlType,
  processTableSchema,
} from './index.js';

describe('Schema Model System (T3)', () => {
  describe('Framework to Language Mapping', () => {
    it('should map frameworks to correct languages', () => {
      expect(getLanguageFromFramework('spring-boot')).toBe('java');
      expect(getLanguageFromFramework('gin')).toBe('go');
      expect(getLanguageFromFramework('fastapi')).toBe('python');
      expect(getLanguageFromFramework('laravel')).toBe('php');
      expect(getLanguageFromFramework('nestjs')).toBe('typescript');
      expect(getLanguageFromFramework('unknown-framework')).toBe('java'); // Fallback
    });
  });

  describe('Casing and Naming Conventions', () => {
    it('should convert table name to class name (PascalCase)', () => {
      expect(toClassName('sys_user')).toBe('SysUser');
      expect(toClassName('user_order_detail')).toBe('UserOrderDetail');
      expect(toClassName('user')).toBe('User');
    });

    it('should convert column name to property name by language', () => {
      // Java, TS, PHP use camelCase
      expect(toPropertyName('created_at', 'java')).toBe('createdAt');
      expect(toPropertyName('created_at', 'typescript')).toBe('createdAt');
      expect(toPropertyName('created_at', 'php')).toBe('createdAt');

      // Go uses PascalCase
      expect(toPropertyName('created_at', 'go')).toBe('CreatedAt');

      // Python uses snake_case
      expect(toPropertyName('created_at', 'python')).toBe('created_at');
    });

    it('should format file name by language and component type', () => {
      // Java: PascalCase + type, suffix .java
      expect(toFileName('sys_user', 'java')).toBe('SysUser.java');
      expect(toFileName('sys_user', 'java', 'Repository')).toBe('SysUserRepository.java');

      // Go: snake_case + type, suffix .go
      expect(toFileName('sys_user', 'go')).toBe('sys_user.go');
      expect(toFileName('sys_user', 'go', 'handler')).toBe('sys_user_handler.go');

      // Python: snake_case + type, suffix .py
      expect(toFileName('sys_user', 'python')).toBe('sys_user.py');
      expect(toFileName('sys_user', 'python', 'controller')).toBe('sys_user_controller.py');

      // PHP: PascalCase + type, suffix .php
      expect(toFileName('sys_user', 'php')).toBe('SysUser.php');
      expect(toFileName('sys_user', 'php', 'Controller')).toBe('SysUserController.php');

      // TS: kebab-case + type, suffix .ts
      expect(toFileName('sys_user', 'typescript')).toBe('sys-user.ts');
      expect(toFileName('sys_user', 'typescript', 'entity')).toBe('sys-user.entity.ts');
    });
  });

  describe('SQL to Language Type Mapping', () => {
    it('should map standard SQL types to Java types', () => {
      expect(mapSqlType('varchar(255)', 'java')).toBe('String');
      expect(mapSqlType('bigint', 'java')).toBe('Long');
      expect(mapSqlType('int', 'java')).toBe('Integer');
      expect(mapSqlType('decimal(10,2)', 'java')).toBe('BigDecimal');
      expect(mapSqlType('datetime', 'java')).toBe('LocalDateTime');
      expect(mapSqlType('tinyint(1)', 'java')).toBe('Boolean'); // MYSQL boolean
    });

    it('should map standard SQL types to Go types', () => {
      expect(mapSqlType('varchar(255)', 'go')).toBe('string');
      expect(mapSqlType('bigint', 'go')).toBe('int64');
      expect(mapSqlType('int', 'go')).toBe('int');
      expect(mapSqlType('decimal(10,2)', 'go')).toBe('float64');
      expect(mapSqlType('datetime', 'go')).toBe('time.Time');
      expect(mapSqlType('tinyint(1)', 'go')).toBe('bool');
    });

    it('should support custom type mappings override', () => {
      const custom = {
        decimal: 'string', // map decimal to string for front-end safety
        json: 'MyCustomType',
      };
      expect(mapSqlType('decimal(10,2)', 'java', custom)).toBe('string');
      expect(mapSqlType('json', 'java', custom)).toBe('MyCustomType');
    });
  });

  describe('Table Schema Decorating and Extension Merging', () => {
    it('should decorate raw tables and merge extensions correctly', () => {
      const rawTable = {
        name: 'sys_user',
        comment: '系统用户表',
        columns: [
          {
            name: 'user_id',
            sqlType: 'bigint',
            isPrimaryKey: true,
            isAutoIncrement: true,
            comment: '主键ID',
          },
          {
            name: 'username',
            sqlType: 'varchar(50)',
            nullable: false,
            comment: '用户名',
          },
          {
            name: 'status',
            sqlType: 'tinyint',
            comment: '状态',
          },
        ],
        indexes: [
          {
            name: 'idx_username',
            columns: ['username'],
            unique: true,
          },
        ],
      };

      const extensions = {
        sys_user: {
          status: {
            enum: ['ACTIVE', 'INACTIVE'],
            frontendWidget: 'select',
          },
        },
      };

      const tableSchema = processTableSchema(rawTable, 'spring-boot', extensions);

      expect(tableSchema.className).toBe('SysUser');
      expect(tableSchema.comment).toBe('系统用户表');
      expect(tableSchema.primaryKey).toEqual(['user_id']);
      expect(tableSchema.columns.length).toBe(3);

      const userIdCol = tableSchema.columns.find((c) => c.name === 'user_id')!;
      expect(userIdCol.propertyName).toBe('userId');
      expect(userIdCol.javaType).toBe('Long');
      expect(userIdCol.goType).toBe('int64');
      expect(userIdCol.isPrimaryKey).toBe(true);
      expect(userIdCol.isAutoIncrement).toBe(true);

      const statusCol = tableSchema.columns.find((c) => c.name === 'status')!;
      expect(statusCol.propertyName).toBe('status');
      expect(statusCol.javaType).toBe('Integer');
      expect(statusCol.extension).toBeDefined();
      expect(statusCol.extension?.enum).toEqual(['ACTIVE', 'INACTIVE']);
      expect(statusCol.extension?.frontendWidget).toBe('select');
    });
  });
});
