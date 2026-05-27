import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeFiles } from './index.js';
import { type FileOutput } from '../engine/index.js';

describe('File Writer Output Module (T7)', () => {
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

  it('should write files and auto-create parent directories', () => {
    const files: FileOutput[] = [
      {
        outputPath: 'pom.xml',
        content: 'pom-xml-mock-content',
      },
      {
        outputPath: 'src/main/java/com/example/App.java',
        content: 'app-java-mock-content',
      },
    ];

    const written = writeFiles(testOutputDir, files);

    expect(written.length).toBe(2);
    expect(existsSync(resolve(testOutputDir, 'pom.xml'))).toBe(true);
    expect(existsSync(resolve(testOutputDir, 'src/main/java/com/example/App.java'))).toBe(true);

    expect(readFileSync(resolve(testOutputDir, 'pom.xml'), 'utf-8')).toBe('pom-xml-mock-content');
    expect(
      readFileSync(resolve(testOutputDir, 'src/main/java/com/example/App.java'), 'utf-8'),
    ).toBe('app-java-mock-content');
  });
});
