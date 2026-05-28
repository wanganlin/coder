import type Handlebars from 'handlebars';
import { toPascalCase, toCamelCase, toKebabCase, toSnakeCase, pluralize } from '../utils/index.js';
import { toPropertyName } from '../schema/naming.js';
import { mapSqlType } from '../schema/type-mappings.js';

export function registerAllHelpers(hbs: typeof Handlebars): void {
  // Casing helpers
  hbs.registerHelper('className', function (this: any, str) {
    if (typeof str !== 'string') {
      return this?.className || '';
    }
    return toPascalCase(str);
  });

  hbs.registerHelper('propertyName', function (this: any, str, options) {
    if (typeof str !== 'string') {
      return this?.propertyName || '';
    }
    const lang = typeof options?.hash?.lang === 'string' ? options.hash.lang : 'java';
    return toPropertyName(str, lang);
  });

  hbs.registerHelper('pascalCase', (str) => {
    if (typeof str !== 'string') return '';
    return toPascalCase(str);
  });

  hbs.registerHelper('camelCase', (str) => {
    if (typeof str !== 'string') return '';
    return toCamelCase(str);
  });

  hbs.registerHelper('kebabCase', (str) => {
    if (typeof str !== 'string') return '';
    return toKebabCase(str);
  });

  hbs.registerHelper('snakeCase', (str) => {
    if (typeof str !== 'string') return '';
    return toSnakeCase(str);
  });

  // Pluralization
  hbs.registerHelper('pluralize', (str) => {
    if (typeof str !== 'string') return '';
    return pluralize(str);
  });

  // Indentation helper (outputs groups of 4 spaces)
  hbs.registerHelper('indent', (level) => {
    const depth = typeof level === 'number' ? level : 1;
    return ' '.repeat(depth * 4);
  });

  // SQL Type mapper
  hbs.registerHelper('mapType', (columnOrSqlType, options) => {
    const lang = typeof options?.hash?.lang === 'string' ? options.hash.lang : 'java';

    if (columnOrSqlType && typeof columnOrSqlType === 'object') {
      const col = columnOrSqlType as any;
      const key = `${lang.toLowerCase()}Type`;
      if (col[key]) return col[key];
      return mapSqlType(col.rawType || col.sqlType || '', lang);
    }

    if (typeof columnOrSqlType === 'string') {
      return mapSqlType(columnOrSqlType, lang);
    }

    return '';
  });

  // Logical operators
  hbs.registerHelper('eq', (a, b) => a === b);
  hbs.registerHelper('ne', (a, b) => a !== b);
  hbs.registerHelper('and', (a, b) => !!(a && b));
  hbs.registerHelper('or', (a, b) => !!(a || b));
  hbs.registerHelper('not', (a) => !a);

  // Column search helper
  hbs.registerHelper('findColumn', (columns, colName) => {
    if (!Array.isArray(columns) || typeof colName !== 'string') return null;
    return columns.find((c) => c.name === colName) || null;
  });

  // Audit field detection helper (avoids deep expression nesting)
  hbs.registerHelper('isAuditField', (col) => {
    if (!col || typeof col !== 'object') return false;
    const name = col.name || '';
    return ['created_at', 'updated_at', 'created_by', 'updated_by'].includes(name);
  });

  // Deep object lookup helper (for accessing nested properties dynamically)
  hbs.registerHelper('lookup', (obj: any, key: string, prop?: string) => {
    if (!obj || typeof obj !== 'object') return undefined;
    const val = obj[key];
    if (prop && val && typeof val === 'object') {
      return val[prop];
    }
    return val;
  });
}
