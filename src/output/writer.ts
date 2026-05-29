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
      return '//';
  }
}

/**
 * 用保护区标记包裹生成内容，支持可选的区域名称
 *
 * @param content 生成内容
 * @param language 编程语言
 * @param regionName 可选区域名称（用于多区域文件）
 */
function wrapWithMarkers(content: string, language?: string, regionName?: string): string {
  const prefix = getCommentPrefix(language);
  const nameSuffix = regionName ? ` (${regionName})` : '';
  return [
    `${prefix} ==== ${MARKER_START}${nameSuffix} ====`,
    `${prefix} Coder 自动生成区域${regionName ? `: ${regionName}` : ''}，重新生成时会被覆盖`,
    content,
    `${prefix} ==== ${MARKER_END} ====`,
  ].join('\n');
}

/**
 * 从文件内容中提取所有保护区区域
 *
 * @returns { name, startIndex, endIndex }[] 按位置排序的区域列表
 */
interface RegionInfo {
  name: string | null;
  startIndex: number;
  endIndex: number;
  bodyStart: number;
  bodyEnd: number;
}

function findAllRegions(content: string, language?: string): RegionInfo[] {
  const prefix = getCommentPrefix(language);
  const escapedPrefix = escapeRegex(prefix);

  const startPattern = new RegExp(
    `${escapedPrefix}\\s*====\\s*${MARKER_START}(?:\\s*\\(([^)]*)\\))?\\s*====`,
    'g',
  );
  const endPattern = new RegExp(
    `${escapedPrefix}\\s*====\\s*${MARKER_END}\\s*====`,
    'g',
  );

  const starts: { name: string | null; index: number }[] = [];
  const ends: { index: number; matchEnd: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = startPattern.exec(content)) !== null) {
    starts.push({ name: m[1] || null, index: m.index });
  }
  while ((m = endPattern.exec(content)) !== null) {
    ends.push({ index: m.index, matchEnd: m.index + m[0].length });
  }

  // 按顺序配对 start 和 end
  const regions: { name: string | null; startIndex: number; endIndex: number; bodyStart: number; bodyEnd: number }[] = [];
  const pairedEnds = new Set<number>();
  for (const start of starts) {
    const end = ends.find((e) => e.index > start.index && !pairedEnds.has(e.index));
    if (end) {
      pairedEnds.add(end.index);
      // 定位区域内容体的起止位置（跳过开始标记行，找到结束标记前的位置）
      const bodyStart = content.indexOf('\n', start.index) + 1;
      // 跳过第二行（Coder 注释行）
      const bodyStart2 = content.indexOf('\n', bodyStart) + 1;
      const bodyEnd = content.lastIndexOf(`==== ${MARKER_END} ====`, end.matchEnd) - 1;
      regions.push({
        name: start.name,
        startIndex: start.index,
        endIndex: end.matchEnd,
        bodyStart: bodyStart2,
        bodyEnd: bodyEnd > bodyStart2 ? bodyEnd : end.matchEnd,
      });
    }
  }

  return regions;
}

/**
 * 将生成的文件渲染结果写入磁盘，支持多区域保护区增量合并
 *
 * 保护区机制：
 * 1. 首次生成：生成内容被包裹在 CODER_GENERATED_START/END 标记中
 * 2. 再次生成：仅替换标记内的生成区内容，保留标记外的手写业务代码
 * 3. 多区域支持：命名区域 (imports)、(fields) 等可独立保护
 * 4. 备份保护：修改已存在文件前自动创建 .bak 备份
 */
export function writeFiles(outputDir: string, files: FileOutput[]): string[] {
  const resolvedBase = resolve(process.cwd(), outputDir);
  const writtenFiles: string[] = [];

  for (const file of files) {
    const normalizedPath = normalize(file.outputPath).replace(/^\.\.\//, '');
    const finalPath = resolve(resolvedBase, normalizedPath);

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
        const existingContent = readFileSync(finalPath, 'utf-8');

        // 查找已有文件中的保护区
        const existingRegions = findAllRegions(existingContent, file.language);

        if (existingRegions.length > 0) {
          // 使用第一个保护区进行增量合并
          const region = existingRegions[0];
          const mergedContent =
            existingContent.substring(0, region.bodyStart) +
            file.content +
            '\n' +
            existingContent.substring(region.bodyEnd + 1);

          if (mergedContent !== existingContent) {
            copyFileSync(finalPath, finalPath + '.bak');
            writeFileSync(finalPath, mergedContent, 'utf-8');
          }
        } else {
          // 无保护区标记 → 备份后全量写入
          copyFileSync(finalPath, finalPath + '.bak');
          writeFileSync(finalPath, newGeneratedContent, 'utf-8');
        }
      } else {
        writeFileSync(finalPath, newGeneratedContent, 'utf-8');
      }
      writtenFiles.push(finalPath);
    } catch (err: any) {
      throw new Error(`写入文件失败 [${finalPath}]: ${err.message}`);
    }
  }

  return writtenFiles;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
