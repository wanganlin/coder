const DEFAULT_MAPPINGS: Record<string, Record<string, string>> = {
  // String types
  varchar: {
    java: 'String',
    go: 'string',
    python: 'str',
    php: 'string',
    typescript: 'string',
  },
  char: {
    java: 'String',
    go: 'string',
    python: 'str',
    php: 'string',
    typescript: 'string',
  },
  text: {
    java: 'String',
    go: 'string',
    python: 'str',
    php: 'string',
    typescript: 'string',
  },
  longtext: {
    java: 'String',
    go: 'string',
    python: 'str',
    php: 'string',
    typescript: 'string',
  },
  mediumtext: {
    java: 'String',
    go: 'string',
    python: 'str',
    php: 'string',
    typescript: 'string',
  },
  tinytext: {
    java: 'String',
    go: 'string',
    python: 'str',
    php: 'string',
    typescript: 'string',
  },
  uuid: {
    java: 'UUID', // or String, but java.util.UUID is standard for JPA
    go: 'string',
    python: 'str',
    php: 'string',
    typescript: 'string',
  },

  // Integer types
  int: {
    java: 'Integer',
    go: 'int',
    python: 'int',
    php: 'int',
    typescript: 'number',
  },
  integer: {
    java: 'Integer',
    go: 'int',
    python: 'int',
    php: 'int',
    typescript: 'number',
  },
  tinyint: {
    java: 'Integer', // tinyint is commonly used as int or boolean. Default to Integer
    go: 'int8',
    python: 'int',
    php: 'int',
    typescript: 'number',
  },
  smallint: {
    java: 'Integer',
    go: 'int16',
    python: 'int',
    php: 'int',
    typescript: 'number',
  },
  mediumint: {
    java: 'Integer',
    go: 'int',
    python: 'int',
    php: 'int',
    typescript: 'number',
  },
  bigint: {
    java: 'Long',
    go: 'int64',
    python: 'int',
    php: 'int', // PHP floats to float if number exceeds PHP_INT_MAX, but type is int
    typescript: 'number',
  },

  // Floating point/decimal types
  float: {
    java: 'Float',
    go: 'float32',
    python: 'float',
    php: 'float',
    typescript: 'number',
  },
  double: {
    java: 'Double',
    go: 'float64',
    python: 'float',
    php: 'float',
    typescript: 'number',
  },
  real: {
    java: 'Double',
    go: 'float64',
    python: 'float',
    php: 'float',
    typescript: 'number',
  },
  decimal: {
    java: 'BigDecimal',
    go: 'float64',
    python: 'Decimal',
    php: 'float',
    typescript: 'number',
  },
  numeric: {
    java: 'BigDecimal',
    go: 'float64',
    python: 'Decimal',
    php: 'float',
    typescript: 'number',
  },

  // Boolean types
  boolean: {
    java: 'Boolean',
    go: 'bool',
    python: 'bool',
    php: 'bool',
    typescript: 'boolean',
  },
  bit: {
    java: 'Boolean',
    go: 'bool',
    python: 'bool',
    php: 'bool',
    typescript: 'boolean',
  },

  // Date & Time types
  date: {
    java: 'LocalDate',
    go: 'time.Time',
    python: 'date',
    php: '\\Carbon\\Carbon',
    typescript: 'Date',
  },
  datetime: {
    java: 'LocalDateTime',
    go: 'time.Time',
    python: 'datetime',
    php: '\\Carbon\\Carbon',
    typescript: 'Date',
  },
  timestamp: {
    java: 'LocalDateTime',
    go: 'time.Time',
    python: 'datetime',
    php: '\\Carbon\\Carbon',
    typescript: 'Date',
  },
  time: {
    java: 'LocalTime',
    go: 'string', // Go doesn't have a time-only type, using string or duration. String is safer
    python: 'time',
    php: 'string',
    typescript: 'string',
  },

  // JSON/special types
  json: {
    java: 'String', // commonly stored as String or generic Map in Java
    go: 'string', // or interface{} or json.RawMessage. string is simple and safe for templates
    python: 'dict',
    php: 'array',
    typescript: 'any',
  },
  jsonb: {
    java: 'String',
    go: 'string',
    python: 'dict',
    php: 'array',
    typescript: 'any',
  },

  // Binary types
  blob: {
    java: 'byte[]',
    go: '[]byte',
    python: 'bytes',
    php: 'string',
    typescript: 'Buffer',
  },
  longblob: {
    java: 'byte[]',
    go: '[]byte',
    python: 'bytes',
    php: 'string',
    typescript: 'Buffer',
  },
  mediumblob: {
    java: 'byte[]',
    go: '[]byte',
    python: 'bytes',
    php: 'string',
    typescript: 'Buffer',
  },
  binary: {
    java: 'byte[]',
    go: '[]byte',
    python: 'bytes',
    php: 'string',
    typescript: 'Buffer',
  },
  varbinary: {
    java: 'byte[]',
    go: '[]byte',
    python: 'bytes',
    php: 'string',
    typescript: 'Buffer',
  },
};

const FALLBACK_MAPPINGS: Record<string, string> = {
  java: 'String',
  go: 'string',
  python: 'str',
  php: 'string',
  typescript: 'string',
};

/**
 * 将 SQL 类型映射到目标语言类型
 *
 * @param rawSqlType 原始 SQL 类型 (例如 varchar(255), bigint(20) unsigned, decimal(10,2))
 * @param language 目标语言 ('java' | 'go' | 'python' | 'php' | 'typescript')
 * @param customMappings 用户自定义的类型映射覆盖 (例如 { 'json': 'MyCustomClass' })
 * @returns 映射后的编程语言类型名
 */
export function mapSqlType(
  rawSqlType: string,
  language: string,
  customMappings?: Record<string, string>,
): string {
  const lang = language.toLowerCase();

  // 1. 提取基础类型名并转换小写。例如: varchar(255) -> varchar, bigint(20) unsigned -> bigint
  const normalized = rawSqlType.trim().toLowerCase().split('(')[0].split(' ')[0];

  // 2. 检查自定义映射覆盖
  if (customMappings && customMappings[normalized]) {
    return customMappings[normalized];
  }

  // 3. 特殊处理：如果是 tinyint(1)，在 MySQL 中通常映射为 boolean
  if (normalized === 'tinyint' && rawSqlType.includes('(1)')) {
    const bitMappings: Record<string, string> = {
      java: 'Boolean',
      go: 'bool',
      python: 'bool',
      php: 'bool',
      typescript: 'boolean',
    };
    if (bitMappings[lang]) {
      return bitMappings[lang];
    }
  }

  // 4. 检查内置默认映射
  const langMappings = DEFAULT_MAPPINGS[normalized];
  if (langMappings && langMappings[lang]) {
    return langMappings[lang];
  }

  // 5. 降级兜底
  return FALLBACK_MAPPINGS[lang] || 'string';
}
