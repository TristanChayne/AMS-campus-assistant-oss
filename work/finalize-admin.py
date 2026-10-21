from pathlib import Path
p=Path('work/prepare-tencent.cjs');s=p.read_text(encoding='utf-8-sig').replace("envVariables:{...secrets,ADMIN_EMAIL:'2689232641@qq.com',TCB_ENV:","envVariables:{SIGNING_KEY:secrets.SIGNING_KEY,CODE_PEPPER:secrets.CODE_PEPPER,SESSION_SECRET:secrets.SESSION_SECRET,TCB_ENV:")
s=s.replace("fs.readFileSync('outputs/ams-activation/public/'+name", "fs.readFileSync('outputs/ams-activation-tencent/public/'+name")
p.write_text(s,encoding='utf-8')
p=Path('outputs/ams-activation-tencent/README.md');s=p.read_text(encoding='utf-8-sig');s+='''

## 手机管理和修改账户

手机或电脑浏览器打开上述 `/admin` 地址。用原账户名、密码登录，点击“账户设置”。输入新的账户名、当前密码；新密码留空可只改账户名，填写新密码时需要确认，两次一致且至少 10 个字符。保存后管理会话全部失效，需要重新登录。App 激活码、已有安装凭证及学校登录状态不受影响。

账户信息在私有 `admin_credentials` 表中持久保存，密码为随机盐 + PBKDF2-SHA256（210,000 次）摘要。首次迁移使用现有密码，后续部署不会覆盖用户修改。原管理员登录信息文本文件不会随网页修改自动更新，请自行保存新的登录信息。

验证：账户名/密码更改、只改账户名、当前密码错误、密码长度、请求来源、旧会话失效、新账户登录及激活记录保持不变均有隔离数据库检查。线上已验证原账户正常登录、读取账户信息、错误当前密码拒绝，新账户设置未代替用户实际修改。
''';p.write_text(s,encoding='utf-8')
