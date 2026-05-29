export interface SkeletonTemplateConfig {
  template: string; // 模板路径，相对于插件目录，例如 "skeleton/pom.xml.hbs"
  output: string; // 输出路径模板，例如 "pom.xml" 或 "src/main/resources/application.yml"
}

export interface EntityTemplateConfig {
  template: string; // 模板路径，相对于插件目录，例如 "entity/Entity.java.hbs"
  output: string; // 输出路径模板，例如 "src/main/java/{{packagePath}}/entity/{{className}}.java"
  test?: boolean; // 标记为测试模板，仅当 features.unitTest 为 true 时生成
}

export interface PluginMetadata {
  name: string;
  language: string;
  paradigm: 'layered' | 'mvc' | 'lightweight';
  fileExtension: string;
  skeleton?: SkeletonTemplateConfig[];
  entityTemplates?: EntityTemplateConfig[];
}

export interface FileOutput {
  outputPath: string;
  content: string;
  /** 目标语言，用于保护区标记语法（java / go / python / php / typescript） */
  language?: string;
}
