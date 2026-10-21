from pathlib import Path
import json,hashlib,re
p=Path('outputs/school-capture-20261011');m=json.loads((p/'manifest.json').read_text(encoding='utf-8'))
for f in p.glob('*.html'):
 t=f.read_text(encoding='utf-8');t=re.sub(r'\son[a-z]+=("[^"]*"|\x27[^\x27]*\x27)','',t,flags=re.I);t=re.sub(r'\saction=("[^"]*"|\x27[^\x27]*\x27)',' action="#"',t,flags=re.I);f.write_text(t,encoding='utf-8')
required=['home','attendance','attendance-detail','attendance-code-form','leave-list','leave-form','leave-type-options','leave-course-selection','bus-home','bus-schedule','bus-schedule-next-day','bus-authenticated-home','bus-bookings','seat-home','seat-floor','seat-records','room-home','room-timeline','room-records']
assert set(required)<={x['name'] for x in m['pages']}
violations=[]
for f in p.glob('response-*.json'):
 t=f.read_text(encoding='utf-8')
 if any(s in t for s in ['Chengjunyan','2580505','田成俊彦','田成俊艳']):violations.append(f.name)
 if re.search(r'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',t):violations.append(f.name)
 def check(v):
  if isinstance(v,dict):
   for k,x in v.items():
    if re.search(r'token|cookie|password|openid|authorization|captchaKey|accName|accNo|userid',k,re.I) and x not in (None,'','[REDACTED]'):violations.append(f.name+':'+k)
    check(x)
  elif isinstance(v,list):
   for x in v:check(x)
 check(json.loads(t))
assert not violations,violations
m['requestContractCount']=len(json.loads((p/'request-contracts.json').read_text(encoding='utf-8')));m['uploaded']=False
(p/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
report={'passed':True,'pages':len(m['pages']),'responseFixtures':len(m['responses']),'requestContracts':m['requestContractCount'],'assets':len(m['assets']),'authenticatedQrPayloadCaptured':False,'realBusinessSubmissionPerformed':False,'uploaded':False,'checks':['expected page inventory','known account identifiers absent from JSON','JWT patterns absent from JSON','sensitive fields redacted','HTML scripts/inline handlers removed; forms inert']}
(p/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
readme='''# 学校页面采集记录 — 2026-10-11

本轮只读取已登录账号的页面及查询结果。没有提交签到、请假、预约、取消，也没有获取或保存有效通行二维码。资料暂存本地，未上传腾讯云。

## 已采集

- 课表、签到记录汇总、课程签到详情、签到码输入表单。
- 请假列表、申请表、类型选项、课程选择页及查询接口。
- 区间车首页、当天/次日班次、已登录首页、预约列表。
- 座位预约首页、7楼座位图、预约记录页、开放时段与规则接口。
- 讨论室首页、3楼时间轴、预约记录页、资源与规则接口。
- 西浦码公开登录方式配置；正式二维码界面可继续复用已有 iOS 原生实现。

## 证据与边界

19 个页面状态、26 份去重后的接口响应、45 条已观察请求结构、57 项网页脚本/样式/字体资料。详情见 manifest.json、request-contracts.json、validation.json。

这是开发采集材料，不是已经接通的演示软件。浏览器自动翻译影响部分 DOM 文案；正式界面应继续使用现有 App UI，查询数据和源脚本用于接口对接参考。部分早期响应/资源未能取得正文，清单中保留缺口。

当前查询范围内请假、区间车、座位、讨论室均没有自己的申请/预约记录。没有为了补充数据创建真实记录。因此提交成功、已批准/拒绝、取消及车票详情状态，需要在独立演示服务器中依据学校前端合同制作测试记录并验证，不能宣称已从真实账号采集这些状态。

公开二维码登录配置并不证明通行码已登录或获取成功。有效通行码不应进入演示材料。宿舍码独立慧湖通绑定/取码接口此次未采集；需要单独核对该功能是否属于 iOS 交付范围。

账号姓名、账号名、学号、联系方式与授权字段已脱敏；认证响应和验证码数据已删除。原样复制网页登录会话没有包含在本资料中。

## 后续服务器工作

先建立受专用激活码保护的独立演示会话和持久状态接口，再导入脱敏资料。演示请求必须限制在自有服务器，原学校 JS 不能直接作为可执行演示页面原样发布。图片地图及资源来源需要依据清单核对并改成本地资源。模拟写操作需要完整返回对象及记录查询，不能仅回传成功提示。
'''
(p/'采集说明.md').write_text(readme,encoding='utf-8')
files={str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in p.rglob('*') if f.is_file() and f.name!='sha256.json'}
(p/'sha256.json').write_text(json.dumps(files,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
