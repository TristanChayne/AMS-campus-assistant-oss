# 版本与阶段备份

当前私有协作仓库：[AMS 校园助手](https://github.com/TristanChayne/AMS-campus-assistant)。本地集成目录：E:/Codex/AMS-campus-assistant。

新仓库从整理后的源码建立独立初始提交，不继承旧 Git 历史。初始源码标签为 repo-stage-1；它记录源码起点，不代表新 App 构建、发布或设备验收。

完成阶段后，先审阅本任务差异、运行对应检查并更新 TASKS.md/项目进度.md（决定改变时另更新 DECISIONS.md），只暂存本阶段源码和公共记录。

```powershell
# 仓库整理阶段示例：先核对本地与远端标签，再选择尚未使用的编号
.\work\git\Backup-Version.ps1 -Platform repository -Stage 2 -Summary '本阶段完成内容与验证结果'
# 应用阶段参数格式保留；VERSION、BUILD和STAGE由协调方按真实版本分配
# .\work\git\Backup-Version.ps1 -Platform android -Version VERSION -Build BUILD -Stage STAGE -Summary '完成摘要'
```

脚本只提交已暂存文件，创建不可覆盖的注释标签，原子推送当前分支与指定标签，再核对远端引用。上传失败时分别记录本地与云端结果，保留本地提交后重试。

若 main 要求 PR，先将实施与公共记录通过集成 PR 合入，更新本地干净 main 后，再在最终提交建立标签；不绕过分支保护。任务分支推送不等于已集成，源码标签不等于商店/服务器发布。

签名、会话、密钥、数据库、私人接手资料及本地产物不加入 Git。新目录须审阅忽略规则。新库只推送当前任务分支及明确分配的标签，不使用 mirror/all/tags 批量推送，也不合并旧库分支；未集成的必要改动由维护者按文件/补丁重新审阅提交。
