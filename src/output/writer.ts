import { writeFileSync, mkdirSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname, normalize } from 'node:path';
import { type FileOutput } from '../engine/index.js';

/** 保护区标记常量 */
const MARKER_START = 'CODER_GENERATED_START';
const MARKER_END = 'CODER_GENERATED_END';

/**
 * 根据语言获取注释前缀
 */
function getCommentPrefix(language?: string): string {
  switch (language) {
    case 'python':
      return '#';
    default:
      // java, go, php, typescript, and most languages use //
      return '//';
  }
}

/**
 * 用保护区标记包裹生成内容
 */
function wrapWithMarkers(content: string, language?: string): string {
  const prefix = getCommentPrefix(language);
  return [
    `${prefix} ==== ${MARKER_START} ====`,
    `${prefix} ⚠️ 此区域由 Coder 自动生成，重新生成时会被覆盖`,
    content,
    `${prefix} ==== ${MARKER_END} ====`,
  ].join('\n');
}

/**
 * 将生成的文件渲染结果写入磁盘，支持保护区增量合并
 *
 * 保护区机制（README 核心差异化能力）：
 * 1. 首次生成：生成内容被包裹在 `CODER_GENERATED_START/END` 标记中
 * 2. 再次生成：仅替换标记内的生成区内容，保留标记外的手写业务代码
 * 3. 备份保护：修改已存在文件前自动创建 .bak 备份
 *
 * @param outputDir 基础输出目录
 * @param files 待写入的文件列表
 * @returns 成功写入的文件绝对路径列表
 */
export function writeFiles(outputDir: string, files: FileOutput[]): string[] {
  const resolvedBase = resolve(process.cwd(), outputDir);
  const writtenFiles: string[] = [];

  for (const file of files) {
    // 规范化并验证输出路径
    const normalizedPath = normalize(file.outputPath).replace(/^\.\.\//, '');
    const finalPath = resolve(resolvedBase, normalizedPath);

    // 安全检查
    if (!finalPath.startsWith(resolvedBase)) {
      throw new Error(
        `安全警告：文件输出路径 [${file.outputPath}] 试图逃逸输出目录，已拒绝写入`,
      );
    }

    const parentDir = dirname(finalPath);
    mkdirSync(parentDir, { recursive: true });

    const newGeneratedContent = wrapWithMarkers(file.content, file.language);

    try {
      if (existsSync(finalPath)) {
        // 文件已存在 → 保护区增量合并
        const existingContent = readFileSync(finalPath, 'utf-8');
        const commentPrefix = getCommentPrefix(file.language);
        const startPattern = new RegExp(
          `${escapeRegex(commentPrefix)}\\s*====\\s*${MARKER_START}\\s*====`,
        );
        const endPattern = new RegExp(
          `${escapeRegex(commentPrefix)}\\s*====\\s*${MARKER_END}\\s*====`,
        );

        const startMatch = existingContent.match(startPattern);
        const endMatch = existingContent.match(endPattern);

        if (startMatch && endMatch && startMatch.index !== undefined && endMatch.index !== undefined) {
          // 已有保护区 → 对比差异，仅变更时写入
          const beforeMarker = existingContent.substring(0, startMatch.index);
          const afterMarker = existingContent.substring(
            endMatch.index + endMatch[0].length,
          );
          const mergedContent = beforeMarker + newGeneratedContent + afterMarker;

          if (mergedContent !== existingContent) {
            // 备份原文件
            copyFileSync(finalPath, finalPath + '.bak');
            writeFileSync(finalPath, mergedContent, 'utf-8');
          }
        } else {
          // 无保护区标记 → 备份后写入完整文件
          copyFileSync(finalPath, finalPath + '.bak');
          writeFileSync(finalPath, newGeneratedContent, 'utf-8');
        }
      } else {
        // 新文件 → 直接写入
        writeFileSync(finalPath, newGeneratedContent, 'utf-8');
      }
      writtenFiles.push(finalPath);
    } catch (err: any) {
      throw new Error(`写入文件失败 [${finalPath}]: ${err.message}`);
    }
  }

  return writtenFiles;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
