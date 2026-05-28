import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import type { FileOutput } from '../engine/index.js';

/**
 * 验证结果
 */
interface VerifyResult {
  /** 有错误的文件路径列表 */
  errors: string[];
  /** 警告信息列表 */
  warnings: string[];
  /** 验证过的文件数 */
  total: number;
}

/**
 * 按语言映射到对应的编译/验证工具
 */
const VERIFIERS: Record<
  string,
  { tool: string; command: (files: string[], outputDir: string) => string; detect: string }
> = {
  java: {
    tool: 'javac',
    command: (files) => `javac -d /tmp/coder-out -proc:none ${files.join(' ')}`,
    detect: 'javac -version',
  },
  go: {
    tool: 'go vet',
    command: (files, _outputDir) => {
      // go vet 需要对目录运行，提取文件所在目录去重
      const dirs = [...new Set(files.map((f) => dirname(f)))];
      return `go vet ${dirs.join(' ')}`;
    },
    detect: 'go version',
  },
  python: {
    tool: 'mypy',
    command: (files) => `mypy ${files.join(' ')} --ignore-missing-imports`,
    detect: 'mypy --version',
  },
  php: {
    tool: 'php -l',
    command: (files) => files.map((f) => `php -l "${f}"`).join(' && '),
    detect: 'php -v',
  },
  typescript: {
    tool: 'tsc --noEmit',
    command: (_files, outputDir) => `npx tsc --noEmit --project ${outputDir}`,
    detect: 'npx tsc --version',
  },
};

/**
 * 检测验证工具是否可用
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
 * 对生成的文件执行编译/静态检查验证
 *
 * 按语言分组执行验证命令，错误不阻断流程但打印警告。
 *
 * @param outputDir 输出目录
 * @param files 已写入的文件列表
 * @returns 验证结果
 */
export function verifyFiles(
  outputDir: string,
  files: FileOutput[],
): VerifyResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let total = 0;

  // 按语言分组
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const lang = file.language || 'java';
    if (!VERIFIERS[lang]) continue;
    if (!groups.has(lang)) {
      groups.set(lang, []);
    }
    const filePath = resolve(outputDir, file.outputPath);
    groups.get(lang)!.push(filePath);
  }

  for (const [lang, filePaths] of groups) {
    const verifier = VERIFIERS[lang];
    if (!verifier) continue;

    if (!isToolAvailable(verifier.detect)) {
      warnings.push(
        `[verify] ${verifier.tool} 未安装或不可用，跳过 ${lang} 文件验证 (${filePaths.length} 文件)`,
      );
      continue;
    }

    try {
      const cmd = verifier.command(filePaths, outputDir);
      total += filePaths.length;
      execSync(cmd, { stdio: 'pipe', timeout: 60000, cwd: outputDir });
      console.log(`[verify] ${verifier.tool}: ${filePaths.length} 文件验证通过`);
    } catch (err: any) {
      const msg = err.stderr?.toString() || err.stdout?.toString() || err.message || '';
      // 截取前 500 字符避免输出过长
      errors.push(
        `[verify] ${verifier.tool} 验证失败 (${filePaths.length} 文件):\n${msg.substring(0, 500)}`,
      );
    }
  }

  // 打印验证摘要
  if (errors.length > 0) {
    console.warn('\n=== 编译验证错误 ===');
    errors.forEach((e) => console.warn(e));
    console.warn(`\n发现 ${errors.length} 个语言的验证错误，请检查生成代码。`);
  }

  if (warnings.length > 0) {
    console.warn('\n=== 验证警告 ===');
    warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
  }

  if (total > 0 && errors.length === 0 && warnings.length === 0) {
    console.log(`\n[verify] 所有 ${total} 个文件验证通过`);
  }

  return { errors, warnings, total };
}
