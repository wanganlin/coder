import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeFiles } from './index.js';
import { type FileOutput } from '../engine/index.js';

describe('File Writer Output Module with Protected Regions (T7)', () => {
  const testOutputDir = resolve(process.cwd(), 'test-output-dir');

  beforeEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('should write files wrapped in protection markers and auto-create parent directories', () => {
    const files: FileOutput[] = [
      {
        outputPath: 'pom.xml',
        content: 'pom-xml-mock-content',
        language: 'java',
      },
      {
        outputPath: 'src/main/java/com/example/App.java',
        content: 'app-java-mock-content',
        language: 'java',
      },
    ];

    const written = writeFiles(testOutputDir, files);

    expect(written.length).toBe(2);
    expect(existsSync(resolve(testOutputDir, 'pom.xml'))).toBe(true);
    expect(existsSync(resolve(testOutputDir, 'src/main/java/com/example/App.java'))).toBe(true);

    const pomContent = readFileSync(resolve(testOutputDir, 'pom.xml'), 'utf-8');
    expect(pomContent).toContain('pom-xml-mock-content');
    expect(pomContent).toContain('CODER_GENERATED_START');
    expect(pomContent).toContain('CODER_GENERATED_END');

    const javaContent = readFileSync(resolve(testOutputDir, 'src/main/java/com/example/App.java'), 'utf-8');
    expect(javaContent).toContain('app-java-mock-content');
    expect(javaContent).toContain('CODER_GENERATED_START');
  });

  it('should preserve user code outside markers on re-generation', () => {
    // 首次写入
    writeFiles(testOutputDir, [
      { outputPath: 'Service.java', content: 'generated-v1', language: 'java' },
    ]);

    const servicePath = resolve(testOutputDir, 'Service.java');
    expect(existsSync(servicePath)).toBe(true);

    // 模拟用户添加手写代码到标记外
    const existingContent = readFileSync(servicePath, 'utf-8');
    const userCode = '\n// 👇 手写业务代码\npublic void customMethod() {}\n';
    const modifiedContent = existingContent + userCode;
    writeFileSync(servicePath, modifiedContent, 'utf-8');

    // 再次生成
    writeFiles(testOutputDir, [
      { outputPath: 'Service.java', content: 'generated-v2', language: 'java' },
    ]);

    const updatedContent = readFileSync(servicePath, 'utf-8');
    // 新生成的内容应该在标记内
    expect(updatedContent).toContain('generated-v2');
    // 用户手写代码应该保留
    expect(updatedContent).toContain('customMethod');
    // 旧版本内容不应存在
    expect(updatedContent).not.toContain('generated-v1');
  });

  it('should backup existing files before overwriting when no markers found', () => {
    mkdirSync(testOutputDir, { recursive: true });
    writeFileSync(resolve(testOutputDir, 'legacy.txt'), 'old-handwritten-code', 'utf-8');

    writeFiles(testOutputDir, [
      { outputPath: 'legacy.txt', content: 'new-generated', language: 'java' },
    ]);

    expect(existsSync(resolve(testOutputDir, 'legacy.txt.bak'))).toBe(true);
    expect(readFileSync(resolve(testOutputDir, 'legacy.txt.bak'), 'utf-8')).toBe('old-handwritten-code');
  });
});
