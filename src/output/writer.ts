import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, normalize } from 'node:path';
import { type FileOutput } from '../engine/index.js';

/**
 * 将生成的文件渲染结果写入磁盘
 *
 * @param outputDir 基础输出目录
 * @param files 待写入的文件列表
 * @returns 成功写入的文件绝对路径列表
 */
export function writeFiles(outputDir: string, files: FileOutput[]): string[] {
  const resolvedBase = resolve(process.cwd(), outputDir);
  const writtenFiles: string[] = [];

  for (const file of files) {
    // 规范化并验证输出路径，防止路径遍历攻击
    const normalizedPath = normalize(file.outputPath).replace(/^\.\.\//, '');
    const finalPath = resolve(resolvedBase, normalizedPath);

    // 安全检查：确保最终路径在输出目录内
    if (!finalPath.startsWith(resolvedBase)) {
      throw new Error(
        `安全警告：文件输出路径 [${file.outputPath}] 试图逃逸输出目录，已拒绝写入`,
      );
    }

    const parentDir = dirname(finalPath);

    try {
      // 1. 递归创建父级目录
      mkdirSync(parentDir, { recursive: true });

      // 2. 写入文件内容
      writeFileSync(finalPath, file.content, 'utf-8');
      writtenFiles.push(finalPath);
    } catch (err: any) {
      throw new Error(`写入文件失败 [${finalPath}]: ${err.message}`);
    }
  }

  return writtenFiles;
}
