(() => {
 'use strict';
 const frame=document.getElementById('ams-managed-ui');let model,route='/home',courseIndex=0,query={},selected=[],form={},theme='blue',appearance='system',busy=false;
 const channel=(name,value)=>window.webkit?.messageHandlers?.[name]?.postMessage(value);
 const targetOrigin=location.protocol==='file:'?'*':location.origin,pending=new Map();
 window.__amsReviewResponse=(id,status,data)=>{const done=pending.get(id);if(done){pending.delete(id);done({ok:status===200,json:async()=>data});}};
 function api(path,data){if(!window.webkit?.messageHandlers?.amsReviewAPI)return fetch('/api/demo/'+path,{method:data?'POST':'GET',cache:'no-store',headers:data?{'Content-Type':'application/json','X-AMS-Demo':'1'}:{},body:data?JSON.stringify(data):undefined});return new Promise(resolve=>{const id=crypto.randomUUID();pending.set(id,resolve);channel('amsReviewAPI',{id,path,...(data?{data}:{})});});}
 const send=value=>frame.contentWindow.postMessage({amsUiData:value},targetOrigin);
 const notify=text=>send({notification:text,codeUnavailable:true});
 window.__amsDailyRows=[{text:'今天也要好好照顾自己。'}];
 const day=offset=>{const d=new Date(model.state.anchor+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)};
 function snapshot(){
  const cs=model.courses,days=[0,1,2].map(i=>({date:day(i).slice(5),fullDate:day(i),timetableVoList:cs.filter(c=>c.dayOffset===i).map(c=>({...c,status:model.state.attendance.some(r=>r.courseId===c.id)?1:0}))}));
  const data={route,days,courseReminder:window.__amsCourseReminder,list:[],ready:true,loading:false,leave:true,account:model.seed.student+' · 演示环境',theme,signMethod:'code',demo:model};
  if(route==='/course'){data.list=cs.filter((c,i)=>cs.findIndex(x=>x.moduleCode===c.moduleCode)===i).map(c=>{const rows=model.state.attendance.filter(r=>cs.find(x=>x.id===r.courseId)?.moduleCode===c.moduleCode);return {...c,classHour:rows.length,signClassHour:rows.length,leaveClassHour:0,absences:0,courseAttendance:rows.length?100:null}});data.overallAttendance=model.state.attendance.length?100:null;}
  if(route==='/course/sessions'){const c=snapshotCourses()[courseIndex];Object.assign(data,{query:{moduleCode:c.moduleCode,...query},courseTitle:c.moduleTitle,groups:[{name:c.moduleTypeGroup}],finished:true,list:model.state.attendance.filter(r=>cs.find(x=>x.id===r.courseId)?.moduleCode===c.moduleCode&&(!query.status||String(r.status)===query.status)&&(!query.date||r.date===query.date)&&(!query.moduleTypeGroup||r.moduleTypeGroup===query.moduleTypeGroup))});}
  if(route==='/leave')data.list=model.state.leaves;
  if(route==='/leaveApplication')Object.assign(data,{form,leaveTypes:model.seed.leaveTypes,leaveDays:form.startDate&&form.endDate?Math.round((Date.parse(form.endDate)-Date.parse(form.startDate))/86400000)+1:0,selectedCount:selected.length,minStart:model.state.anchor,maxStart:day(30),minEnd:form.startDate||model.state.anchor,maxEnd:day(30)});
  if(route==='/leaveCourse')Object.assign(data,{leaveCourseDays:days.filter(d=>d.fullDate>=form.startDate&&d.fullDate<=form.endDate).map(d=>({date:d.date,leaveModuleList:d.timetableVoList.map(c=>({...c,moduleCodeId:c.id,time:c.moduleTime,courseBox:selected.includes(c.id)}))})),coursesReady:true,courseSelected:selected,checkedAll:selected.length===cs.filter(c=>c.date>=form.startDate&&c.date<=form.endDate).length,dateRange:form.startDate+' 至 '+form.endDate});
  return data;
 }
 const snapshotCourses=()=>model.courses.filter((c,i,cs)=>cs.findIndex(x=>x.moduleCode===c.moduleCode)===i);
 function publish(){send(snapshot());}
 function go(next){route=next;publish();}
 window.__amsReviewReservation=service=>{if(['seat','room','sports','bus','records','seatRecords','roomRecords','home'].includes(service))go(service==='home'?'/reservations':'/review/'+({seatRecords:'records',roomRecords:'records'}[service]||service));};
 async function reload(){const response=await api('state'),data=await response.json();if(!response.ok)throw Error(data.message);data.currentLeave=model?.currentLeave;data.reviewReminder=model?.reviewReminder;model=data;publish();}
 async function operate(data){if(busy)return;busy=true;try{const response=await api('action',{...data,requestId:crypto.randomUUID()}),value=await response.json();if(!response.ok)throw Error(value.message);await reload();return true;}catch(error){notify(error.message||'演示服务器连接失败，请重试');return false;}finally{busy=false;}}
 window.__amsSetInsets=insets=>send({insets});window.__amsSetAppearance=(value,dark)=>send({appearance:value,dark});window.__amsRefreshClock=()=>send({refreshClock:true});
 window.__amsReviewNotice=text=>notify(text);
 window.__amsSetCourseReminder=state=>{window.__amsCourseReminder=state;send({courseReminder:state});};
 async function reminder(body){const response=await api('reminder',body),value=await response.json();if(!response.ok)throw Error(value.message||'审核提醒服务连接失败');model.reviewReminder=value;publish();return value;}
 window.__amsHandleBack=()=>frame.contentWindow.postMessage({iosAction:'back'},targetOrigin);
 window.addEventListener('message',async e=>{
  if(e.source!==frame.contentWindow||(location.protocol!=='file:'&&e.origin!==location.origin))return;
  if(e.data?.amsIosChrome)channel('amsChrome',e.data.amsIosChrome);if(typeof e.data?.amsIosModal==='boolean')channel('amsModal',e.data.amsIosModal);
  const {amsUiAction:action,...extra}=e.data||{};if(!action||!model)return;
  const roots={home:'/home',records:'/course',leave:'/leave',code:'/signCode'};if(roots[action])return go(roots[action]);
  switch(action){
   case 'ready':publish();break;
   case 'courseReminder':channel('amsReviewAction',{action:'courseReminder',change:extra.change});break;
   case 'reviewReminderOpen':try{await reminder({op:'state'});}catch(error){model.reviewReminder={error:error.message};}go('/review/reminder');break;
   case 'reviewNotification':if(window.webkit?.messageHandlers?.amsReviewAction)channel('amsReviewAction',{action:'reviewNotification'});else notify('请在 iPhone App 内体验系统通知。');break;
   case 'reviewReminderSettings':go('/home');send({...snapshot(),reviewReminderSettings:true});break;
   case 'reviewReminderRefresh':try{await reminder({op:'state'});}catch(error){notify(error.message);}break;
   case 'reviewReminderPhase':if(busy)break;busy=true;try{await reminder({op:'phase',phase:extra.phase,delaySeconds:extra.delaySeconds,requestId:crypto.randomUUID()});}catch(error){notify(error.message);}finally{busy=false;}break;
   case 'reviewSportsBook':if(await operate({action:'sportsBook',...extra}))go('/review/sports');break;
   case 'reviewSportsPay':if(await operate({action:'sportsPay',id:extra.id}))publish();break;
   case 'reviewSportsCancel':if(await operate({action:'sportsCancel',id:extra.id}))publish();break;
   case 'nativeNavigation':channel('amsReviewAction',{action:'navstate',...extra});break;
   case 'recordDetail':courseIndex=extra.index;query={};go('/course/sessions');break;
   case 'filterSessions':query[{group:'moduleTypeGroup',status:'status',date:'date'}[extra.field]]=extra.value;publish();break;
   case 'reviewScan':case 'submitCode':if(await operate({action:'sign',courseId:model.courses[0].id,code:action==='reviewScan'?'123456':extra.code})){go('/signCodeSuccess');send({...snapshot(),signInfo:{...model.courses[0],signTime:'演示签到已保存'}});}break;
   case 'scan':case 'retryScan':channel('amsReviewAction',{action:'scan'});break;
   case 'applyLeave':form={startDate:model.state.anchor,endDate:model.state.anchor,leaveType:'',leaveReason:'',fileList:[]};selected=[];go('/leaveApplication');break;
   case 'leaveField':if(['startDate','endDate','leaveType','leaveReason'].includes(extra.field)){form[extra.field]=extra.value;if(extra.field.endsWith('Date'))selected=[];if(extra.field!=='leaveReason')publish();}break;
   case 'chooseLeaveCourses':if(!form.startDate||!form.endDate||form.endDate<form.startDate)return notify('请选择有效的起止日期');go('/leaveCourse');break;
   case 'toggleLeaveCourse':selected=selected.filter(id=>id!==extra.id);if(extra.checked)selected.push(extra.id);publish();break;
   case 'selectAllLeave':selected=selected.length?[]:model.courses.filter(c=>c.date>=form.startDate&&c.date<=form.endDate).map(c=>c.id);publish();break;
   case 'confirmLeaveCourses':case 'backLeaveForm':go('/leaveApplication');break;
   case 'uploadLeaveFile':{const file=extra.file;if(!file||file.size>900000||! /\.(png|jpe?g|pdf)$/i.test(file.name))return notify('演示证明附件支持 JPG、PNG、PDF，最大 900 KB');const reader=new FileReader();reader.onload=()=>{form.fileList=[{originalFileName:file.name,content:reader.result,status:'done'}];publish();};reader.readAsDataURL(file);break;}
   case 'removeLeaveFile':form.fileList=[];publish();break;
   case 'submitLeave':if(await operate({action:'leave',form,selected})){go('/leave');notify('演示申请已保存');}break;
   case 'leaveDetail':model.currentLeave=model.state.leaves[extra.index]?.id;go('/review/leaveInfo');break;
   case 'cancelLeave':if(await operate({action:'cancelLeave',id:extra.id}))publish();break;
   case 'leaveGuide':notify('演示操作保存在服务器；证明附件仅进入演示申请，不会交给学校。');break;
   case 'reservationService':go(extra.service==='home'?'/reservations':'/review/'+({records:'records',seatRecords:'records',roomRecords:'records'}[extra.service]||extra.service));break;
   case 'book':if(await operate({action:'book',...extra}))go('/review/records');break;
   case 'cancelBooking':if(await operate({action:'cancelBooking',id:extra.id}))publish();break;
   case 'ticket':channel('amsReviewAction',{action:'qr',payload:extra.payload});break;
   case 'xjCode':channel('amsReviewAction',{action:'qr',payload:'AMS-DEMO-NOT-VALID:'+action+':'+crypto.randomUUID()});break;
   case 'hhtCode':channel('amsReviewAction',{action:'hht'});break;
   case 'theme':theme=extra.theme;publish();break;
   case 'appearance':appearance=extra.appearance;window.__amsSetAppearance(appearance,appearance==='dark');break;
   case 'logout':channel('amsReviewAction',{action:'logout'});break;
   case 'contact':channel('amsReviewAction',{action:'contact'});break;
   case 'supportCreator':if(window.webkit?.messageHandlers?.amsReviewAction)channel('amsReviewAction',{action:'supportCreator'});else window.open('https://afdian.com/a/tristanchayne','_blank','noopener');break;
  }
 });
 frame.onload=()=>{if(model)publish();window.__amsSetAppearance(appearance,appearance==='dark');};
 document.getElementById('errorRetry').onclick=()=>{if(window.webkit?.messageHandlers?.amsReviewAction)channel('amsReviewAction',{action:'restart'});else location.reload();};
 reload().catch(error=>{document.getElementById('errorText').textContent=error.message;document.getElementById('error').hidden=false;});
})();
