import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runGeneration } from './runner.js';

describe('End-to-End Generation Workflow Integration (T7)', () => {
  const testYmlPath = resolve(process.cwd(), 'test-coder.yml');
  const testSqlPath = resolve(process.cwd(), 'test-schema.sql');
  const testOutputDir = resolve(process.cwd(), 'test-gen-output');

  beforeEach(() => {
    // 清理残留环境
    if (existsSync(testYmlPath)) unlinkSync(testYmlPath);
    if (existsSync(testSqlPath)) unlinkSync(testSqlPath);
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (existsSync(testYmlPath)) unlinkSync(testYmlPath);
    if (existsSync(testSqlPath)) unlinkSync(testSqlPath);
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  // 针对 ES Modules 下 unlinkSync 的兜底
  const unlinkSync = (p: string) => {
    try {
      rmSync(p, { force: true });
    } catch {}
  };

  it('should run end-to-end code generation pipeline from DDL to Spring Boot project', async () => {
    // 1. 写入 SQL DDL
    const ddlContent = `
      CREATE TABLE sys_user (
        user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL COMMENT '用户名',
        email VARCHAR(100) COMMENT '邮箱',
        status TINYINT(1) DEFAULT 1,
        created_at DATETIME NOT NULL,
        updated_at DATETIME
      ) COMMENT = '系统用户表';

      CREATE TABLE user_profile (
        profile_id BIGINT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        bio TEXT,
        CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES sys_user(user_id)
      );
    `;
    writeFileSync(testSqlPath, ddlContent, 'utf-8');

    // 2. 写入 coder.yml 配置
    const yamlContent = `
datasource:
  type: ddl
  input: test-schema.sql

target:
  framework: spring-boot
  output: ./test-gen-output
  package: com.example.testapp

features:
  swagger: true
  unitTest: true
  pagination: true
  auditFields: true

extensions:
  sys_user:
    status:
      enum: ["ACTIVE", "INACTIVE"]
      frontendWidget: select
    email:
      desensitize: email
    `;
    writeFileSync(testYmlPath, yamlContent, 'utf-8');

    // 3. 运行生成引擎
    const summary = await runGeneration(testYmlPath);

    // 4. 验证生成的数据表和生成文件数目
    expect(summary.tablesProcessed).toEqual(['sys_user', 'user_profile']);
    expect(summary.filesGenerated.length).toBeGreaterThanOrEqual(14); // 5 skeleton files + 2 * 5 entity files = 15 files

    // 5. 验证物理文件的存在与内容
    const baseJavaPath = resolve(testOutputDir, 'src/main/java/com/example/testapp');

    // A. 骨架层校验
    expect(existsSync(resolve(testOutputDir, 'pom.xml'))).toBe(true);
    expect(existsSync(resolve(testOutputDir, 'src/main/resources/application.yml'))).toBe(true);
    expect(existsSync(resolve(baseJavaPath, 'TestappApplication.java'))).toBe(true);
    expect(existsSync(resolve(baseJavaPath, 'entity/BaseEntity.java'))).toBe(true);

    const pomContent = readFileSync(resolve(testOutputDir, 'pom.xml'), 'utf-8');
    expect(pomContent).toContain('<groupId>com.example.testapp</groupId>');

    // B. Entity 层校验 (sys_user)
    const entityPath = resolve(baseJavaPath, 'entity/SysUser.java');
    expect(existsSync(entityPath)).toBe(true);
    const entityContent = readFileSync(entityPath, 'utf-8');
    expect(entityContent).toContain('public class SysUser extends BaseEntity {');
    expect(entityContent).toContain('private Long userId;');
    expect(entityContent).toContain('private String username;');
    // Audit fields should be successfully skipped and inherited from BaseEntity
    expect(entityContent).not.toContain('private LocalDateTime createdAt;');
    expect(entityContent).not.toContain('private LocalDateTime updatedAt;');

    // C. Repository 层校验 (sys_user)
    const repoPath = resolve(baseJavaPath, 'repository/SysUserRepository.java');
    expect(existsSync(repoPath)).toBe(true);
    const repoContent = readFileSync(repoPath, 'utf-8');
    expect(repoContent).toContain(
      'public interface SysUserRepository extends JpaRepository<SysUser, Long>',
    );

    // D. Controller 层校验 (sys_user)
    const controllerPath = resolve(baseJavaPath, 'controller/SysUserController.java');
    expect(existsSync(controllerPath)).toBe(true);
    const controllerContent = readFileSync(controllerPath, 'utf-8');
    expect(controllerContent).toContain('public class SysUserController {');
    expect(controllerContent).toContain('@RequestMapping("/api/v1/sysUsers")');

    // E. DTO 层校验 (sys_user)
    const dtoPath = resolve(baseJavaPath, 'dto/SysUserDTO.java');
    expect(existsSync(dtoPath)).toBe(true);
    const dtoContent = readFileSync(dtoPath, 'utf-8');
    expect(dtoContent).toContain('public class SysUserDTO {');
    expect(dtoContent).toContain('private String username;');
  });
});
