# AMS Android 工程

Java + WebView；包名、SDK 和版本以 `app/build.gradle`、`AndroidManifest.xml` 与实际包核验为准。历史安装包不由文件名确定内容。

- 原生源码：`app/src/main/java/cn/local/ams`。
- 网页资源：`app/src/main/assets`；`ams-modern-ui.js` 等由生成器输出，部分预约 JS 是手写源码，不能一概视为生成文件。[源码地图](../../docs/development/source-map.md) 列出修改入口。
- 无凭证本地检查：在仓库根目录运行 `python -B tools/repo/manage.py check --profile smoke`。这是逻辑检查，不生成 APK。
- 正式构建：现有 `build-local.ps1` 依赖维护者的签名配置、SDK/Java/ZXing 路径；新成员不应运行它索取或替换正式签名。Gradle 配置存在，但仓库尚无 Wrapper 和经过干净环境验证的独立 Debug 构建入口。

开发构建与正式签名分离是后续任务，不能将本阶段离线检查当作该项完成。[开发指南](../../docs/development/README.md) 说明现有环境限制。

当前功能任务与手机验收见根目录 TASKS/项目进度；本轮整理不变更应用版本、资源或已有包。[历史开发记录](../../docs/history/android-development-notes.md) 保留原 README，不作为现行构建说明。
