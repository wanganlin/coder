# Spring Boot 3.5 模板

此目录将包含 Spring Boot 3.5 + JPA/Hibernate 6 的代码生成模板。

## 目录结构（计划）

```
spring-boot/
├── plugin.yml           # 插件元数据
├── skeleton/            # 项目骨架层（一次性生成）
│   ├── pom.xml.hbs
│   ├── application.yml.hbs
│   └── Application.java.hbs
├── entity/              # 实体层（每表生成）
│   ├── Entity.java.hbs
│   ├── Repository.java.hbs
│   ├── Service.java.hbs
│   ├── Controller.java.hbs
│   └── DTO.java.hbs
└── partials/            # 可复用代码片段
    ├── pagination.hbs
    ├── exception-handler.hbs
    └── base-entity.hbs
```
