import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, getDefaultConfigYaml } from './loader.js';

describe('Configuration System (T2)', () => {
  const testConfigPath = resolve(process.cwd(), 'test-coder.yml');

  beforeEach(() => {
    // 确保清理残留文件
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  it('should parse a valid config file and merge default values', () => {
    const yamlContent = `
datasource:
  type: mysql
  url: mysql://root:root@localhost:3306/test_db
target:
  framework: spring-boot
`;
    writeFileSync(testConfigPath, yamlContent, 'utf-8');

    const config = loadConfig(testConfigPath);

    expect(config.datasource.type).toBe('mysql');
    expect(config.datasource.url).toBe('mysql://root:root@localhost:3306/test_db');
    expect(config.target.framework).toBe('spring-boot');
    // Verify default values
    expect(config.target.output).toBe('./output');
    expect(config.features.swagger).toBe(true);
    expect(config.features.unitTest).toBe(true);
    expect(config.features.pagination).toBe(true);
    expect(config.features.auditFields).toBe(true);
    expect(config.tables.include).toEqual([]);
    expect(config.tables.exclude).toEqual([]);
    expect(config.extensions).toEqual({});
  });

  it('should fail when a required field is missing', () => {
    const yamlContent = `
datasource:
  type: mysql
  url: mysql://root:root@localhost:3306/test_db
# target is missing
`;
    writeFileSync(testConfigPath, yamlContent, 'utf-8');

    expect(() => loadConfig(testConfigPath)).toThrow(/配置校验失败/);
  });

  it('should apply CLI overrides correctly', () => {
    const yamlContent = `
datasource:
  type: mysql
  url: mysql://root:root@localhost:3306/test_db
target:
  framework: spring-boot
  output: ./old-path
`;
    writeFileSync(testConfigPath, yamlContent, 'utf-8');

    const config = loadConfig(testConfigPath, {
      dbUrl: 'mysql://newuser:newpass@localhost:3306/new_db',
      framework: 'gin',
      output: './new-path',
    });

    expect(config.datasource.url).toBe('mysql://newuser:newpass@localhost:3306/new_db');
    expect(config.target.framework).toBe('gin');
    expect(config.target.output).toBe('./new-path');
  });

  it('should auto-infer datasource type from connection URL or DDL input', () => {
    const yamlContent = `
datasource:
  url: postgres://postgres:pass@localhost:5432/postgres
target:
  framework: spring-boot
`;
    writeFileSync(testConfigPath, yamlContent, 'utf-8');

    const config = loadConfig(testConfigPath);
    expect(config.datasource.type).toBe('postgresql');
  });

  it('should auto-infer ddl type when input is provided', () => {
    const yamlContent = `
datasource:
  input: schema.sql
target:
  framework: spring-boot
`;
    writeFileSync(testConfigPath, yamlContent, 'utf-8');

    const config = loadConfig(testConfigPath);
    expect(config.datasource.type).toBe('ddl');
  });

  it('should throw validation error for mysql without url', () => {
    const yamlContent = `
datasource:
  type: mysql
target:
  framework: spring-boot
`;
    writeFileSync(testConfigPath, yamlContent, 'utf-8');

    expect(() => loadConfig(testConfigPath)).toThrow(/必须指定连接 URL/);
  });

  it('should throw validation error for ddl without input', () => {
    const yamlContent = `
datasource:
  type: ddl
target:
  framework: spring-boot
`;
    writeFileSync(testConfigPath, yamlContent, 'utf-8');

    expect(() => loadConfig(testConfigPath)).toThrow(/必须指定 DDL 输入文件路径/);
  });

  it('should parse extensions correctly', () => {
    const yamlContent = `
datasource:
  type: mysql
  url: mysql://root@localhost/db
target:
  framework: spring-boot
extensions:
  user:
    status:
      enum: ["ACTIVE", "INACTIVE"]
      frontendWidget: select
    phone:
      desensitize: phone
      label: "手机号码"
`;
    writeFileSync(testConfigPath, yamlContent, 'utf-8');

    const config = loadConfig(testConfigPath);
    expect(config.extensions?.user?.status).toEqual({
      enum: ['ACTIVE', 'INACTIVE'],
      frontendWidget: 'select',
    });
    expect(config.extensions?.user?.phone).toEqual({
      desensitize: 'phone',
      label: '手机号码',
    });
  });

  it('should generate default config YAML template', () => {
    const defaultYaml = getDefaultConfigYaml();
    expect(defaultYaml).toContain('datasource:');
    expect(defaultYaml).toContain('target:');
    expect(defaultYaml).toContain('framework: spring-boot');
  });
});
