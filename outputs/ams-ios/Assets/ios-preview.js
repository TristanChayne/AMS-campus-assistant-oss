(() => {
      const frame=document.querySelector('iframe');
      const snapshot=route=>({route,list:[],days:[],ready:true,loading:false,leave:true});
      window.addEventListener('message',e=>{if(e.source!==frame.contentWindow)return;if(e.data?.amsIosChrome)window.webkit.messageHandlers.amsChrome.postMessage(e.data.amsIosChrome);if(typeof e.data?.amsIosModal==='boolean')window.webkit.messageHandlers.amsModal.postMessage(e.data.amsIosModal);const route={home:'/home',records:'/course',leave:'/leave'}[e.data?.amsUiAction];if(route)frame.contentWindow.postMessage({amsUiData:snapshot(route)},'*')});
      window.__amsSetInsets=insets=>frame.contentWindow.postMessage({amsUiData:{insets}},'*');
      window.__amsSetAppearance=(appearance,dark)=>frame.contentWindow.postMessage({amsUiData:{appearance,dark}},'*');
      frame.onload=()=>{const n=new Date(),date=String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');frame.contentWindow.postMessage({amsUiData:{route:'/home',days:[{date,timetableVoList:[]}],ready:true,loading:false,leave:true,prefetched:{'/home':snapshot('/home'),'/course':snapshot('/course'),'/leave':snapshot('/leave')}}},'*');setTimeout(()=>frame.contentWindow.postMessage({iosMeasure:true},'*'),500)};
    })();