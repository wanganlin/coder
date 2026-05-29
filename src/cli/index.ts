#!/usr/bin/env node

/**
 * Coder CLI — 以数据模型为中心的多语言多框架代码生成引擎
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { loadConfig, getDefaultConfigYaml, type CliOverrides } from '../config/index.js';
import { runGeneration } from './runner.js';
import { createDatasourceAdapter } from '../datasource/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 终端色彩辅助工具
const style = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

function getVersion(): string {
  try {
    const pkgPath = resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
}

const program = new Command();

program
  .name('coder')
  .description('⚡ Coder — 以数据模型为中心的多语言多框架代码生成引擎')
  .version(`coder v${getVersion()}`, '-v, --version');

// 1. 初始化命令: coder init
program
  .command('init')
  .description('在当前目录初始化配置文件 (coder.yml)')
  .option('-f, --force', '强制覆盖已有的配置文件')
  .action((options) => {
    const targetPath = resolve(process.cwd(), 'coder.yml');

    if (existsSync(targetPath) && !options.force) {
      console.log(
        style.yellow('⚠️  [coder.yml] 已存在于当前目录。若要强制覆盖，请追加 --force 选项。'),
      );
      process.exit(0);
    }

    try {
      const templateContent = getDefaultConfigYaml();
      writeFileSync(targetPath, templateContent, 'utf-8');
      console.log(style.green(`✨ 成功创建配置文件: ${targetPath}`));
    } catch (err: any) {
      console.error(style.red(`❌ 创建配置文件失败: ${err.message}`));
      process.exit(1);
    }
  });

// 2. 主生成命令: coder generate
program
  .command('generate')
  .description('根据数据源生成代码项目')
  .option('-c, --config <file>', '指定配置文件路径，默认为 coder.yml')
  .option('-d, --db <url>', '覆盖数据库连接串')
  .option('-t, --db-type <type>', '覆盖数据库类型 (mysql | postgresql | ddl)')
  .option('-i, --input <file>', '覆盖 DDL SQL 文件输入路径')
  .option('-f, --framework <name>', '覆盖目标生成框架')
  .option('-o, --output <dir>', '覆盖输出目录')
  .option('-w, --watch', '监听文件变更并自动重新生成')
  .action(async (options) => {
    const configPath = options.config || 'coder.yml';

    const overrides: CliOverrides = {
      dbUrl: options.db,
      dbType: options.dbType,
      input: options.input,
      framework: options.framework,
      output: options.output,
    };

    async function doGenerate() {
      console.log(style.bold(style.cyan(`\n⚡ Coder 生成引擎开始工作... [${new Date().toLocaleTimeString()}]\n`)));

      try {
        const summary = await runGeneration(configPath, overrides);

        console.log(style.green('\n🎉 代码生成大获成功！'));
        console.log(style.bold(`   处理数据表 (${summary.tablesProcessed.length} 张):`));
        summary.tablesProcessed.forEach((t) => console.log(`     - ${style.cyan(t)}`));

        console.log(style.bold(`   生成文件列表 (${summary.filesGenerated.length} 个):`));
        summary.filesGenerated.forEach((f) => console.log(`     - ${style.green(f)}`));
      } catch (err: any) {
        console.error(style.red(`\n❌ 代码生成失败: ${err.message}`));
        if (!options.watch) process.exit(1);
      }
    }

    if (options.watch) {
      const { watch } = await import('node:fs');
      const config = loadConfig(configPath, overrides);
      const resolvedCfg = resolve(process.cwd(), configPath);
      const watchPaths = [resolvedCfg];

      // DDL 模式下同时监听输入文件
      if (config.datasource.type === 'ddl' && config.datasource.input) {
        watchPaths.push(resolve(process.cwd(), config.datasource.input));
      }

      console.log(style.cyan('👀 监听模式已启动，文件变更时将自动重新生成...'));
      watchPaths.forEach((p) => console.log(`   监听: ${p}`));
      console.log(style.yellow('   按 Ctrl+C 退出\n'));

      // 先执行一次生成
      await doGenerate();

      let debounceTimer: NodeJS.Timeout | null = null;
      for (const watchPath of watchPaths) {
        watch(watchPath, (eventType) => {
          if (eventType === 'change') {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => doGenerate(), 500);
          }
        });
      }

      // 保持进程运行
      process.stdin.resume();
    } else {
      await doGenerate();
    }
  });

// 3. 列出数据表命令: coder list-tables
program
  .command('list-tables')
  .description('连接数据库并展示其包含的所有数据表')
  .option('-c, --config <file>', '指定配置文件路径，默认为 coder.yml')
  .option('-d, --db <url>', '覆盖数据库连接串')
  .option('-t, --db-type <type>', '覆盖数据库类型 (mysql | postgresql | ddl)')
  .option('-i, --input <file>', '覆盖 DDL SQL 文件输入路径')
  .action(async (options) => {
    const configPath = options.config || 'coder.yml';

    const overrides: CliOverrides = {
      dbUrl: options.db,
      dbType: options.dbType,
      input: options.input,
    };

    try {
      const config = loadConfig(configPath, overrides);
      const adapter = createDatasourceAdapter(config.datasource.type);
      const connString = config.datasource.url || config.datasource.input || '';

      console.log(style.cyan(`正在连接至 [${config.datasource.type}] 数据源...`));
      await adapter.connect(connString);

      const tables = await adapter.getTables(config.tables);
      console.log(style.green(`\n📊 成功获取到 ${tables.length} 张表:`));
      tables.forEach((t) => console.log(`  - ${style.bold(t)}`));

      await adapter.close();
    } catch (err: any) {
      console.error(style.red(`\n❌ 获取表结构失败: ${err.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
