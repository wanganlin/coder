import { describe, it, expect } from 'vitest';
import { TemplateEngine } from './index.js';
import { type CoderConfig } from '../config/index.js';
import { type TableSchema } from '../schema/index.js';

describe('PHP (Laravel 13 + Eloquent ORM) Templates Integration (T10)', () => {
  const laravelPluginDir = './templates/laravel';

  it('should successfully load laravel plugin', () => {
    const engine = new TemplateEngine();
    expect(() => engine.loadPlugin(laravelPluginDir)).not.toThrow();

    const metadata = engine.getPluginMetadata();
    expect(metadata.name).toBe('laravel');
    expect(metadata.language).toBe('php');
    expect(metadata.skeleton?.length).toBe(4);
    expect(metadata.entityTemplates?.length).toBe(6);
  });

  it('should render laravel skeleton files', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(laravelPluginDir);

    const config: CoderConfig = {
      datasource: { type: 'postgresql', url: 'postgres://root@localhost:5432/db' },
      target: {
        framework: 'laravel',
        output: './out-php',
        package: 'App',
      },
      tables: { include: [], exclude: [] },
      features: { swagger: true, unitTest: true, pagination: true, auditFields: true },
      extensions: {},
    };

    const tables: TableSchema[] = [
      {
        name: 'sys_user',
        className: 'SysUser',
        primaryKey: ['user_id'],
        indexes: [],
        foreignKeys: [],
        columns: [],
      },
    ];

    const outputs = engine.renderSkeleton(config, tables);
    expect(outputs.length).toBe(4);

    const composerFile = outputs.find((o) => o.outputPath === 'composer.json')!;
    expect(composerFile).toBeDefined();
    expect(composerFile.content).toContain('"laravel/framework": "^13.0"');

    const envFile = outputs.find((o) => o.outputPath === '.env')!;
    expect(envFile).toBeDefined();
    expect(envFile.content).toContain('DB_CONNECTION=postgresql');

    const baseControllerFile = outputs.find(
      (o) => o.outputPath === 'app/Http/Controllers/Controller.php',
    )!;
    expect(baseControllerFile).toBeDefined();
    expect(baseControllerFile.content).toContain('abstract class Controller');

    const apiRoutesFile = outputs.find((o) => o.outputPath === 'routes/api.php')!;
    expect(apiRoutesFile).toBeDefined();
    expect(apiRoutesFile.content).toContain('use App\\Http\\Controllers\\Api\\SysUserController;');
    expect(apiRoutesFile.content).toContain(
      "Route::apiResource('sys_users', SysUserController::class);",
    );
  });

  it('should render laravel entity layers for sys_user', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(laravelPluginDir);

    const config: CoderConfig = {
      datasource: { type: 'mysql', url: 'mysql://root@localhost:3306/db' },
      target: {
        framework: 'laravel',
        output: './out-php',
        package: 'App',
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
      indexes: [],
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
          length: 50,
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
          name: 'is_active',
          propertyName: 'isActive',
          sqlType: 'tinyint',
          rawType: 'tinyint(1)',
          nullable: false,
          isPrimaryKey: false,
          isAutoIncrement: false,
          javaType: 'Boolean',
          goType: 'bool',
          pythonType: 'bool',
          phpType: 'bool',
          tsType: 'boolean',
          comment: '激活状态',
        },
      ],
    };

    const outputs = engine.renderEntity(table, config);
    expect(outputs.length).toBe(6);

    const modelFile = outputs.find((o) => o.outputPath === 'app/Models/SysUser.php')!;
    expect(modelFile).toBeDefined();
    expect(modelFile.content).toContain("protected $table = 'sys_user';");
    expect(modelFile.content).toContain("protected $primaryKey = 'user_id';");
    expect(modelFile.content).toContain("'is_active' => 'boolean'");
    expect(modelFile.content).toContain("'username'");

    const storeReqFile = outputs.find(
      (o) => o.outputPath === 'app/Http/Requests/StoreSysUserRequest.php',
    )!;
    expect(storeReqFile).toBeDefined();
    expect(storeReqFile.content).toContain("'username' => [");
    expect(storeReqFile.content).toContain("'required'");
    expect(storeReqFile.content).toContain("'max:50'");

    const updateReqFile = outputs.find(
      (o) => o.outputPath === 'app/Http/Requests/UpdateSysUserRequest.php',
    )!;
    expect(updateReqFile).toBeDefined();
    expect(updateReqFile.content).toContain("'username' => [");
    expect(updateReqFile.content).toContain("'sometimes'");

    const resourceFile = outputs.find(
      (o) => o.outputPath === 'app/Http/Resources/SysUserResource.php',
    )!;
    expect(resourceFile).toBeDefined();
    expect(resourceFile.content).toContain("'userId' => $this->user_id");

    const controllerFile = outputs.find(
      (o) => o.outputPath === 'app/Http/Controllers/Api/SysUserController.php',
    )!;
    expect(controllerFile).toBeDefined();
    expect(controllerFile.content).toContain('class SysUserController extends Controller');
    expect(controllerFile.content).toContain(
      "$items = SysUser::paginate(request()->query('size', 10));",
    );
    expect(controllerFile.content).toContain('SysUser::find($id)');
  });
});
