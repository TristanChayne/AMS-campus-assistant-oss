"""Publish only selected non-personal school structures, never captured history/auth."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
capture=root/'outputs/school-capture-20261011'
days=json.loads((capture/'response-4.json').read_text(encoding='utf-8'))['data']
courses=[]
for day_index,day in enumerate(days[:3]):
    for item in day['timetableVoList']:
        courses.append({**{k:item[k] for k in ['moduleCode','moduleTitle','moduleTime','location','room','moduleTypeGroup']},'id':'demo-course-'+str(len(courses)+1),'dayOffset':day_index})
seats=json.loads((capture/'response-46.json').read_text(encoding='utf-8'))['data']
resources=[{'id':'seat-'+str(i+1),'name':s['devName'],'coordinate':s.get('coordinate'),'kind':'seat','minMinutes':60,'minPeople':1,'maxPeople':1} for i,s in enumerate(seats)]
resources += [{'id':'room-'+name,'name':name,'kind':'room','minMinutes':60,'minPeople':2,'maxPeople':5} for name in ['314','316','318']]
seed={'schemaVersion':2,'student':'演示同学','courses':courses,'resources':resources,'leaveTypes':['Illness','Personal','Other'],'busTimes':['07:30','08:30','11:00','17:10','18:00'],'notice':'演示环境：操作仅保存在演示服务器，不会提交到学校；二维码不能用于真实通行。'}
out=root/'outputs/ams-activation-tencent/src/review-seed.mjs'
out.write_text('export default '+json.dumps(seed,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print(f'Published safe seed: {len(courses)} course slots, {len(resources)} resources; no personal attendance or credentials.')
