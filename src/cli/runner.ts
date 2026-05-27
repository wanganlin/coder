import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig, type CliOverrides } from '../config/index.js';
import { createDatasourceAdapter } from '../datasource/index.js';
import { processTableSchema, type TableSchema } from '../schema/index.js';
import { TemplateEngine } from '../engine/index.js';
import { writeFiles } from '../output/index.js';

export interface GenerationSummary {
  tablesProcessed: string[];
  filesGenerated: string[];
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

    // 5. 初始化模板引擎并加载对应插件
    const engine = new TemplateEngine();

    // 智能定位插件目录：尝试本地 templates 目录，如果没有则定位到内置 templates 目录
    let pluginDir = resolve(process.cwd(), 'templates', config.target.framework);
    if (!existsSync(pluginDir)) {
      // 降级兜底到相对 CLI 源文件的内置目录
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      pluginDir = resolve(__dirname, '../../templates', config.target.framework);
    }

    engine.loadPlugin(pluginDir);

    // 6. 渲染骨架层
    const skeletonFiles = engine.renderSkeleton(config, decoratedSchemas);

    // 7. 渲染实体层
    const entityFiles = [];
    for (const schema of decoratedSchemas) {
      const files = engine.renderEntity(schema, config);
      entityFiles.push(...files);
    }

    // 8. 写入文件至磁盘
    const allFiles = [...skeletonFiles, ...entityFiles];
    const writtenPaths = writeFiles(config.target.output, allFiles);
    filesGenerated.push(...writtenPaths);
  } finally {
    // 9. 关闭数据库连接
    await adapter.close();
  }

  return {
    tablesProcessed,
    filesGenerated,
  };
}
