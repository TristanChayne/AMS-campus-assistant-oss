from pathlib import Path
import json, random, html
out=Path('outputs/daily-lines');out.mkdir(exist_ok=True)
contexts=['赶早九的路上，','翻开新的一页时，','走进教室之前，','课间的十分钟里，','等电梯的时候，','从图书馆出来时，','刚结束一节课时，','准备开始作业时，','今天有点忙的话，','今天没那么忙的话，','遇到一道难题时，','计划被打乱的时候，','觉得自己进步很慢时，','等一份喜欢的饭的时候，','背着书包往前走时，','下课铃响起之后，','准备收工的时候，','看见窗外的光时，','想给自己打气时，','不知道从哪开始时，']
middles=['先别急着给今天下结论。','不必一下子把所有事做好。','把注意力交给眼前这一小步。','允许自己比计划慢一点。','认真过的一分钟，也算数。','有些答案需要多见几次面。','休息不是把努力撤回。','今天也可以有自己的节奏。','小小的进展，不需要盛大的开场。','不懂的地方值得问出来。','还没完成，不等于没有在前进。','先开始，再慢慢调整。','不需要把每一刻都变成成绩。','照顾好自己，也是正经事。','绕了一点路，也许会多看见一点风景。','今天的你，不必复制昨天的状态。','给自己留一点试错的空间。','能做好的那一点，就先做好那一点。','生活可以认真，也可以松弛。','别把暂时卡住，当成永远不会。']
tails={
'轻松一下':['早餐不是签到的附赠品，记得吃。','书包已经替你负重了，心情就轻装一点吧。','今天的咖啡负责提神，你负责别空腹。','知识可以慢慢消化，午饭请趁热。','让进度条走一点，也让水杯见一次底。','先救文档，再救世界：记得保存。','脑子加载中，也可以先伸个懒腰。','别和电量比赛谁先见底。','今天的任务很多，但你不是多核处理器。','对待自己，别比老师批作业还严格。'],
'温柔提醒':['喝口水，再接着来。','肩膀放松一点，呼吸也放慢一点。','记得把休息写进计划。','有空抬头看看天。','累的时候，先把自己安顿好。','留一点时间，给喜欢的小事。','今天也值得吃一顿好饭。','睡眠不该永远排在最后。','如果需要帮助，就找一个愿意听的人。','把步子走稳，比一直赶路更重要。'],
'一点鼓励':['先完成一个小目标，就很好。','给那个愿意再试一次的自己一点掌声。','今天学会的一点，明天还能接着用。','把问题拆小，路会清楚一点。','迈出的这一步，不需要和别人比较。','你可以从最容易的一件事开始。','做过的练习，会慢慢变成底气。','遇到不会的，也是在发现下一步。','进步有时安静，但并没有消失。','今天认真过，就有值得记住的地方。'],
'校园碎碎念':['课间走两步，换个风景再回来。','给笔记留一行，写下真正想问的问题。','愿今天的教室不难找，座位也刚刚好。','下次提问前，不妨先把疑惑写下来。','午后的阳光很好，有空去看一眼。','课本之外，也留一点好奇心。','在匆忙的一天里，给朋友一个笑脸。','记住一件新鲜的小事，也算今天的收获。','图书馆里的努力，也需要回家的路。','结束一节课以后，允许自己缓口气。'],
'不那么严肃':['给今天打分之前，先给自己加个友好分。','效率偶尔掉线，生活仍然在线。','待办清单很长，先不要被它吓到。','今天先做一个会保存文件的人。','偶尔发会儿呆，不必写检讨。','如果思路打结了，出去走走再回来。','认真学习之外，也认真挑一下晚饭。','没有满分的一天，也可以有不错的晚上。','允许计划修改，纸和你都不用那么紧张。','这一天不是竞速赛，可以换挡。']}
rows=[]
for a in contexts:
 for b in middles:
  for tag,ends in tails.items():
   for c in ends:rows.append({'text':a+b+c,'category':tag})
assert len(rows)==20000 and len({x['text'] for x in rows})==20000
random.Random(20261005).shuffle(rows)
for i,r in enumerate(rows):r['id']=i+1
(out/'每日一句-20000条草稿.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'每日一句-20000条草稿.txt').write_text('\n'.join(f"{r['id']:05d} [{r['category']}] {r['text']}" for r in rows),encoding='utf-8-sig')
(out/'抽样预览-100句.md').write_text('# 每日一句 · 100 句抽样\n\n这是一份由原创短句素材组合生成的批量草稿，共 20,000 条不同文本，并非 20,000 条逐句独立创作。句式和素材会重复；先确认语气和风格，再筛选精修并接入应用。不借用名人署名。\n\n'+ '\n\n'.join(f"{i+1}. **{r['category']}**　{r['text']}" for i,r in enumerate(rows[:100])),encoding='utf-8')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>每日一句 · 句库审核</title><style>body{margin:0;background:#f5f6f8;color:#18233a;font:15px/1.8 system-ui,sans-serif}main{max-width:780px;margin:auto;padding:36px 22px}h1{font-size:28px;margin:0}p{color:#69758a}select,button,input{font:inherit;padding:9px 14px;border:1px solid #e1e6ed;border-radius:12px;background:white;color:inherit}button{cursor:pointer}#sample{background:white;border:1px solid #e1e6ed;border-radius:20px;padding:28px;margin:24px 0}small{color:#69758a}blockquote{margin:10px 0;font-size:19px;line-height:1.8}#list article{padding:15px 0;border-bottom:1px solid #e1e6ed}.controls{display:flex;gap:8px;flex-wrap:wrap}</style><main><small>CAMPUS DAY / 每日一句</small><h1>轻松一点，也认真一点</h1><p>20,000 条素材组合草稿，句式会重复。先看语气和风格，暂未接入 App。</p><div class="controls"><select id="category"><option value="">全部风格</option></select><input id="search" placeholder="搜索句子"><button id="shuffle">换一组</button></div><section id="sample"><small>首页底部呈现示意 · 每天固定一句</small><blockquote id="quote"></blockquote></section><div id="list"></div><p id="count"></p></main><script>const rows=DATA;const cat=document.getElementById('category'),search=document.getElementById('search');for(const tag of [...new Set(rows.map(x=>x.category))]){const o=document.createElement('option');o.value=tag;o.textContent=tag;cat.append(o);}function render(){const filtered=rows.filter(x=>(!cat.value||x.category===cat.value)&&x.text.includes(search.value));const offset=Math.floor(Math.random()*Math.max(1,filtered.length-20));const chosen=filtered.slice(offset,offset+20);const list=document.getElementById('list');list.replaceChildren();document.getElementById('quote').textContent=chosen[0]?.text||'没有匹配的句子';for(const x of chosen){const el=document.createElement('article'),s=document.createElement('small'),p=document.createElement('div');s.textContent='#'+x.id+' · '+x.category;p.textContent=x.text;el.append(s,p);list.append(el);}document.getElementById('count').textContent='匹配 '+filtered.length+' 条 · 当前显示 '+chosen.length+' 条';}cat.onchange=render;search.oninput=render;document.getElementById('shuffle').onclick=render;render();</script></html>'''.replace('DATA',json.dumps(rows,ensure_ascii=False).replace('</','<\\/'))
(out/'句库预览.html').write_text(page,encoding='utf-8')
print('Created 20,000 unique draft texts, five categories, 100-line review sample and interactive reader.')
