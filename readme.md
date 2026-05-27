<div align="center">

# ⚡ Coder

**以数据模型为中心的多语言多框架代码生成引擎**

面向后端工程师和全栈开发者，从数据库表结构出发，一键生成高质量、可维护、符合团队规范的全栈代码。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

</div>

---

## 🎯 为什么需要 Coder？

市面上不缺代码生成器（JHipster、MyBatis Generator、OpenAPI Generator……），但它们各有硬伤：

| 痛点 | 现有工具 | Coder 的解法 |
|------|----------|-------------|
| 绑定单一技术栈 | JHipster → Spring 生态 | 同一组表，随时切换 Spring Boot 3.5 / Gin 1.12 / FastAPI 0.136 / Laravel 13 / NestJS 11 |
| 一次性生成、无法迭代 | 多数工具仅做脚手架 | **保护区机制** — 重新生成时只覆盖生成区，手写业务代码永远不丢 |
| 缺少前端联动 | 后端专用 | 同步生成 Vue3 + Element Plus 前端代码（表格页、表单页、API 调用封装） |
| 配置复杂、上手慢 | 学习成本高 | 零配置即可运行，YAML 按需定制 |

> **核心理念**：不做"终极万能生成器"，而做一个**高度可控、可持续维护的元数据驱动代码引擎**。标准化 CRUD 交给工具，核心业务逻辑交给你。

---

## ✨ 核心特性

- 🗄️ **数据库优先** — 直连 MySQL / PostgreSQL，自动读取表结构、注释、索引和外键；也支持从 DDL 文件导入
- 🌍 **多语言多框架** — 一套 Schema，一键切换生成 Java（Spring Boot 3.5）、Go（Gin 1.12）、Python（FastAPI 0.136）、PHP（Laravel 13）、TypeScript（NestJS 11）后端代码
- 🖥️ **前端同步生成** — 基于表元数据自动生成 Vue 3 + Element Plus 2.14 的表格页、表单页和 API 调用层
- 🧩 **插件化模板** — 每个框架封装为独立插件（Handlebars 模板集 + YAML 配置），支持社区分享和自定义
- 🔒 **保护区 & 增量生成** — 注释标记划分生成区与用户区，重新生成时只覆盖生成区，手写业务代码永远不丢
- 📊 **关联自动推导** — 根据外键生成 `@OneToMany`、`@ManyToMany` 实体关联和对应的联表查询方法
- 📝 **注释即文档** — 表注释 / 字段注释自动映射为代码注释和 OpenAPI 3.0 文档描述
- 🎨 **代码格式化** — 生成后自动调用目标语言格式化工具（Java: `google-java-format`、Go: `gofmt`、Python: `black`、PHP: `php-cs-fixer`、TS/前端: `prettier`）

---

## 🏗️ 架构设计

### 核心流水线

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  数据源输入   │ ──▶ │  统一 Schema 模型  │ ──▶ │  Handlebars 渲染  │ ──▶ │  目标代码输出   │
│              │     │                  │     │                  │     │                │
│ • MySQL      │     │ • 表/列/约束/索引 │     │ • 骨架层模板     │     │ • 格式化       │
│ • PostgreSQL │     │ • 类型映射       │     │ • 实体层模板     │     │ • 增量写入     │
│ • DDL 文件   │     │ • 命名策略       │     │ • 可复用 Partials │     │ • 保护区合并   │
│              │     │ • 扩展属性       │     │ • 自定义 Helpers  │     │ • 编译验证     │
└──────────────┘     └──────────────────┘     └──────────────────┘     └────────────────┘
```

### 统一 Schema 模型（中间表示层）

这是整个系统的**核心抽象** — 解耦数据源与代码模板：

| 元素 | 说明 |
|------|------|
| **基本信息** | 表名、原始表名、注释 |
| **列描述** | 列名、类型、长度/精度、可空性、默认值、注释、主键/自增标识 |
| **约束与索引** | 主键、唯一键、索引、外键及关联表信息 |
| **类型映射** | SQL 类型 → 各语言类型（如 `bigint` → Java `Long` / Go `int64` / Python `int`），映射规则在 YAML 中可覆盖 |
| **命名策略** | 原始 snake_case 保留，渲染时按目标语言自动转换：Java/TS/PHP 用 camelCase，Go 用 PascalCase，Python 用 snake_case |
| **扩展属性** | 显示名称、枚举标识、前端控件类型、脱敏规则等，通过 `coder.yml` 的 `extensions` 字段配置 |

### 分层模板架构

```
templates/
├── spring-boot/                 # Java 后端 (Spring Boot 3.5 + JPA/Hibernate 6)
│   ├── skeleton/                # 项目骨架层（pom.xml、目录结构、配置文件）
│   ├── entity/                  # 模块/实体层（Entity、Repository、Service、Controller）
│   └── partials/                # 代码片段（分页、异常处理、校验逻辑）
├── gin/                         # Go 后端 (Gin 1.12 + GORM 2.x)
├── fastapi/                     # Python 后端 (FastAPI 0.136 + SQLAlchemy 2.x)
├── laravel/                     # PHP 后端 (Laravel 13 + Eloquent)
├── nestjs/                      # TypeScript 后端 (NestJS 11 + TypeORM 0.3)
└── vue3-element/                # 前端 (Vue 3 + Element Plus 2.14)
```

### 框架范式归类

直接为每个框架硬编码模板不可持续，按**代码组织范式**归类，抽象公共生成步骤：

| 范式 | 适用框架 | ORM | 生成流 |
|------|---------|-----|--------|
| **分层架构** | Spring Boot 3.5、NestJS 11 | JPA/Hibernate 6、TypeORM 0.3 | Entity → Repository → Service → Controller → DTO |
| **MVC** | Laravel 13 | Eloquent ORM | Model → Controller → FormRequest → Resource |
| **轻量路由** | Gin 1.12、FastAPI 0.136 | GORM 2.x、SQLAlchemy 2.x | Model → Handler/Router → DB Query → Schema |

新增框架（如 Django、Ruby on Rails）时，只需适配已有范式 + 定制 ORM/校验 Partials 即可，无需从零编写整套模板。

---

## 🚀 快速开始

> ⚠️ 项目处于早期开发阶段，以下为目标用法示例。

### 安装

```bash
npm install -g @coder/cli
```

### 基本用法

```bash
# 1. 初始化配置（生成 coder.yml）
coder init

# 2. 从数据库生成代码
coder generate --db mysql://root:pass@localhost:3306/mydb --framework spring-boot

# 3. 从 DDL 文件生成
coder generate --input schema.sql --framework gin
```

### 配置示例（coder.yml）

```yaml
# coder.yml — 项目根目录下唯一配置文件
datasource:
  type: mysql                                   # 支持 mysql | postgresql
  url: mysql://root:pass@localhost:3306/mydb

target:
  framework: spring-boot                        # spring-boot@3.5 | gin@1.12 | fastapi@0.136 | laravel@13 | nestjs@11
  output: ./src/main/java                       # 代码输出目录

tables:
  include: ["user", "order", "product"]          # 指定表，留空则生成全部
  exclude: ["flyway_schema_history"]             # 排除表（如迁移记录表）

features:
  swagger: true              # 生成 OpenAPI 3.0 注解
  unitTest: true             # 生成单元测试骨架（JUnit 5 / pytest / Go testing）
  pagination: true           # 内置分页查询支持
  auditFields: true          # 自动识别 created_at / updated_by 并注入审计基类

extensions:                  # 扩展属性：为字段补充生成器无法从数据库推导的信息
  user:
    status:
      enum: ["ACTIVE", "INACTIVE", "BANNED"]    # 标记为枚举类型
      frontendWidget: select                     # 前端控件类型：input | select | datepicker | switch
    phone:
      desensitize: phone                         # 脱敏规则：phone | email | idcard
```

---

## 🔒 保护区机制

Coder 的核心竞争力之一：**支持反复生成而不覆盖你的业务代码**。

```java
public class UserService {

    // ==== GENERATED START: findById ====
    // ⚠️ 此区域由 Coder 自动生成，重新生成时会被覆盖
    public User findById(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }
    // ==== GENERATED END ====

    // 👇 你的业务代码写在生成区之外，永远不会被覆盖
    public UserDTO enrichWithPermissions(User user) {
        // 自定义业务逻辑...
    }
}
```

增量生成时，工具会：
1. 解析现有文件中的生成区标记
2. 仅更新生成区内容
3. 对比差异，只写入变更文件
4. 自动备份原文件以防不测

---

## 🗺️ 路线图

| 阶段 | 目标 | 核心交付 |
|------|------|----------|
| **Phase 1 — MVP** | 跑通完整流程 | MySQL / PostgreSQL 数据源 → 统一 Schema → Spring Boot 3.5（JPA）代码生成 → CLI 工具 |
| **Phase 2 — 扩展后端栈** | 验证多框架设计 | 新增 Gin 1.12、FastAPI 0.136、Laravel 13、NestJS 11 四套后端模板 |
| **Phase 3 — 体验完善** | 生产可用 | 保护区 & 增量生成、代码格式化、多表关联推导、审计字段识别、单元测试骨架 |
| **Phase 4 — 前端 & 文档** | 全栈覆盖 | Vue3 + Element Plus 前端生成、OpenAPI 3.0 文档导出、数据库迁移脚本 |
| **Phase 5 — 生态化** | 社区驱动 | 插件体系 & 模板市场、VSCode 插件、Web 可视化平台、社区模板贡献 |

---

## ⚠️ 设计边界

> Coder 解决的是**标准化、低价值、重复性高的 CRUD 和分层代码**。核心业务逻辑必须手写。

**需要注意的技术挑战**：

| 挑战 | 应对策略 |
|------|---------|
| 多语言 × 多框架 × 多数据库的组合爆炸 | 按范式归类 + Partials 复用；MVP 仅支持 MySQL + PostgreSQL、Spring Boot 一套后端栈，Phase 2 扩展至五套 |
| 数据库特性差异（PostgreSQL JSONB、MySQL ENUM 等） | Schema 模型中以 `rawType` 保留原始类型，类型映射表通过 `coder.yml` 可覆盖 |
| 生成代码可读性 | 按目标语言自动格式化 + 保留表/字段注释 + 按索引和外键生成语义化查询方法（如 `findByStatus`） |
| 模板维护成本 | 公共逻辑抽取为 Handlebars Partials（分页、异常处理、校验），新框架只需编写差异部分 |

---

## 🛠️ 技术选型

| 模块 | 技术 | 说明 |
|------|------|------|
| 运行时 | Node.js 20+ / TypeScript 5 | 跨平台，npm 生态丰富，方便分发 CLI |
| Schema 获取 | `mysql2`、`pg` | 直连数据库读取 `information_schema`，解析表/列/约束/外键 |
| DDL 解析 | `node-sql-parser` | 无需数据库连接，直接从 `.sql` 文件提取表结构 |
| 模板引擎 | Handlebars 4 + 自定义 Helpers | 逻辑简洁、易学习，通过 Helpers 扩展类型转换/命名转换等能力 |
| 代码格式化 | `google-java-format`、`gofmt`、`black`、`php-cs-fixer`、`prettier` | 按目标语言自动调用对应格式化工具 |
| 配置管理 | YAML（`coder.yml`） | 单一配置文件，定义数据源、表过滤、框架选择、扩展属性 |
| 编译验证 | `javac`、`go vet`、`mypy`、`php -l`、`tsc --noEmit` | 生成后自动运行静态检查，报错关联到模板便于调优 |

---

## 📦 目标框架版本

| 框架 | 版本 | 语言要求 | ORM / 数据层 |
|------|------|---------|-------------|
| Spring Boot | 3.5 (LTS) | Java 17+ | JPA / Hibernate 6 |
| Gin | 1.12 | Go 1.25+ | GORM 2.x |
| FastAPI | 0.136 | Python 3.10+ | SQLAlchemy 2.x + Pydantic 2 |
| Laravel | 13 | PHP 8.3+ | Eloquent ORM |
| NestJS | 11 | Node.js 20+ / TypeScript 5 | TypeORM 0.3 |
| Vue 3 + Element Plus | 3.x + 2.14 | TypeScript 5 | Axios |

> 版本基于 2026 年 5 月最新稳定版选定。Spring Boot 选择 3.5 LTS 而非 4.0，确保生态成熟度和企业兼容性。

---

## 🤝 Contributing

欢迎贡献！尤其是以下方向：

- 🌐 新框架模板（Django、Ruby on Rails、ASP.NET Core……）
- 🗄️ 新数据库适配（SQLite、Oracle、SQL Server……）
- 📖 文档和示例完善
- 🐛 Bug 修复和体验优化

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南（即将发布）。

---

## 📄 License

本项目采用 [MIT License](LICENSE) 开源。

---

<div align="center">

**当你的团队说"我们只是用这个工具搭了个架子，剩下的业务代码都是我们自己写的"——这就是 Coder 的成功。**

</div>