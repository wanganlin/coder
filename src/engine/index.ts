import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { parse } from 'yaml';
import Handlebars from 'handlebars';
import { registerAllHelpers } from './helpers.js';
import { type PluginMetadata, type FileOutput } from './types.js';
import { type CoderConfig } from '../config/index.js';
import { type TableSchema } from '../schema/index.js';
import { toCamelCase, toPascalCase, pluralize } from '../utils/index.js';

export * from './types.js';
export * from './helpers.js';

export class TemplateEngine {
  private hbs: typeof Handlebars = Handlebars;
  private pluginMetadata: PluginMetadata | null = null;
  private pluginDir: string = '';

  constructor() {
    // 自动注册所有内置的 Handlebars 辅助函数
    registerAllHelpers(this.hbs);
  }

  /**
   * 加载插件配置并自动注册 Partials
   *
   * @param pluginDir 插件目录路径 (如 "./templates/spring-boot")
   */
  loadPlugin(pluginDir: string): void {
    const resolvedDir = resolve(process.cwd(), pluginDir);
    const pluginConfigPath = resolve(resolvedDir, 'plugin.yml');

    if (!existsSync(pluginConfigPath)) {
      throw new Error(`插件配置文件不存在: ${pluginConfigPath}`);
    }

    try {
      const fileContent = readFileSync(pluginConfigPath, 'utf-8');
      this.pluginMetadata = parse(fileContent) as PluginMetadata;
      this.pluginDir = resolvedDir;
    } catch (err: any) {
      throw new Error(`加载插件元数据失败 (${pluginConfigPath}): ${err.message}`);
    }

    // 自动扫描并注册 partials 目录下的模板片段
    this.registerPartials();
  }

  /**
   * 获取当前加载的插件元数据
   */
  getPluginMetadata(): PluginMetadata {
    if (!this.pluginMetadata) {
      throw new Error('未加载任何插件');
    }
    return this.pluginMetadata;
  }

  /**
   * 渲染骨架层文件 (在整个项目生命周期中只运行一次)
   */
  renderSkeleton(config: CoderConfig, tables: TableSchema[] = []): FileOutput[] {
    const metadata = this.getPluginMetadata();
    const result: FileOutput[] = [];

    if (!metadata.skeleton || metadata.skeleton.length === 0) {
      return result;
    }

    const context = {
      ...this.buildContext(config),
      tables,
    };

    for (const item of metadata.skeleton) {
      const templatePath = resolve(this.pluginDir, item.template);
      if (!existsSync(templatePath)) {
        throw new Error(`骨架层模板文件未找到: ${templatePath}`);
      }

      try {
        const templateContent = readFileSync(templatePath, 'utf-8');
        const compiledTemplate = this.hbs.compile(templateContent);
        const content = compiledTemplate(context);

        // 编译输出路径 (输出路径本身可以是 Handlebars 表达式)
        const compiledPath = this.hbs.compile(item.output)(context);

        result.push({
          outputPath: compiledPath,
          content,
          language: this.pluginMetadata?.language || 'java',
        });
      } catch (err: any) {
        throw new Error(`渲染骨架层模板 [${item.template}] 失败: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * 渲染单个表的实体层文件 (为数据库中的每一张表渲染一次)
   */
  renderEntity(table: TableSchema, config: CoderConfig): FileOutput[] {
    const metadata = this.getPluginMetadata();
    const result: FileOutput[] = [];

    if (!metadata.entityTemplates || metadata.entityTemplates.length === 0) {
      return result;
    }

    const context = this.buildContext(config, table);

    for (const item of metadata.entityTemplates) {
      // 跳过测试模板 (当 features.unitTest 为 false 时)
      if (item.test && !config.features.unitTest) continue;

      const templatePath = resolve(this.pluginDir, item.template);
      if (!existsSync(templatePath)) {
        throw new Error(`实体层模板文件未找到: ${templatePath}`);
      }

      try {
        const templateContent = readFileSync(templatePath, 'utf-8');
        const compiledTemplate = this.hbs.compile(templateContent);
        const content = compiledTemplate(context);

        // 编译输出路径
        const compiledPath = this.hbs.compile(item.output)(context);

        result.push({
          outputPath: compiledPath,
          content,
          language: this.pluginMetadata?.language || 'java',
        });
      } catch (err: any) {
        throw new Error(`渲染实体层模板 [${item.template}] 失败: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * 扫描并注册 Partials
   */
  private registerPartials(): void {
    const partialsDir = resolve(this.pluginDir, 'partials');
    if (!existsSync(partialsDir)) {
      return; // 没有 partials 目录则跳过
    }

    try {
      const files = readdirSync(partialsDir);
      for (const file of files) {
        const filePath = resolve(partialsDir, file);
        if (extname(file) === '.hbs') {
          const partialName = basename(file, '.hbs');
          const partialContent = readFileSync(filePath, 'utf-8');
          this.hbs.registerPartial(partialName, partialContent);
        }
      }
    } catch (err: any) {
      throw new Error(`注册 Partials 失败: ${err.message}`);
    }
  }

  /**
   * 构建公共模板渲染上下文
   */
  private buildContext(config: CoderConfig, table?: TableSchema): any {
    // 提取包路径和主类名 (主要适用于 Java)
    const packageName = config.target.package || 'com.coder.generated';
    const packagePath = packageName.replace(/\./g, '/');

    // 默认主类名为包的最后一节 (如 com.example.demo -> Demo)
    const baseName = packageName.split('.').pop() || 'Demo';
    const projectClassName = toPascalCase(baseName);

    const baseContext = {
      config,
      features: config.features,
      package: packageName,
      packagePath,
      projectClassName,
      language: this.pluginMetadata?.language || 'java',
    };

    if (!table) {
      return baseContext;
    }

    return {
      ...baseContext,
      table,
      columns: table.columns,
      primaryKey: table.primaryKey,
      indexes: table.indexes,
      foreignKeys: table.foreignKeys,
      className: table.className,
      propertyName: toCamelCase(table.name),
      pluralName: pluralize(toCamelCase(table.name)),
      tableName: table.name,
      tableComment: table.comment,
    };
  }
}
