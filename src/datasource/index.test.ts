import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { filterTables, createDatasourceAdapter, DdlAdapter } from './index.js';

describe('Datasource Adapters (T4)', () => {
  describe('filterTables Utility', () => {
    const tables = ['sys_user', 'sys_role', 'user_order', 'order_detail', 'flyway_history'];

    it('should return all tables when no filter is provided', () => {
      expect(filterTables(tables)).toEqual(tables);
    });

    it('should filter tables by include rules', () => {
      const filter = { include: ['sys_user', 'sys_role'] };
      expect(filterTables(tables, filter)).toEqual(['sys_user', 'sys_role']);
    });

    it('should filter tables by exclude rules', () => {
      const filter = { exclude: ['flyway_history', 'order_detail'] };
      expect(filterTables(tables, filter)).toEqual(['sys_user', 'sys_role', 'user_order']);
    });

    it('should combine include and exclude rules', () => {
      const filter = {
        include: ['sys_user', 'sys_role', 'user_order'],
        exclude: ['sys_role'],
      };
      expect(filterTables(tables, filter)).toEqual(['sys_user', 'user_order']);
    });
  });

  describe('createDatasourceAdapter Factory', () => {
    it('should instantiate the correct adapter', () => {
      const mysqlAdapter = createDatasourceAdapter('mysql');
      expect(mysqlAdapter.constructor.name).toBe('MySqlAdapter');

      const pgAdapter = createDatasourceAdapter('postgresql');
      expect(pgAdapter.constructor.name).toBe('PostgreSqlAdapter');

      const ddlAdapter = createDatasourceAdapter('ddl');
      expect(ddlAdapter.constructor.name).toBe('DdlAdapter');
    });

    it('should throw for unsupported adapter type', () => {
      expect(() => createDatasourceAdapter('unsupported' as any)).toThrow(/不支持的数据源类型/);
    });
  });

  describe('DdlAdapter Parsing', () => {
    const testSqlPath = resolve(process.cwd(), 'test-schema.sql');

    beforeEach(() => {
      if (existsSync(testSqlPath)) {
        unlinkSync(testSqlPath);
      }
    });

    afterEach(() => {
      if (existsSync(testSqlPath)) {
        unlinkSync(testSqlPath);
      }
    });

    it('should parse CREATE TABLE statements from DDL file', async () => {
      const sqlContent = `
        CREATE TABLE sys_user (
          user_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
          username VARCHAR(50) NOT NULL COMMENT '用户名',
          email VARCHAR(100) COMMENT '邮箱',
          status TINYINT(1) DEFAULT 1 COMMENT '状态',
          created_at DATETIME
        ) COMMENT = '系统用户表';

        CREATE TABLE user_order (
          order_id BIGINT PRIMARY KEY,
          user_id BIGINT,
          order_no VARCHAR(64) NOT NULL,
          amount DECIMAL(10,2),
          CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES sys_user(user_id)
        );
      `;
      writeFileSync(testSqlPath, sqlContent, 'utf-8');

      const adapter = new DdlAdapter();
      await adapter.connect(testSqlPath);

      // Verify tables list
      const tables = await adapter.getTables();
      expect(tables).toContain('sys_user');
      expect(tables).toContain('user_order');
      expect(tables.length).toBe(2);

      // Verify sys_user schema
      const userSchema = await adapter.getTableSchema('sys_user');
      expect(userSchema.name).toBe('sys_user');
      expect(userSchema.className).toBe('SysUser');
      expect(userSchema.comment).toBe('系统用户表');
      expect(userSchema.primaryKey).toEqual(['user_id']);
      expect(userSchema.columns.length).toBe(5);

      const userIdCol = userSchema.columns.find((c) => c.name === 'user_id')!;
      expect(userIdCol.isPrimaryKey).toBe(true);
      expect(userIdCol.isAutoIncrement).toBe(true);
      expect(userIdCol.javaType).toBe('Long');
      expect(userIdCol.comment).toBe('用户ID');

      const usernameCol = userSchema.columns.find((c) => c.name === 'username')!;
      expect(usernameCol.nullable).toBe(false);
      expect(usernameCol.javaType).toBe('String');

      const statusCol = userSchema.columns.find((c) => c.name === 'status')!;
      expect(statusCol.javaType).toBe('Boolean'); // tinyint(1) mapped to boolean!

      // Verify user_order schema and foreign key
      const orderSchema = await adapter.getTableSchema('user_order');
      expect(orderSchema.name).toBe('user_order');
      expect(orderSchema.className).toBe('UserOrder');
      expect(orderSchema.columns.length).toBe(4);
      expect(orderSchema.primaryKey).toEqual(['order_id']);
      expect(orderSchema.foreignKeys.length).toBe(1);

      const fk = orderSchema.foreignKeys[0];
      expect(fk.name).toBe('fk_order_user');
      expect(fk.columnNames).toEqual(['user_id']);
      expect(fk.referencedTableName).toBe('sys_user');
      expect(fk.referencedColumnNames).toEqual(['user_id']);
    });
  });
});
