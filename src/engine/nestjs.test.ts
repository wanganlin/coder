import { describe, it, expect } from 'vitest';
import { TemplateEngine } from './index.js';
import { type CoderConfig } from '../config/index.js';
import { type TableSchema } from '../schema/index.js';

describe('NestJS 11 + TypeORM 0.3 Templates Integration (T9)', () => {
  const nestjsPluginDir = './templates/nestjs';

  it('should successfully load nestjs plugin', () => {
    const engine = new TemplateEngine();
    expect(() => engine.loadPlugin(nestjsPluginDir)).not.toThrow();

    const metadata = engine.getPluginMetadata();
    expect(metadata.name).toBe('nestjs');
    expect(metadata.language).toBe('typescript');
    expect(metadata.skeleton?.length).toBe(6);
    expect(metadata.entityTemplates?.length).toBe(5);
  });

  it('should render nestjs skeleton files', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(nestjsPluginDir);

    const config: CoderConfig = {
      datasource: { type: 'mysql', url: 'mysql://root@localhost:3306/db' },
      target: {
        framework: 'nestjs',
        output: './out-nestjs',
        package: 'com.example.nestapp',
      },
      tables: { include: [], exclude: [] },
      features: { swagger: true, unitTest: true, pagination: true, auditFields: true },
      extensions: {},
    };

    const outputs = engine.renderSkeleton(config);
    expect(outputs.length).toBe(6);

    const pkgFile = outputs.find((o) => o.outputPath === 'package.json')!;
    expect(pkgFile).toBeDefined();
    expect(pkgFile.content).toContain('"@nestjs/common"');
    expect(pkgFile.content).toContain('"@nestjs/swagger"');
    expect(pkgFile.content).toContain('"typeorm"');

    const mainFile = outputs.find((o) => o.outputPath === 'src/main.ts')!;
    expect(mainFile).toBeDefined();
    expect(mainFile.content).toContain('NestFactory.create');
    expect(mainFile.content).toContain('SwaggerModule.setup');

    const appModuleFile = outputs.find((o) => o.outputPath === 'src/app.module.ts')!;
    expect(appModuleFile).toBeDefined();
    expect(appModuleFile.content).toContain('export class AppModule');

    const dbFile = outputs.find((o) => o.outputPath.includes('database.providers.ts'))!;
    expect(dbFile).toBeDefined();
    expect(dbFile.content).toContain('DataSource');

    const tsconfigFile = outputs.find((o) => o.outputPath === 'tsconfig.json')!;
    expect(tsconfigFile).toBeDefined();
    expect(tsconfigFile.content).toContain('"emitDecoratorMetadata"');
    expect(tsconfigFile.content).toContain('"experimentalDecorators"');
  });

  it('should render nestjs entity layers for sys_user', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(nestjsPluginDir);

    const config: CoderConfig = {
      datasource: { type: 'mysql', url: 'mysql://root@localhost:3306/db' },
      target: {
        framework: 'nestjs',
        output: './out-nestjs',
        package: 'com.example.nestapp',
      },
      tables: { include: [], exclude: [] },
      features: { swagger: true, unitTest: true, pagination: true, auditFields: true },
      extensions: {},
    };

    const table: TableSchema = {
      name: 'sys_user',
      className: 'SysUser',
      comment: '系统用户表',
      primaryKey: ['user_id'],
      indexes: [
        { name: 'idx_username', columns: ['username'], unique: true },
      ],
      foreignKeys: [],
      columns: [
        {
          name: 'user_id',
          propertyName: 'userId',
          sqlType: 'bigint',
          rawType: 'bigint',
          nullable: false,
          isPrimaryKey: true,
          isAutoIncrement: true,
          javaType: 'Long',
          goType: 'int64',
          pythonType: 'int',
          phpType: 'int',
          tsType: 'number',
          comment: '用户ID',
        },
        {
          name: 'username',
          propertyName: 'username',
          sqlType: 'varchar',
          rawType: 'varchar(50)',
          nullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
          javaType: 'String',
          goType: 'string',
          pythonType: 'str',
          phpType: 'string',
          tsType: 'string',
          comment: '用户名',
        },
        {
          name: 'created_at',
          propertyName: 'createdAt',
          sqlType: 'datetime',
          rawType: 'datetime',
          nullable: true,
          isPrimaryKey: false,
          isAutoIncrement: false,
          javaType: 'LocalDateTime',
          goType: 'time.Time',
          pythonType: 'datetime',
          phpType: '\\Carbon\\Carbon',
          tsType: 'Date',
          comment: '创建时间',
        },
      ],
    };

    const outputs = engine.renderEntity(table, config);
    expect(outputs.length).toBe(5);

    // Entity checks
    const entityFile = outputs.find((o) => o.outputPath.includes('.entity.ts'))!;
    expect(entityFile).toBeDefined();
    expect(entityFile.content).toContain('@Entity(\'sys_user\')');
    expect(entityFile.content).toContain('export class SysUser extends BaseEntity');
    expect(entityFile.content).toContain('@PrimaryGeneratedColumn');
    expect(entityFile.content).toContain('userId: number;');
    expect(entityFile.content).toContain('username: string;');
    // created_at should NOT be rendered (audit field, inherited from BaseEntity)
    expect(entityFile.content).not.toContain('createdAt: Date;');

    // DTO checks
    const dtoFile = outputs.find((o) => o.outputPath.includes('.dto.ts'))!;
    expect(dtoFile).toBeDefined();
    expect(dtoFile.content).toContain('export class CreateSysUserDto');
    expect(dtoFile.content).toContain('export class UpdateSysUserDto extends PartialType');
    expect(dtoFile.content).toContain('username: string;');
    // created_at should NOT be in Create DTO (audit field), but OK in Response
    const createDtoSection = dtoFile.content.substring(
      0,
      dtoFile.content.indexOf('export class Update'),
    );
    expect(createDtoSection).not.toContain('createdAt');

    // Service checks
    const serviceFile = outputs.find((o) => o.outputPath.includes('.service.ts'))!;
    expect(serviceFile).toBeDefined();
    expect(serviceFile.content).toContain('@Injectable()');
    expect(serviceFile.content).toContain('export class SysUserService');
    expect(serviceFile.content).toContain('async findAll(');
    expect(serviceFile.content).toContain('findAndCount');

    // Controller checks
    const controllerFile = outputs.find((o) => o.outputPath.includes('.controller.ts'))!;
    expect(controllerFile).toBeDefined();
    expect(controllerFile.content).toContain('@Controller(\'sysUsers\')');
    expect(controllerFile.content).toContain('export class SysUserController');
    expect(controllerFile.content).toContain('@ApiTags(\'SysUser\')');
    expect(controllerFile.content).toContain('@Get()');

    // Module checks
    const moduleFile = outputs.find((o) => o.outputPath.includes('.module.ts'))!;
    expect(moduleFile).toBeDefined();
    expect(moduleFile.content).toContain('export class SysUserModule');
    expect(moduleFile.content).toContain('TypeOrmModule.forFeature([SysUser])');
  });
});
