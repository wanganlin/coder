import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { CoderConfigSchema, type CoderConfig } from './schema.js';

export interface CliOverrides {
  dbType?: 'mysql' | 'postgresql' | 'ddl';
  dbUrl?: string;
  framework?: string;
  output?: string;
  input?: string;
}

/**
 * 加载并校验配置文件
 *
 * @param configPath 配置文件路径，默认为当前工作目录下的 coder.yml
 * @param cliOverrides 命令行参数覆盖
 * @returns 校验通过并填充了默认值的 CoderConfig 对象
 */
export function loadConfig(configPath?: string, cliOverrides?: CliOverrides): CoderConfig {
  const resolvedPath = resolve(process.cwd(), configPath || 'coder.yml');
  let rawConfig: any = {};

  // 1. 读取并解析 YAML 文件 (如果存在)
  if (existsSync(resolvedPath)) {
    try {
      const fileContent = readFileSync(resolvedPath, 'utf-8');
      rawConfig = parse(fileContent) || {};
    } catch (err: any) {
      throw new Error(`解析配置文件失败 (${resolvedPath}): ${err.message}`);
    }
  }

  // 2. 初始化嵌套对象以防为空
  if (!rawConfig.datasource) rawConfig.datasource = {};
  if (!rawConfig.target) rawConfig.target = {};
  if (!rawConfig.tables) rawConfig.tables = {};
  if (!rawConfig.features) rawConfig.features = {};

  // 3. 应用命令行参数覆盖
  if (cliOverrides) {
    if (cliOverrides.dbType) {
      rawConfig.datasource.type = cliOverrides.dbType;
    }
    if (cliOverrides.dbUrl) {
      rawConfig.datasource.url = cliOverrides.dbUrl;
    }
    if (cliOverrides.input) {
      rawConfig.datasource.input = cliOverrides.input;
    }
    if (cliOverrides.framework) {
      rawConfig.target.framework = cliOverrides.framework;
    }
    if (cliOverrides.output) {
      rawConfig.target.output = cliOverrides.output;
    }
  }

  // 如果没有显式设置 datasource.type，且提供了 dbUrl 或 input，我们可以做智能推导
  if (!rawConfig.datasource.type) {
    if (rawConfig.datasource.url) {
      if (rawConfig.datasource.url.startsWith('mysql:')) {
        rawConfig.datasource.type = 'mysql';
      } else if (rawConfig.datasource.url.startsWith('postgres:')) {
        rawConfig.datasource.type = 'postgresql';
      }
    } else if (rawConfig.datasource.input) {
      rawConfig.datasource.type = 'ddl';
    }
  }

  // 4. 使用 Zod 进行校验和填充默认值
  const parsed = CoderConfigSchema.safeParse(rawConfig);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((err) => {
        const path = err.path.join('.');
        return `  - 字段 [${path || 'root'}]: ${err.message}`;
      })
      .join('\n');
    throw new Error(`配置校验失败:\n${errorDetails}`);
  }

  // 5. 进一步验证特定约束
  const config = parsed.data;
  if (config.datasource.type === 'mysql' || config.datasource.type === 'postgresql') {
    if (!config.datasource.url) {
      throw new Error(
        '配置校验失败:\n  - 当数据源类型为 mysql/postgresql 时，必须指定连接 URL (datasource.url)',
      );
    }
  } else if (config.datasource.type === 'ddl') {
    if (!config.datasource.input) {
      throw new Error(
        '配置校验失败:\n  - 当数据源类型为 ddl 时，必须指定 DDL 输入文件路径 (datasource.input)',
      );
    }
  }

  return config;
}

/**
 * 创建默认的模板配置文件内容 (用于 coder init)
 */
export function getDefaultConfigYaml(): string {
  return `# Coder 代码生成引擎配置文件

datasource:
  type: mysql                                   # 支持 mysql | postgresql | ddl
  url: mysql://root:pass@localhost:3306/mydb    # 数据库连接串
  # input: schema.sql                           # 如果 type 是 ddl，则指定 DDL SQL 文件路径

target:
  framework: spring-boot                        # 目标框架，如 spring-boot | gin | fastapi | laravel | nestjs
  output: ./src/main/java                       # 生成代码输出的目录

tables:
  include: []                                   # 包含的表名，为空则生成全部表
  exclude: ["flyway_schema_history"]             # 排除的表名

features:
  swagger: true              # 是否生成 OpenAPI/Swagger 3.0 注解
  unitTest: true             # 是否生成单元测试骨架
  pagination: true           # 是否生成分页支持
  auditFields: true          # 是否自动注入创建时间、修改时间等审计字段

# extensions:                # 字段扩展信息，用于补充数据库无法提供的信息
#   user:
#     status:
#       enum: ["ACTIVE", "INACTIVE", "BANNED"]
#       frontendWidget: select
#     phone:
#       desensitize: phone
`;
}
