import { describe, it, expect } from 'vitest';
import { TemplateEngine } from './index.js';
import { type CoderConfig } from '../config/index.js';
import { type TableSchema } from '../schema/index.js';

describe('Go (Gin 1.12 + GORM 2.x) Templates Integration (T8)', () => {
  const ginPluginDir = './templates/gin';

  it('should successfully load gin plugin', () => {
    const engine = new TemplateEngine();
    expect(() => engine.loadPlugin(ginPluginDir)).not.toThrow();

    const metadata = engine.getPluginMetadata();
    expect(metadata.name).toBe('gin');
    expect(metadata.language).toBe('go');
    expect(metadata.skeleton?.length).toBe(7);
    expect(metadata.entityTemplates?.length).toBe(4);
  });

  it('should render gin skeleton files', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(ginPluginDir);

    const config: CoderConfig = {
      datasource: { type: 'mysql', url: 'mysql://root@localhost:3306/db' },
      target: {
        framework: 'gin',
        output: './out-go',
        package: 'github.com/coder/myapp',
      },
      tables: { include: [], exclude: [] },
      features: { swagger: true, unitTest: true, pagination: true, auditFields: true },
      extensions: {},
    };

    const tables: TableSchema[] = [
      {
        name: 'sys_user',
        className: 'SysUser',
        primaryKey: ['user_id'],
        indexes: [],
        foreignKeys: [],
        columns: [],
      },
    ];

    const outputs = engine.renderSkeleton(config, tables);
    expect(outputs.length).toBe(7);

    const goModFile = outputs.find((o) => o.outputPath === 'go.mod')!;
    expect(goModFile).toBeDefined();
    expect(goModFile.content).toContain('module github.com/coder/myapp');
    expect(goModFile.content).toContain('github.com/gin-gonic/gin v1.10.0');

    const dbFile = outputs.find((o) => o.outputPath === 'db/db.go')!;
    expect(dbFile).toBeDefined();
    expect(dbFile.content).toContain('package db');
    expect(dbFile.content).toContain('gorm.Open(mysql.Open(dsn)');

    const mainFile = outputs.find((o) => o.outputPath === 'main.go')!;
    expect(mainFile).toBeDefined();
    expect(mainFile.content).toContain('package main');
    expect(mainFile.content).toContain('github.com/coder/myapp/db');

    const routerFile = outputs.find((o) => o.outputPath === 'router.go')!;
    expect(routerFile).toBeDefined();
    expect(routerFile.content).toContain('github.com/coder/myapp/handler');
    expect(routerFile.content).toContain('handler.RegisterSysUserRoutes(api)');
  });

  it('should render gin entity layers for sys_user', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(ginPluginDir);

    const config: CoderConfig = {
      datasource: { type: 'mysql', url: 'mysql://root@localhost:3306/db' },
      target: {
        framework: 'gin',
        output: './out-go',
        package: 'github.com/coder/myapp',
      },
      tables: { include: [], exclude: [] },
      features: { swagger: true, unitTest: true, pagination: true, auditFields: true },
      extensions: {},
    };

    const table: TableSchema = {
      name: 'sys_user',
      className: 'SysUser',
      comment: '系统用户表',
      primaryKey: ['user_id'],
      indexes: [],
      foreignKeys: [],
      columns: [
        {
          name: 'user_id',
          propertyName: 'userId',
          sqlType: 'bigint',
          rawType: 'bigint',
          nullable: false,
          isPrimaryKey: true,
          isAutoIncrement: true,
          javaType: 'Long',
          goType: 'int64',
          pythonType: 'int',
          phpType: 'int',
          tsType: 'number',
          comment: '用户ID',
        },
        {
          name: 'username',
          propertyName: 'username',
          sqlType: 'varchar',
          rawType: 'varchar(50)',
          nullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
          javaType: 'String',
          goType: 'string',
          pythonType: 'str',
          phpType: 'string',
          tsType: 'string',
          comment: '用户名',
        },
      ],
    };

    const outputs = engine.renderEntity(table, config);
    expect(outputs.length).toBe(4);

    const modelFile = outputs.find((o) => o.outputPath === 'model/sys_user.go')!;
    expect(modelFile).toBeDefined();
    expect(modelFile.content).toContain('type SysUser struct {');
    expect(modelFile.content).toContain(
      'UserId int64 `gorm:"column:user_id;primaryKey;autoIncrement;not null" json:"userId"`',
    );
    expect(modelFile.content).toContain(
      'Username string `gorm:"column:username;not null" json:"username"`',
    );

    const dtoFile = outputs.find((o) => o.outputPath === 'model/sys_user_dto.go')!;
    expect(dtoFile).toBeDefined();
    expect(dtoFile.content).toContain('type CreateSysUserRequest struct {');
    expect(dtoFile.content).toContain('Username string `json:"username" binding:"required"`');

    const handlerFile = outputs.find((o) => o.outputPath === 'handler/sys_user.go')!;
    expect(handlerFile).toBeDefined();
    expect(handlerFile.content).toContain('package handler');
    expect(handlerFile.content).toContain('rg.GET("/sysUsers", GetSysUserList)');
    expect(handlerFile.content).toContain('id, err := strconv.ParseInt(c.Param("id"), 10, 64)');
  });
});
