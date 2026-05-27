import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { type FileOutput } from '../engine/index.js';

/**
 * 将生成的文件渲染结果写入磁盘
 *
 * @param outputDir 基础输出目录
 * @param files 待写入的文件列表
 */
export function writeFiles(outputDir: string, files: FileOutput[]): string[] {
  const resolvedBase = resolve(process.cwd(), outputDir);
  const writtenFiles: string[] = [];

  for (const file of files) {
    const finalPath = resolve(resolvedBase, file.outputPath);
    const parentDir = dirname(finalPath);

    // 1. 递归创建父级目录
    mkdirSync(parentDir, { recursive: true });

    // 2. 写入文件内容
    writeFileSync(finalPath, file.content, 'utf-8');
    writtenFiles.push(finalPath);
  }

  return writtenFiles;
}
