import { type TableFilter } from './types.js';

/**
 * 依据 include/exclude 规则对表名进行过滤
 */
export function filterTables(tables: string[], filter?: TableFilter): string[] {
  if (!filter) return tables;

  let result = [...tables];

  // 1. 处理 include (包含指定表)
  if (filter.include && filter.include.length > 0) {
    const includeSet = new Set(filter.include.map((t) => t.toLowerCase()));
    result = result.filter((t) => includeSet.has(t.toLowerCase()));
  }

  // 2. 处理 exclude (排除指定表)
  if (filter.exclude && filter.exclude.length > 0) {
    const excludeSet = new Set(filter.exclude.map((t) => t.toLowerCase()));
    result = result.filter((t) => !excludeSet.has(t.toLowerCase()));
  }

  return result;
}
