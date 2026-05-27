import { toPascalCase, toCamelCase, toKebabCase, toSnakeCase } from '../utils/index.js';

/**
 * 将原始表名转换为类名 (PascalCase)
 * @example toClassName('sys_user') → 'SysUser'
 */
export function toClassName(name: string): string {
  return toPascalCase(name);
}

/**
 * 将原始列名转换为目标语言的属性/字段名
 *
 * @param name 原始字段名 (e.g. user_id)
 * @param language 目标语言 ('java' | 'go' | 'python' | 'php' | 'typescript')
 */
export function toPropertyName(name: string, language: string): string {
  const lang = language.toLowerCase();
  switch (lang) {
    case 'java':
    case 'typescript':
    case 'php':
      return toCamelCase(name);
    case 'go':
      return toPascalCase(name);
    case 'python':
      return toSnakeCase(name);
    default:
      return toCamelCase(name);
  }
}

/**
 * 根据语言规范将表名转换为对应的代码文件名
 *
 * @param name 原始名称 (通常是表名，如 sys_user)
 * @param language 目标语言 ('java' | 'go' | 'python' | 'php' | 'typescript')
 * @param type 组件类型 (如 'Entity', 'Repository', 'Service', 'Controller', 'Model')
 * @returns 格式化后的文件名 (包含后缀)
 */
export function toFileName(name: string, language: string, type?: string): string {
  const lang = language.toLowerCase();
  const basePascal = toPascalCase(name);
  const baseSnake = toSnakeCase(name);
  const baseKebab = toKebabCase(name);

  switch (lang) {
    case 'java': {
      // Java 文件名必须与类名一致，如 SysUser.java 或 SysUserController.java
      const suffix = type ? toPascalCase(type) : '';
      return `${basePascal}${suffix}.java`;
    }
    case 'go': {
      // Go 文件名通常是全小写带下划线，如 sys_user.go 或 sys_user_handler.go
      const suffix = type ? `_${toSnakeCase(type)}` : '';
      return `${baseSnake}${suffix}.go`;
    }
    case 'python': {
      // Python 文件名全小写带下划线，如 sys_user.py 或 sys_user_controller.py
      const suffix = type ? `_${toSnakeCase(type)}` : '';
      return `${baseSnake}${suffix}.py`;
    }
    case 'php': {
      // PHP/Laravel 类名和文件名契合，如 User.php, UserController.php
      const suffix = type ? toPascalCase(type) : '';
      return `${basePascal}${suffix}.php`;
    }
    case 'typescript': {
      // TypeScript/NestJS 推荐 kebab-case 带点后缀，如 sys-user.entity.ts, sys-user.controller.ts
      const suffix = type ? `.${toKebabCase(type)}` : '';
      return `${baseKebab}${suffix}.ts`;
    }
    default: {
      const suffix = type ? `-${toKebabCase(type)}` : '';
      return `${baseKebab}${suffix}.src`;
    }
  }
}
