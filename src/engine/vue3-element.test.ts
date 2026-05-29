import { describe, it, expect } from 'vitest';
import { TemplateEngine } from './index.js';
import { type CoderConfig } from '../config/index.js';
import { type TableSchema } from '../schema/index.js';

describe('Vue3 + Element Plus Templates Integration (T10)', () => {
  const vue3PluginDir = './templates/vue3-element';

  it('should successfully load vue3-element plugin', () => {
    const engine = new TemplateEngine();
    expect(() => engine.loadPlugin(vue3PluginDir)).not.toThrow();

    const metadata = engine.getPluginMetadata();
    expect(metadata.name).toBe('vue3-element');
    expect(metadata.language).toBe('typescript');
    expect(metadata.skeleton?.length).toBe(9);
    expect(metadata.entityTemplates?.length).toBe(4);
  });

  it('should render vue3-element skeleton files', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(vue3PluginDir);

    const config: CoderConfig = {
      datasource: { type: 'mysql', url: 'mysql://root@localhost:3306/db' },
      target: {
        framework: 'vue3-element',
        output: './out-vue3',
        package: 'com.example.myapp',
      },
      tables: { include: [], exclude: [] },
      features: { swagger: false, unitTest: false, pagination: true, auditFields: true, format: false, verify: false },
      extensions: {},
      typeMappings: {},
    };

    const tables: TableSchema[] = [
      { name: 'sys_user', className: 'SysUser', primaryKey: ['user_id'], indexes: [], foreignKeys: [], columns: [] },
    ];

    const outputs = engine.renderSkeleton(config, tables);
    expect(outputs.length).toBe(9);

    const pkgFile = outputs.find((o) => o.outputPath === 'package.json')!;
    expect(pkgFile).toBeDefined();
    expect(pkgFile.content).toContain('"vue"');
    expect(pkgFile.content).toContain('"element-plus"');

    const viteFile = outputs.find((o) => o.outputPath === 'vite.config.ts')!;
    expect(viteFile).toBeDefined();
    expect(viteFile.content).toContain('ElementPlusResolver');

    const mainFile = outputs.find((o) => o.outputPath === 'src/main.ts')!;
    expect(mainFile).toBeDefined();
    expect(mainFile.content).toContain('createApp');

    const appFile = outputs.find((o) => o.outputPath === 'src/App.vue')!;
    expect(appFile).toBeDefined();
    expect(appFile.content).toContain('el-menu');

    const routerFile = outputs.find((o) => o.outputPath === 'src/router/index.ts')!;
    expect(routerFile).toBeDefined();
    expect(routerFile.content).toContain('createRouter');
    expect(routerFile.content).toContain('SysUserList');

    const axiosFile = outputs.find((o) => o.outputPath === 'src/api/axios.ts')!;
    expect(axiosFile).toBeDefined();
    expect(axiosFile.content).toContain('axios.create');
  });

  it('should render vue3-element entity layers for sys_user', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(vue3PluginDir);

    const config: CoderConfig = {
      datasource: { type: 'mysql', url: 'mysql://root@localhost:3306/db' },
      target: {
        framework: 'vue3-element',
        output: './out-vue3',
        package: 'com.example.myapp',
      },
      tables: { include: [], exclude: [] },
      features: { swagger: false, unitTest: false, pagination: true, auditFields: true, format: false, verify: false },
      extensions: {},
      typeMappings: {},
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
        {
          name: 'created_at',
          propertyName: 'createdAt',
          sqlType: 'datetime',
          rawType: 'datetime',
          nullable: true,
          isPrimaryKey: false,
          isAutoIncrement: false,
          javaType: 'LocalDateTime',
          goType: 'time.Time',
          pythonType: 'datetime',
          phpType: '\\Carbon\\Carbon',
          tsType: 'Date',
          comment: '创建时间',
        },
      ],
    };

    const outputs = engine.renderEntity(table, config);
    expect(outputs.length).toBe(3);

    // API checks
    const apiFile = outputs.find((o) => o.outputPath.includes('/api/') && o.outputPath.endsWith('.ts'))!;
    expect(apiFile).toBeDefined();
    expect(apiFile.content).toContain('export interface SysUser');
    expect(apiFile.content).toContain('export async function getSysUserList');
    expect(apiFile.content).toContain('export async function getSysUserById');
    expect(apiFile.content).toContain('export async function createSysUser');

    // ListView checks
    const listViewFile = outputs.find((o) => o.outputPath.includes('ListView.vue'))!;
    expect(listViewFile).toBeDefined();
    expect(listViewFile.content).toContain('el-table');
    expect(listViewFile.content).toContain('SysUser 管理');
    // created_at should NOT appear in table columns (audit field)
    expect(listViewFile.content).toContain('审计字段 created_at');

    // FormView checks
    const formViewFile = outputs.find((o) => o.outputPath.includes('FormView.vue'))!;
    expect(formViewFile).toBeDefined();
    expect(formViewFile.content).toContain('el-form');
    expect(formViewFile.content).toContain('username');
    expect(formViewFile.content).toContain('getSysUserById');
  });
});
