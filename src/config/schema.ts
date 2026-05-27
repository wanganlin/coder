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
  })
  .catchall(z.any());

export type FieldExtension = z.infer<typeof FieldExtensionSchema>;

export const DatasourceConfigSchema = z.object({
  type: z.enum(['mysql', 'postgresql', 'ddl']),
  url: z.string().optional(),
  input: z.string().optional(), // 用于 DDL 文件路径
});

export type DatasourceConfig = z.infer<typeof DatasourceConfigSchema>;

export const TargetConfigSchema = z
  .object({
    framework: z.string({
      required_error: 'target.framework is required',
    }),
    output: z.string().default('./output'),
    package: z.string().optional(), // Java 包名，如 com.example.demo
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
  })
  .default({ swagger: true, unitTest: true, pagination: true, auditFields: true });

export type FeaturesConfig = z.infer<typeof FeaturesConfigSchema>;

export const CoderConfigSchema = z.object({
  datasource: DatasourceConfigSchema,
  target: TargetConfigSchema,
  tables: TablesConfigSchema,
  features: FeaturesConfigSchema,
  extensions: z.record(z.record(FieldExtensionSchema)).optional().default({}),
});

export type CoderConfig = z.infer<typeof CoderConfigSchema>;
