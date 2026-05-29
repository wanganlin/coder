import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { FileOutput } from '../engine/index.js';
import { logger } from '../utils/logger.js';

/**
 * 按语言映射到对应的格式化工具和命令
 */
const FORMATTERS: Record<
  string,
  { tool: string; command: (files: string[]) => string; detect: string }
> = {
  java: {
    tool: 'google-java-format',
    command: (files) => `google-java-format -i ${files.join(' ')}`,
    detect: 'google-java-format --version',
  },
  go: {
    tool: 'gofmt',
    command: (files) => `gofmt -w ${files.join(' ')}`,
    detect: 'go version',
  },
  python: {
    tool: 'black',
    command: (files) => `black ${files.join(' ')}`,
    detect: 'black --version',
  },
  php: {
    tool: 'php-cs-fixer',
    command: (files) => `php-cs-fixer fix ${files.join(' ')}`,
    detect: 'php-cs-fixer --version',
  },
  typescript: {
    tool: 'prettier',
    command: (files) => `npx prettier --write ${files.join(' ')}`,
    detect: 'npx prettier --version',
  },
};

/**
 * 检测格式化工具是否可用
 */
function isToolAvailable(detectCmd: string): boolean {
  try {
    execSync(detectCmd, { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 对生成的文件执行代码格式化
 *
 * 按语言分组批量执行格式化命令，工具不可用时优雅降级。
 *
 * @param outputDir 输出目录
 * @param files 已写入的文件列表
 * @returns 格式化结果摘要
 */
export function formatFiles(
  outputDir: string,
  files: FileOutput[],
): { formatted: number; skipped: number; warnings: string[] } {
  const warnings: string[] = [];
  let formatted = 0;
  let skipped = 0;

  // 按语言分组
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const lang = file.language || 'java';
    if (!FORMATTERS[lang]) {
      skipped++;
      continue;
    }
    if (!groups.has(lang)) {
      groups.set(lang, []);
    }
    const filePath = resolve(outputDir, file.outputPath);
    groups.get(lang)!.push(filePath);
  }

  for (const [lang, filePaths] of groups) {
    const formatter = FORMATTERS[lang];
    if (!formatter) continue;

    if (!isToolAvailable(formatter.detect)) {
      warnings.push(
        `[format] ${formatter.tool} 未安装或不可用，跳过 ${lang} 文件格式化 (${filePaths.length} 文件)`,
      );
      skipped += filePaths.length;
      continue;
    }

    try {
      const cmd = formatter.command(filePaths);
      execSync(cmd, { stdio: 'pipe', timeout: 30000, cwd: outputDir });
      formatted += filePaths.length;
      logger.info(`[format] ${formatter.tool}: ${filePaths.length} 文件格式化完成`);
    } catch (err: any) {
      const msg = err.stderr?.toString() || err.message || '未知错误';
      warnings.push(`[format] ${formatter.tool} 格式化失败: ${msg}`);
      skipped += filePaths.length;
    }
  }

  if (warnings.length > 0) {
    logger.warn('\n格式化警告:');
    warnings.forEach((w) => logger.warn(`  ⚠ ${w}`));
  }

  return { formatted, skipped, warnings };
}
