import { z } from 'zod';

export const FieldExtensionSchema = z
  .object({
    enum: z.array(z.string()).optional(),
    frontendWidget: z
      .enum(['input', 'select', 'datepicker', 'switch', 'textarea', 'radio', 'checkbox'])
      .optional(),
    desensitize: z.enum(['phone', 'email', 'idcard', 'bankcard', 'name']).optional(),
    label: z.string().optional(),
    comment: z.string().optional(),
    email: z.boolean().optional(),
    pattern: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .catchall(z.any());

export interface FieldExtension {
  enum?: string[];
  frontendWidget?: 'input' | 'select' | 'datepicker' | 'switch' | 'textarea' | 'radio' | 'checkbox';
  desensitize?: 'phone' | 'email' | 'idcard' | 'bankcard' | 'name';
  label?: string;
  comment?: string;
  email?: boolean;
  pattern?: string;
  min?: number;
  max?: number;
  [key: string]: any;
}

export const DatasourceConfigSchema = z.object({
  type: z.enum(['mysql', 'postgresql', 'ddl']),
  url: z.string().optional(),
  input: z.string().optional(), // 用于 DDL 文件路径
});

export type DatasourceConfig = z.infer<typeof DatasourceConfigSchema>;

export const TargetConfigSchema = z
  .object({
    framework: z.string().min(1, 'target.framework is required'),
    output: z.string().default('./output'),
    package: z.string().optional(), // Java 包名，如 com.example.demo
    frontend: z.string().optional(), // 前端框架，如 'vue3-element'
    frontendOutput: z.string().optional(), // 前端输出目录
  })
  .catchall(z.any());

export type TargetConfig = z.infer<typeof TargetConfigSchema>;

export const TablesConfigSchema = z
  .object({
    include: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([]),
  })
  .default({ include: [], exclude: [] });

export type TablesConfig = z.infer<typeof TablesConfigSchema>;

export const FeaturesConfigSchema = z
  .object({
    swagger: z.boolean().default(true),
    unitTest: z.boolean().default(true),
    pagination: z.boolean().default(true),
    auditFields: z.boolean().default(true),
    format: z.boolean().default(true),
    verify: z.boolean().default(true),
  })
  .default({
    swagger: true,
    unitTest: true,
    pagination: true,
    auditFields: true,
    format: true,
    verify: true,
  });

export type FeaturesConfig = z.infer<typeof FeaturesConfigSchema>;

export const CoderConfigSchema = z.object({
  extends: z.string().optional(),
  datasource: DatasourceConfigSchema,
  target: TargetConfigSchema,
  tables: TablesConfigSchema,
  features: FeaturesConfigSchema,
  typeMappings: z.record(z.string(), z.string()).optional().default({}),
  extensions: z
    .record(z.string(), z.record(z.string(), FieldExtensionSchema))
    .optional()
    .default({}),
});

export type CoderConfig = z.infer<typeof CoderConfigSchema>;
