from pathlib import Path
p=Path('work/build-live-ui.py');s=p.read_text(encoding='utf-8').replace('currentUser.userName||currentUser.username||currentUser.account','currentUser.account||currentUser.userName||currentUser.username');p.write_text(s,encoding='utf-8')
p=Path('work/live-ui.html');s=p.read_text(encoding='utf-8');Path('work/check-child-ui.js').write_text(s.split('<script>')[1].split('</script>')[0],encoding='utf-8')
p=Path('outputs/ams-android/README.md');s=p.read_text(encoding='utf-8-sig');s+='\n\n0.10.3（versionCode 16）：首页右上角设置入口，展示学校 account，退出并清理本地登录和缓存；三种主题色持久保存；按扫码/Code 来源显示失败重试按钮；底部导航胶囊反馈；出勤率数字下移。创作者署名待确定。构建签名与模拟路由验证通过，手机及真实签到仍需验证。\n';p.write_text(s,encoding='utf-8')
