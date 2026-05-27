import { describe, it, expect } from 'vitest';
import { TemplateEngine } from './index.js';
import { type CoderConfig } from '../config/index.js';
import { type TableSchema } from '../schema/index.js';

describe('Spring Boot 3.5 Templates Integration (T6)', () => {
  const springBootPluginDir = './templates/spring-boot';

  it('should successfully load spring-boot plugin', () => {
    const engine = new TemplateEngine();
    expect(() => engine.loadPlugin(springBootPluginDir)).not.toThrow();

    const metadata = engine.getPluginMetadata();
    expect(metadata.name).toBe('spring-boot');
    expect(metadata.language).toBe('java');
    expect(metadata.skeleton?.length).toBeGreaterThanOrEqual(3);
    expect(metadata.entityTemplates?.length).toBeGreaterThanOrEqual(4);
  });

  it('should render spring-boot skeleton files', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(springBootPluginDir);

    const config: CoderConfig = {
      datasource: { type: 'mysql', url: 'mysql://root@localhost:3306/db' },
      target: {
        framework: 'spring-boot',
        output: './out',
        package: 'com.example.myapp',
      },
      tables: { include: [], exclude: [] },
      features: { swagger: true, unitTest: true, pagination: true, auditFields: true },
      extensions: {},
    };

    const outputs = engine.renderSkeleton(config);
    expect(outputs.length).toBeGreaterThanOrEqual(4);

    const pomFile = outputs.find((o) => o.outputPath === 'pom.xml')!;
    expect(pomFile).toBeDefined();
    expect(pomFile.content).toContain('<artifactId>spring-boot-starter-parent</artifactId>');
    expect(pomFile.content).toContain('<version>3.5.0</version>');
    expect(pomFile.content).toContain('springdoc-openapi-starter-webmvc-ui');

    const appFile = outputs.find((o) => o.outputPath.includes('MyappApplication.java'))!;
    expect(appFile).toBeDefined();
    expect(appFile.content).toContain('public class MyappApplication {');

    const baseEntityFile = outputs.find((o) => o.outputPath.includes('BaseEntity.java'))!;
    expect(baseEntityFile).toBeDefined();
    expect(baseEntityFile.content).toContain('public abstract class BaseEntity {');
  });

  it('should render spring-boot entity layers for sys_user', () => {
    const engine = new TemplateEngine();
    engine.loadPlugin(springBootPluginDir);

    const config: CoderConfig = {
      datasource: { type: 'mysql', url: 'mysql://root@localhost:3306/db' },
      target: {
        framework: 'spring-boot',
        output: './out',
        package: 'com.example.myapp',
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
        {
          name: 'idx_username',
          columns: ['username'],
          unique: true,
        },
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
    expect(outputs.length).toBeGreaterThanOrEqual(5);

    // Entity checks
    const entityFile = outputs.find((o) => o.outputPath.includes('SysUser.java'))!;
    expect(entityFile).toBeDefined();
    expect(entityFile.content).toContain('public class SysUser extends BaseEntity {');
    expect(entityFile.content).toContain('private Long userId;');
    expect(entityFile.content).toContain('private String username;');
    // created_at should not be rendered inside class fields because it's inherited from BaseEntity
    expect(entityFile.content).not.toContain('private LocalDateTime createdAt;');

    // Repository checks
    const repoFile = outputs.find((o) => o.outputPath.includes('SysUserRepository.java'))!;
    expect(repoFile).toBeDefined();
    expect(repoFile.content).toContain(
      'public interface SysUserRepository extends JpaRepository<SysUser, Long>',
    );
    expect(repoFile.content).toContain('Optional<SysUser> findByUsername(String username);');

    // Service checks
    const serviceFile = outputs.find((o) => o.outputPath.includes('SysUserService.java'))!;
    expect(serviceFile).toBeDefined();
    expect(serviceFile.content).toContain('public class SysUserService {');
    expect(serviceFile.content).toContain('public Page<SysUser> findAll(Pageable pageable) {');

    // Controller checks
    const controllerFile = outputs.find((o) => o.outputPath.includes('SysUserController.java'))!;
    expect(controllerFile).toBeDefined();
    expect(controllerFile.content).toContain('public class SysUserController {');
    expect(controllerFile.content).toContain('@RequestMapping("/api/v1/sysUsers")');
    expect(controllerFile.content).toContain(
      'public ResponseEntity<SysUser> getById(@PathVariable Long id)',
    );
  });
});
