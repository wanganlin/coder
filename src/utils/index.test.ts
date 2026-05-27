import { describe, it, expect } from 'vitest';
import { toPascalCase, toCamelCase, toKebabCase, toSnakeCase, pluralize } from './index.js';

describe('toPascalCase', () => {
  it('converts snake_case', () => {
    expect(toPascalCase('user_order')).toBe('UserOrder');
  });

  it('converts single word', () => {
    expect(toPascalCase('user')).toBe('User');
  });

  it('handles multiple underscores', () => {
    expect(toPascalCase('user_order_item')).toBe('UserOrderItem');
  });

  it('handles kebab-case', () => {
    expect(toPascalCase('user-order')).toBe('UserOrder');
  });
});

describe('toCamelCase', () => {
  it('converts snake_case', () => {
    expect(toCamelCase('user_order')).toBe('userOrder');
  });

  it('keeps single word lowercase start', () => {
    expect(toCamelCase('user')).toBe('user');
  });

  it('handles multiple parts', () => {
    expect(toCamelCase('created_at')).toBe('createdAt');
  });
});

describe('toKebabCase', () => {
  it('converts PascalCase', () => {
    expect(toKebabCase('UserOrder')).toBe('user-order');
  });

  it('converts snake_case', () => {
    expect(toKebabCase('user_order')).toBe('user-order');
  });
});

describe('toSnakeCase', () => {
  it('converts PascalCase', () => {
    expect(toSnakeCase('UserOrder')).toBe('user_order');
  });

  it('converts camelCase', () => {
    expect(toSnakeCase('userOrder')).toBe('user_order');
  });
});

describe('pluralize', () => {
  it('adds s to regular words', () => {
    expect(pluralize('user')).toBe('users');
  });

  it('handles words ending in y', () => {
    expect(pluralize('category')).toBe('categories');
  });

  it('keeps vowel+y words regular', () => {
    expect(pluralize('key')).toBe('keys');
  });

  it('handles words ending in s', () => {
    expect(pluralize('address')).toBe('addresses');
  });

  it('handles words ending in ch', () => {
    expect(pluralize('batch')).toBe('batches');
  });
});
