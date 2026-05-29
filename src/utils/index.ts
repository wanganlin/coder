export * from './logger.js';

/**
 * 通用工具函数模块
 *
 * 提供命名转换、字符串处理等通用工具。
 *
 * @module utils
 */

/**
 * 将 snake_case 转换为 PascalCase
 * @example toPascalCase('user_order') → 'UserOrder'
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[_\-\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * 将 snake_case 转换为 camelCase
 * @example toCamelCase('user_order') → 'userOrder'
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * 将字符串转换为 kebab-case
 * @example toKebabCase('UserOrder') → 'user-order'
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

/**
 * 将字符串转换为 snake_case
 * @example toSnakeCase('UserOrder') → 'user_order'
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\-\s]+/g, '_')
    .toLowerCase();
}

/**
 * 简单复数化（英语）
 * @example pluralize('user') → 'users'
 * @example pluralize('category') → 'categories'
 */
export function pluralize(str: string): string {
  if (str.endsWith('y') && !/[aeiou]y$/i.test(str)) {
    return str.slice(0, -1) + 'ies';
  }
  if (
    str.endsWith('s') ||
    str.endsWith('x') ||
    str.endsWith('z') ||
    str.endsWith('ch') ||
    str.endsWith('sh')
  ) {
    return str + 'es';
  }
  return str + 's';
}
