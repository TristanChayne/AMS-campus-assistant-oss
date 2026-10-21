from pathlib import Path
p=Path('outputs/sign-result-preview/index.html');s=p.read_text(encoding='utf-8-sig')
s=s.replace('>签到成功</button><button data-mode="scan"','>扫码成功</button><button data-mode="codeSuccess" aria-pressed="false">Code 成功</button><button data-mode="scan"')
s=s.replace('grid-template-columns:repeat(3,1fr)','grid-template-columns:repeat(2,1fr)')
s=s.replace("scan:{title:'签到未完成'","codeSuccess:{title:'签到成功',message:'这节课已完成签到。',icon:'<path d=\"M9 19l7 7 15-16\"/>',action:'返回课表'},scan:{title:'签到未完成'")
s=s.replace("success=mode==='success'","success=mode==='success'||mode==='codeSuccess'")
s=s.replace("'<div><dt>签到时间</dt><dd>15:08:26</dd></div>'","'<div><dt>签到方式</dt><dd>'+(mode==='codeSuccess'?'Code 签到':'扫码签到')+'</dd></div><div><dt>签到时间</dt><dd>15:08:26</dd></div>'")
s=s.replace("current==='success'?'演示：返回课表'","(current==='success'||current==='codeSuccess')?'演示：返回课表'")
p.write_text(s,encoding='utf-8')
assert 'data-mode="codeSuccess"' in s and "mode==='codeSuccess'?'Code 签到'" in s
print('Added Code success state with matching sign-in method and return action.')
