# AMS 激活模块与旧入口兼容

此目录目前仍是统一服务复用的激活源码及兼容入口来源，不应按名称当作完全独立的新服务。当前服务部署构成见 [ams-notify](../ams-notify/README.md)。

- `src/worker.mjs`、`review-demo.mjs`、`review-seed.mjs`、`ios-public-config.mjs` 与 `schema.sql` 被统一服务部署脚本放入 Docker 上下文的 `activation/`。
- `proxy/` 为旧入口兼容代码；移动或删除前须核对已安装旧客户端及现行服务依赖。
- `function/` 是历史平台打包产物，不是业务修改入口。
- `schema.sql` 是结构来源；生产数据库、签名/pepper/会话材料不进 Git，不因目录整理重新初始化。

仓库根目录运行 `python -B tools/repo/manage.py check --profile service` 可验证统一服务与激活模块的既有合成测试，无需真实管理员或云端登录。

不要在新开发环境运行旧导入、迁移或部署脚本。当前协议见 [API 契约](../ams-admin/API-CONTRACT.md) 与根目录 DECISIONS；部署/兼容验收看 TASKS/项目进度与相关PR。[腾讯云历史记录](../../docs/history/activation-tencent-notes.md) 仅保留当时证据，不能当作当前拓扑。
