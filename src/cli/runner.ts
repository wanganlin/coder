import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadConfig, type CliOverrides } from '../config/index.js';
import { createDatasourceAdapter } from '../datasource/index.js';
import { processTableSchema, deriveRelationships, type TableSchema } from '../schema/index.js';
import { TemplateEngine } from '../engine/index.js';
import { writeFiles } from '../output/index.js';
import { formatFiles } from '../codegen/format.js';
import { verifyFiles } from '../codegen/verify.js';
import { logger } from '../utils/logger.js';

export interface GenerationSummary {
  tablesProcessed: string[];
  filesGenerated: string[];
}

/**
 * 自动定位插件目录
 *
 * 按优先级依次查找:
 * 1. CODER_PLUGIN_PATH 环境变量指定的目录
 * 2. ~/.coder/plugins 用户级插件目录
 * 3. CWD 下的 templates/ 目录
 * 4. 项目内置的 templates/ 目录
 */
function resolvePluginDir(framework: string): string {
  const searchDirs: string[] = [];

  // 1. 环境变量 CODER_PLUGIN_PATH
  const envPath = process.env.CODER_PLUGIN_PATH;
  if (envPath) {
    searchDirs.push(resolve(envPath, framework));
  }

  // 2. 用户级插件目录 ~/.coder/plugins
  searchDirs.push(resolve(homedir(), '.coder', 'plugins', framework));

  // 3. CWD 相对路径
  searchDirs.push(resolve(process.cwd(), 'templates', framework));

  // 4. 项目内置目录 (source-relative)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  searchDirs.push(resolve(__dirname, '../../templates', framework));

  for (const dir of searchDirs) {
    if (existsSync(dir)) {
      return dir;
    }
  }

  throw new Error(
    `未找到框架 "${framework}" 的插件目录。已搜索:\n${searchDirs.map((d) => `  - ${d}`).join('\n')}`,
  );
}

/**
 * 核心生成器工作流编排
 *
 * @param configPath 配置文件路径
 * @param overrides 命令行覆盖参数
 */
export async function runGeneration(
  configPath?: string,
  overrides?: CliOverrides,
): Promise<GenerationSummary> {
  // 1. 加载并校验配置
  const config = loadConfig(configPath, overrides);

  // 2. 连接数据源
  const adapter = createDatasourceAdapter(config.datasource.type);
  const connString = config.datasource.url || config.datasource.input || '';
  await adapter.connect(connString);

  const filesGenerated: string[] = [];
  const tablesProcessed: string[] = [];

  try {
    // 3. 获取所有表名
    const tables = await adapter.getTables(config.tables);

    // 4. 读取表结构并二次修饰加工 (应用目标框架与字段 extensions 映射)
    const decoratedSchemas: TableSchema[] = [];
    for (const name of tables) {
      const rawSchema = await adapter.getTableSchema(name);
      const decorated = processTableSchema(rawSchema, config.target.framework, config.extensions, config.typeMappings);
      decoratedSchemas.push(decorated);
      tablesProcessed.push(name);
    }

    // 4.5 推导表间关联关系（外键 → ManyToOne / OneToMany / ManyToMany / OneToOne）
    deriveRelationships(decoratedSchemas, config.target.framework);

    // 5. 初始化模板引擎并加载后端插件
    const engine = new TemplateEngine();
    const backendPluginDir = resolvePluginDir(config.target.framework);
    engine.loadPlugin(backendPluginDir);

    // 6. 渲染后端骨架层
    const skeletonFiles = engine.renderSkeleton(config, decoratedSchemas);

    // 7. 渲染后端实体层（跳过中间表）
    const entityFiles = [];
    for (const schema of decoratedSchemas) {
      if (schema.isJunctionTable) {
        logger.info(`[schema] 跳过中间表 ${schema.name}（不生成实体）`);
        continue;
      }
      const files = engine.renderEntity(schema, config);
      entityFiles.push(...files);
    }

    // 8. 写入后端文件至磁盘
    const allBackendFiles = [...skeletonFiles, ...entityFiles];
    const outputDir = config.target.output || './output';
    const writtenPaths = writeFiles(outputDir, allBackendFiles);
    filesGenerated.push(...writtenPaths);

    // ==== 前端生成（可选） ====
    if (config.target.frontend) {
      logger.info(`\n[frontend] 开始生成 ${config.target.frontend} 前端代码...`);
      const frontendEngine = new TemplateEngine();
      const frontendPluginDir = resolvePluginDir(config.target.frontend);
      frontendEngine.loadPlugin(frontendPluginDir);

      const frontendSkeleton = frontendEngine.renderSkeleton(config, decoratedSchemas);
      const frontendEntities = [];
      for (const schema of decoratedSchemas) {
        const files = frontendEngine.renderEntity(schema, config);
        frontendEntities.push(...files);
      }

      const frontendOutputDir = config.target.frontendOutput || resolve(outputDir, 'frontend');
      const allFrontendFiles = [...frontendSkeleton, ...frontendEntities];
      const frontendWritten = writeFiles(frontendOutputDir, allFrontendFiles);
      filesGenerated.push(...frontendWritten);
    }

    // ==== 代码格式化 ====
    if (config.features.format) {
      logger.info('\n[format] 开始代码格式化...');
      const formatResult = formatFiles(outputDir, [...skeletonFiles, ...entityFiles]);
      if (formatResult.formatted > 0) {
        logger.info(`[format] 完成: ${formatResult.formatted} 文件已格式化`);
      }
    }

    // ==== 编译验证 ====
    if (config.features.verify) {
      logger.info('\n[verify] 开始编译验证...');
      const verifyResult = verifyFiles(outputDir, [...skeletonFiles, ...entityFiles]);
      if (verifyResult.errors.length === 0 && verifyResult.total > 0) {
        logger.info('[verify] 编译验证完成，未发现错误');
      }
    }
  } finally {
    // 9. 关闭数据库连接
    await adapter.close();
  }

  return {
    tablesProcessed,
    filesGenerated,
  };
}
