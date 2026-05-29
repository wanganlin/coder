import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
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
 * 将字符串中的 ${VAR} 替换为对应的环境变量值
 */
function interpolateEnvVars(content: string): string {
  return content.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    const value = process.env[varName];
    if (value === undefined) {
      throw new Error(
        `环境变量 ${varName} 未设置，但配置文件引用了它。请设置 ${varName} 环境变量后重试。`,
      );
    }
    return value;
  });
}

/**
 * 浅合并两个配置对象 (child 覆盖 parent)
 */
function mergeConfigs(parent: any, child: any): any {
  const merged = { ...parent };
  for (const key of Object.keys(child)) {
    if (
      child[key] &&
      typeof child[key] === 'object' &&
      !Array.isArray(child[key]) &&
      merged[key] &&
      typeof merged[key] === 'object' &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = { ...merged[key], ...child[key] };
    } else {
      merged[key] = child[key];
    }
  }
  return merged;
}

/**
 * 读取并解析 YAML 配置文件 (含环境变量插值)
 */
function readYamlConfig(filePath: string): any {
  if (!existsSync(filePath)) {
    throw new Error(`配置文件不存在: ${filePath}`);
  }
  try {
    const rawContent = readFileSync(filePath, 'utf-8');
    const interpolated = interpolateEnvVars(rawContent);
    return parse(interpolated) || {};
  } catch (err: any) {
    if (err.message?.includes('环境变量')) throw err;
    throw new Error(`解析配置文件失败 (${filePath}): ${err.message}`);
  }
}

/**
 * 加载并校验配置文件，支持 extends 继承和环境变量插值
 *
 * @param configPath 配置文件路径，默认为当前工作目录下的 coder.yml
 * @param cliOverrides 命令行参数覆盖
 * @returns 校验通过并填充了默认值的 CoderConfig 对象
 */
export function loadConfig(configPath?: string, cliOverrides?: CliOverrides): CoderConfig {
  const resolvedPath = resolve(process.cwd(), configPath || 'coder.yml');
  let rawConfig: any = {};

  // 1. 读取并解析 YAML 文件 (支持环境变量插值)
  if (existsSync(resolvedPath)) {
    rawConfig = readYamlConfig(resolvedPath);
  }

  // 2. 处理 extends 继承
  if (rawConfig.extends) {
    const extendsPath = resolve(dirname(resolvedPath), rawConfig.extends);
    const parentConfig = readYamlConfig(extendsPath);
    delete rawConfig.extends;
    rawConfig = mergeConfigs(parentConfig, rawConfig);
  }

  // 3. 初始化嵌套对象以防为空
  if (!rawConfig.datasource) rawConfig.datasource = {};
  if (!rawConfig.target) rawConfig.target = {};
  if (!rawConfig.tables) rawConfig.tables = {};
  if (!rawConfig.features) rawConfig.features = {};

  // 4. 应用命令行参数覆盖
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

  // 5. 智能推导 datasource.type
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

  // 6. 使用 Zod 进行校验和填充默认值
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

  // 7. 进一步验证特定约束
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

# typeMappings:              # 自定义 SQL 类型映射（覆盖内置默认值）
#   json: JsonNode
#   tinyint: Boolean

# extensions:                # 字段扩展信息，用于补充数据库无法提供的信息
#   user:
#     status:
#       enum: ["ACTIVE", "INACTIVE", "BANNED"]
#       frontendWidget: select
#     phone:
#       desensitize: phone
`;
}
