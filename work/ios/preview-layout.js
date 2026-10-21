window.addEventListener('message',event=>{
 if(event.source===parent&&typeof event.data?.iosTestDetail==='boolean'){if(event.data.iosTestDetail)show('<h2>课程详情预览</h2><p>匿名布局测试</p>');else closeSheet();return;}
 if(event.source!==parent||!event.data?.iosMeasure)return;
 const layout=Array.from(document.querySelectorAll('.actions,.action,.action svg')).map(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return {tag:node.tagName,class:node.getAttribute('class'),width:r.width,height:r.height,minHeight:s.minHeight,padding:s.padding,gridRows:s.gridTemplateRows}});
 parent.postMessage({amsIosChrome:{route:page.route||'/home',title:document.querySelector('h1').textContent,layout:JSON.stringify(layout)}},'*');
});
window.addEventListener('error',event=>parent.postMessage({amsIosChrome:{route:'/diagnostic',title:'',layout:JSON.stringify({error:event.message,line:event.lineno})}},'*'));
