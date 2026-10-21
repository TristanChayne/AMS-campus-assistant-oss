let leaveSubmitting=false,leaveUploading=false;
const chineseMessages={'Please select start time':'请选择开始日期','Please select end time':'请选择结束日期','Please select Leave Type':'请选择请假类型','Please select Session(s)':'请选择涉及的课程','Please upload Attachment':'请上传证明附件','Please enter Reason':'请填写请假原因','Only the start date and subsequent dates can be selected':'结束日期不能早于开始日期','Only.rar,.zip,.pdf,.jpg,.png files can be uploaded':'请选择 JPG、PNG、PDF、ZIP 或 RAR 文件','The uploaded file cannot exceed 10mb':'附件不能超过 10 MB','Successful':'操作成功','Success':'操作成功','success':'操作成功'};
function notify(message){if(frame)frame.contentWindow.postMessage({amsUiData:{notification:chineseMessages[message]||message}},'*');}
function attachLeaveFeedback(active){if(!active||active.__amsFeedback)return;active.__amsFeedback=true;active.$toast=message=>notify(typeof message==='string'?message:'请检查填写内容');}
function leaveSnapshot(active,route){if(!active)return {};if(route==='/leaveApplication'){const f=active.form||{};return {form:{startDate:f.startDate,endDate:f.endDate,leaveType:f.leaveType,leaveReason:f.leaveReason,fileList:(f.fileList||[]).map(x=>({originalFileName:x.originalFileName||x.file&&x.file.name,status:x.status,fileType:x.fileType}))},leaveTypes:active.columns||[],leaveDays:active.days,selectedCount:(active.leaveModuleList||[]).length,minStart:active.minStart,maxStart:active.maxStart,minEnd:active.minEnd,maxEnd:active.maxEnd,submitting:leaveSubmitting};}if(route==='/leaveCourse')return {leaveCourseDays:active.dayList||[],courseSelected:(active.selectedCourseDatas||[]).map(c=>c.moduleCodeId),checkedAll:active.checkedAll,coursesReady:active.__amsCoursesReady||!!(active.dayList&&active.dayList.length),dateRange:(active.$route.query.startDate||'')+' 至 '+(active.$route.query.endDate||'')};return {};}
async function leaveRequest(url,body){const user=JSON.parse(sessionStorage.getItem('amsuserInfo')||'null');if(!user||!user.token)throw new Error('登录已失效，请重新登录');const headers={'X-Token':user.token};if(!(body instanceof FormData))headers['Content-Type']='application/json';const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{let response;try{response=await fetch('https://ams.xjtlu.edu.cn/xjtlu'+url,{method:'POST',credentials:'same-origin',headers,body:body instanceof FormData?body:JSON.stringify(body),signal:controller.signal});}catch(e){throw new Error(url.includes('addLeave')?'暂未收到学校提交结果，请先查看请假记录，避免重复提交':'附件上传未完成，请检查网络后重试');}if(!response.ok)throw new Error('学校服务器未返回成功结果，请检查记录后再操作');const result=await response.json();if(result.code!==0)throw new Error(result.code===401?'登录已失效，请重新登录':chineseMessages[result.message]||result.message||'学校未接受申请，请检查填写内容');return result;}finally{clearTimeout(timer);}}
function handleLeave(action,data,active,path){
 if(!['leaveField','chooseLeaveCourses','uploadLeaveFile','removeLeaveFile','submitLeave','leaveGuide','backLeaveForm','toggleLeaveCourse','selectAllLeave','confirmLeaveCourses'].includes(action))return false;
 if(path==='/leaveApplication'&&active){attachLeaveFeedback(active);const f=active.form;
  if(action==='leaveField'&&!leaveSubmitting&&typeof data.value==='string'){
   last='';
   if(data.field==='leaveReason')f.leaveReason=data.value.slice(0,500);
   else if(data.field==='leaveType'&&!data.value)f.leaveType='';
   else if(data.field==='leaveType'&&active.columns.includes(data.value))active.onConfirm3(data.value);
   else if(['startDate','endDate'].includes(data.field)&&!data.value){f[data.field]='';f.leaveCourse='';active.leaveModuleList=[];active.days=0;sessionStorage.removeItem('selectedCourseDatas');}
   else if(['startDate','endDate'].includes(data.field)&&/^\d{4}-\d{2}-\d{2}$/.test(data.value)){
    const date=new Date(data.value+'T12:00:00'),min=data.field==='startDate'?active.minStart:active.minEnd,max=data.field==='startDate'?active.maxStart:active.maxEnd;
    if(date<new Date(new Date(min).setHours(0,0,0,0))||date>new Date(new Date(max).setHours(23,59,59,999)))notify('所选日期超出学校允许范围');
    else if(data.field==='startDate')active.onConfirm(date);else active.onConfirm2(date);
   }
  }else if(action==='chooseLeaveCourses')active.applyCourse();
  else if(action==='leaveGuide')router.push('/guidance');
  else if(action==='removeLeaveFile'&&!leaveUploading&&!leaveSubmitting)active.handleDel();
  else if(action==='uploadLeaveFile'&&!leaveUploading&&!leaveSubmitting){
   const file=data.file;if(!file||typeof file.name!=='string'||file.size>10*1024*1024||file.size<=0||! /\.(jpe?g|png|pdf|zip|rar)$/i.test(file.name)){notify('请选择不超过 10 MB 的 JPG、PNG、PDF、ZIP 或 RAR 文件');return true;}
   leaveUploading=true;const previous=f.fileList.slice();f.fileList=[{file,status:'uploading'}];const body=new FormData();body.append('file',file);
   leaveRequest('/file/uploadToObject',body).then(result=>{const uploaded=result.data;if(!uploaded||!uploaded.fileUrl||!uploaded.originalFileName)throw new Error('学校返回的附件信息不完整');uploaded.url=uploaded.fileUrl;const ext=uploaded.originalFileName.split('.').pop().toLowerCase();uploaded.fileType=['jpg','jpeg','png'].includes(ext)?0:ext==='pdf'?1:2;f.fileList=[uploaded];notify('附件已上传');}).catch(error=>{f.fileList=previous;notify(error.message||'附件上传失败，请重试');}).finally(()=>{leaveUploading=false;refresh();});
  }else if(action==='submitLeave'&&!leaveSubmitting&&!leaveUploading){
   const missing=!f.startDate?'请选择开始日期':!f.endDate?'请选择结束日期':!f.leaveType?'请选择请假类型':!active.leaveModuleList.length?'请选择涉及的课程':!f.fileList.length||!f.fileList[0].url?'请上传证明附件':!f.leaveReason.trim()?'请填写请假原因':'';
   if(missing){notify(missing);return true;}leaveSubmitting=true;
   const file=f.fileList[0],payload={fileName:file.originalFileName,fileSuffix:file.originalFileName.split('.')[1],fileUrl:file.url,leaveReason:f.leaveReason,leaveType:f.leaveType,startDate:f.startDate,endDate:f.endDate,leaveCourse:active.leaveModuleList.length,leaveModuleList:active.leaveModuleList};
   leaveRequest('/stuapi/xjtlu-leave/addLeave',payload).then(()=>{preloadAt=0;notify('申请已提交，等待学校审核');router.push('/leave');}).catch(error=>notify(error.message||'未收到提交结果，请先检查请假记录，避免重复提交')).finally(()=>{leaveSubmitting=false;refresh();});
  }
 }else if(path==='/leaveCourse'&&active){
  attachLeaveFeedback(active);
  if(action==='backLeaveForm')router.back();
  else if(action==='toggleLeaveCourse'){const course=active.allCourseDatas.find(c=>c.moduleCodeId===data.id);if(course&&(!course.disabled||course.courseBox)){course.courseBox=!!data.checked;active.changeCheckbox(!!data.checked,course);}}
  else if(action==='selectAllLeave'){active.checkedAll=!active.checkedAll;active.toggleAll();}
  else if(action==='confirmLeaveCourses')active.submit();
 }
 return true;
}
