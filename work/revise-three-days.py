from pathlib import Path
p = Path('outputs/timetable-preview/index.html')
s = p.read_text(encoding='utf-8-sig')
changes = {
    'Array.from({length:7}': 'Array.from({length:3}',
    "${['一','二','三','四','五','六','日'][i]}": "${['今天','明天','后天'][i]}",
    '<b>${d}</b>': '<b>10 月 ${d} 日</b>',
    "${all.length?'今天的课都结束了':'这一天没有排课'}": "${all.length?'今天的课都结束了':available?'这一天没有排课':'这天的课表尚未读取'}",
    "${all.length?'收好课本，留一点时间给自己。':'可以看看其他日期的安排。'}": "${all.length?'收好课本，留一点时间给自己。':available?'可以看看其他日期的安排。':'读取完成前，不代表当天没有课程。'}",
}
for before, after in changes.items():
    assert before in s, before
    s = s.replace(before, after)
p.write_text(s, encoding='utf-8')
