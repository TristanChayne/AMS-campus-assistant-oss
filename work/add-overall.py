from pathlib import Path
p=Path('work/build-live-ui.py');s=p.read_text(encoding='utf-8-sig')
s=s.replace('list:pick(result.data),loading:false','list:pick(result.data),overallAttendance:route===\'/course\'?result.data.comprehensiveAttendance:undefined,overallWarning:route===\'/course\'?result.data.thresholdFlag:undefined,loading:false')
s=s.replace("const data={route,signMethod:","const data={route,overallAttendance:cache['/course']&&cache['/course'].overallAttendance,overallWarning:cache['/course']&&cache['/course'].overallWarning,signMethod:")
s=s.replace("+list.map(attendanceCard).join('')","+attendanceOverview(page)+list.map(attendanceCard).join('')")
s=s.replace('0.11.2','0.11.3');p.write_text(s,encoding='utf-8')
p=Path('work/managed-leave-child.js');s=p.read_text(encoding='utf-8-sig');s+='''
function attendanceOverview(data){const raw=data.overallAttendance,n=Number(raw),valid=raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(n)&&n>=0&&n<=100;return `<section class="attendance-overview" aria-label="综合出勤率"><div><p>本学期 · 综合出勤率</p><strong>${valid?escape(n+'%'):'—'}</strong><small>${valid?'学校统计的所有课程综合数据':'正在读取学校综合统计'}</small></div><div class="overall-track" aria-hidden="true"><i style="height:${valid?n:0}%"></i></div>${data.overallWarning?'<p class="overall-warning">学校出勤预警，请查看课程明细</p>':''}</section>`;}
''';p.write_text(s,encoding='utf-8')
p=Path('work/managed-ui-polish.css');s=p.read_text(encoding='utf-8-sig');s+='''
.attendance-overview{border-radius:20px;background:var(--campus-blue);color:white;padding:23px;margin:0 0 16px;position:relative;display:flex;gap:20px;justify-content:space-between;flex-wrap:wrap}.attendance-overview p{font-size:12px;margin:0 0 12px;color:#d0dbef}.attendance-overview strong{display:block;font-size:36px;font-weight:650;line-height:1.1;font-variant-numeric:tabular-nums}.attendance-overview small{display:block;font-size:11px;margin-top:12px;color:#d0dbef}.overall-track{height:86px;width:9px;border-radius:6px;overflow:hidden;background:#ffffff25;align-self:center;display:flex;align-items:flex-end}.overall-track i{width:100%;background:#c5d7f5;border-radius:6px}.attendance-overview .overall-warning{width:100%;margin:0;font-size:11px;color:#ffe0c7}
''';p.write_text(s,encoding='utf-8')
for name in ['outputs/ams-android/build-local.ps1','outputs/ams-android/app/build.gradle']:
 p=Path(name);s=p.read_text(encoding='utf-8-sig').replace('0.11.2','0.11.3').replace("'--version-code','21'","'--version-code','22'").replace('versionCode 21','versionCode 22');p.write_text(s,encoding='utf-8-sig' if name.endswith('.ps1') else 'utf-8')
