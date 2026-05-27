import { describe, it, expect } from 'vitest';
import { TemplateEngine } from './index.js';
import { type CoderConfig } from '../config/index.js';
import { type TableSchema } from '../schema/index.js';

describe('Python (FastAPI 0.136 + SQLAlchemy 2.x + Pydantic v2) Templates Integration (T9)', () => {
  const fastapiPluginDir = './templates/fastapi';

  it('should successfully load fastapi plugin', () => {
    const engine = new TemplateEngine();
    expect(() => engine.loadPlugin(fastapiPluginDir)).not.toThrow();

    const metadata = engine.getPluginMetadata();
    expect(metadata.name).toBe('fastapi');
    expect(metadata.language).toBe('python');
    expect(metadata.skeleton?.length).toBe(3);
    expect(metadata.entityTemplates?.length).toBe(4);
  });

  it('should render fastapi skeleton files', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(fastapiPluginDir);

    const config: CoderConfig = {
      datasource: { type: 'postgresql', url: 'postgres://root@localhost:5432/db' },
      target: {
        framework: 'fastapi',
        output: './out-python',
        package: 'app',
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
    expect(outputs.length).toBe(3);

    const reqsFile = outputs.find((o) => o.outputPath === 'requirements.txt')!;
    expect(reqsFile).toBeDefined();
    expect(reqsFile.content).toContain('fastapi>=0.136.0');
    expect(reqsFile.content).toContain('SQLAlchemy>=2.0.0');

    const dbFile = outputs.find((o) => o.outputPath === 'database.py')!;
    expect(dbFile).toBeDefined();
    expect(dbFile.content).toContain('postgres://root@localhost:5432/db');
    expect(dbFile.content).toContain('Base = declarative_base()');

    const mainFile = outputs.find((o) => o.outputPath === 'main.py')!;
    expect(mainFile).toBeDefined();
    expect(mainFile.content).toContain('from fastapi import FastAPI');
    expect(mainFile.content).toContain('from models.sys_user import SysUser');
    expect(mainFile.content).toContain('from routers.sys_user import router as sys_user_router');
  });

  it('should render fastapi entity layers for sys_user', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(fastapiPluginDir);

    const config: CoderConfig = {
      datasource: { type: 'mysql', url: 'mysql://root@localhost:3306/db' },
      target: {
        framework: 'fastapi',
        output: './out-python',
        package: 'app',
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
          name: 'email',
          propertyName: 'email',
          sqlType: 'varchar',
          rawType: 'varchar(100)',
          nullable: true,
          isPrimaryKey: false,
          isAutoIncrement: false,
          javaType: 'String',
          goType: 'string',
          pythonType: 'str',
          phpType: 'string',
          tsType: 'string',
          comment: '电子邮箱',
        },
      ],
    };

    const outputs = engine.renderEntity(table, config);
    expect(outputs.length).toBe(4);

    const modelFile = outputs.find((o) => o.outputPath === 'models/sys_user.py')!;
    expect(modelFile).toBeDefined();
    expect(modelFile.content).toContain('class SysUser(Base):');
    expect(modelFile.content).toContain('user_id: Mapped[int] = mapped_column(');
    expect(modelFile.content).toContain('username: Mapped[str] = mapped_column(');
    expect(modelFile.content).toContain('email: Mapped[Optional[str]] = mapped_column(');

    const schemaFile = outputs.find((o) => o.outputPath === 'schemas/sys_user.py')!;
    expect(schemaFile).toBeDefined();
    expect(schemaFile.content).toContain('class SysUserCreate(BaseModel):');
    expect(schemaFile.content).toContain('username: str = Field(');
    expect(schemaFile.content).toContain('email: Optional[str] = Field(');
    expect(schemaFile.content).toContain('class SysUserResponse(BaseModel):');

    const crudFile = outputs.find((o) => o.outputPath === 'crud/sys_user.py')!;
    expect(crudFile).toBeDefined();
    expect(crudFile.content).toContain('def get_by_id(db: Session, user_id: int)');
    expect(crudFile.content).toContain(
      'db.query(SysUser).filter(SysUser.user_id == user_id).first()',
    );

    const routerFile = outputs.find((o) => o.outputPath === 'routers/sys_user.py')!;
    expect(routerFile).toBeDefined();
    expect(routerFile.content).toContain('router = APIRouter(');
    expect(routerFile.content).toContain('prefix="/sysUsers"');
    expect(routerFile.content).toContain('sys_user_crud.get_by_id(db, id)');
  });
});
