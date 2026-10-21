# 开发环境与首次检查

本指南服务于现有源码布局，不要求先迁移目录。协作流程见根目录 CONTRIBUTING，当前任务与验收见 TASKS/项目进度。

## 最小环境

| 工具 | 离线检查要求 | 说明 |
|---|---|---|
| Git | 加入 PATH | 检查使用纳管文件清单，ZIP 未必包含 Git 元数据 |
| Python | 3.11+ | 只用标准库；本轮实测 3.14.7 |
| Node.js | 24+ | 统一服务使用 node:sqlite，管理数据模型测试读取 TS；本轮基线 24.16.0 |
| PowerShell | 可选 | 仓库备份脚本与本地隔离备份测试；没有时该项显示 SKIP |

在仓库根目录运行：

```text
python -B tools/repo/manage.py doctor
python -B tools/repo/manage.py map
python -B -m unittest discover -s tools/repo -p "test_*.py"
python -B tools/repo/manage.py check --profile smoke
python -B tools/repo/manage.py check --profile service
```

也可从其他目录用 manage.py 的绝对路径执行；它自行定位仓库根，不依赖 E 盘路径。命令不扫描用户目录、不加载 .env、不读取签名配置，不安装依赖、不生成资产、不执行迁移/部署。服务测试会启动本机回环 HTTP、使用内存/临时数据库、模拟 APNs，并生成一次性测试签名材料，不连接真实 Apple 或学校。

doctor 默认退出 0 仅表示已具备离线检查的工具与源码地图入口。它会单列 BLOCKED/LOCAL ONLY。检查已知生成输入时使用：

```text
python -B tools/repo/manage.py doctor --require-generator-inputs
```

当前小程序四份历史输入未入 Git，此命令预期退出 1；本机恰好有文件也会标 LOCAL ONLY 并失败，不能将其误算为可复现。清单仅覆盖已确认的关键依赖，不代替完整生成试验。

## 不同工作所需环境

| 工作 | 当前可执行 | 尚缺或另需配置 |
|---|---|---|
| 共享网页逻辑 | smoke 选定回归，不需要 npm 安装 | 完整 DOM/浏览器检查另需 jsdom/浏览器；不假设旧 outputs 的 node_modules 存在 |
| 统一服务 | service 跑 package.json 中四组现有测试，无第三方 npm 依赖 | 正式运行/迁移需要受控配置；不要运行旧部署脚本来准备环境 |
| 管理网页 | smoke 包含 5 项模型检查 | 工程目录 npm ci 后 npm test / npm run build；完整浏览器检查按工程 README |
| Android | 可验证选定网页逻辑 | 无干净检出验证的独立 Debug 构建；正式脚本仍依赖签名、SDK/Java/ZXing 本机路径，缺 Gradle Wrapper |
| iOS | 扫码 JS 与资源对照 | macOS/Xcode/正确 target；旧 check.py 等部分检查仍有本机路径，不包含在新基线 |
| 小程序 | 已有生成工程保留纳管 | 四份源输入需安全提取/核对后补齐，官方预览还需开发者工具/受控凭证 |

不需要为了参加开发取得学校账号、正式签名或生产数据库。完整 Debug 构建是后续独立阶段；这里提供的是可执行的离线回归基线。

## 问题如何定位

- FAIL: Missing/untracked mapped entry：先看 [源码地图](source-map.md)，确认文件被误删、未暂存、被忽略，还是路径迁移后未同步清单。
- BLOCKED regeneration：不要补拷整个私人工作区；按明确文件范围审查、脱敏并补齐合法输入。
- 单项检查失败：入口保留子进程失败状态，先定位对应专项检查，不通过跳过或改成成功码掩盖。
- Node/Git 找不到：修正当前终端 PATH；工具不使用他人电脑上的硬编码替代路径。
- PowerShell 测试 SKIP：其余 Python/Node 通过不代表备份脚本通过；在可用 PowerShell 的环境单独复验。

当前公开性、账号方案、成员权限、Actions 云端运行和分支保护不由本地命令推断。后续流程见 [CONTRIBUTING](../../CONTRIBUTING.md)，目录整理见 [迁移计划](migration.md)。
