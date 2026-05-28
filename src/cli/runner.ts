import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig, type CliOverrides } from '../config/index.js';
import { createDatasourceAdapter } from '../datasource/index.js';
import { processTableSchema, deriveRelationships, type TableSchema } from '../schema/index.js';
import { TemplateEngine } from '../engine/index.js';
import { writeFiles } from '../output/index.js';
import { formatFiles } from '../codegen/format.js';
import { verifyFiles } from '../codegen/verify.js';

export interface GenerationSummary {
  tablesProcessed: string[];
  filesGenerated: string[];
}

/**
 * 自动定位插件目录
 */
function resolvePluginDir(framework: string): string {
  let pluginDir = resolve(process.cwd(), 'templates', framework);
  if (!existsSync(pluginDir)) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    pluginDir = resolve(__dirname, '../../templates', framework);
  }
  return pluginDir;
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
      const decorated = processTableSchema(rawSchema, config.target.framework, config.extensions);
      decoratedSchemas.push(decorated);
      tablesProcessed.push(name);
    }

    // 4.5 推导表间关联关系（外键 → ManyToOne / OneToMany）
    deriveRelationships(decoratedSchemas);

    // 5. 初始化模板引擎并加载后端插件
    const engine = new TemplateEngine();
    const backendPluginDir = resolvePluginDir(config.target.framework);
    engine.loadPlugin(backendPluginDir);

    // 6. 渲染后端骨架层
    const skeletonFiles = engine.renderSkeleton(config, decoratedSchemas);

    // 7. 渲染后端实体层
    const entityFiles = [];
    for (const schema of decoratedSchemas) {
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
      console.log(`\n[frontend] 开始生成 ${config.target.frontend} 前端代码...`);
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
      console.log('\n[format] 开始代码格式化...');
      const formatResult = formatFiles(outputDir, [...skeletonFiles, ...entityFiles]);
      if (formatResult.formatted > 0) {
        console.log(`[format] 完成: ${formatResult.formatted} 文件已格式化`);
      }
    }

    // ==== 编译验证 ====
    if (config.features.verify) {
      console.log('\n[verify] 开始编译验证...');
      const verifyResult = verifyFiles(outputDir, [...skeletonFiles, ...entityFiles]);
      if (verifyResult.errors.length === 0 && verifyResult.total > 0) {
        console.log('[verify] 编译验证完成，未发现错误');
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
