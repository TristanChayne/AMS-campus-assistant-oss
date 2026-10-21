(function(){
  'use strict';
  window.__campusResetReservation=function(records){
    const app=document.querySelector('#app'),vm=app&&app.__vue__;
    if(!vm||!vm.$router||!vm.$store||!vm.$store.state.isLogin)return Promise.resolve(false);
    // Close confirmation UI without booking, cancelling a reservation, or logging out.
    document.querySelectorAll('.el-dialog__headerbtn,.el-message-box__headerbtn').forEach(button=>button.click());
    const router=vm.$router;
    const go=path=>router.currentRoute.path===path?Promise.resolve():Promise.resolve(router.replace(path)).catch(()=>{});
    return go('/ic/home').then(()=>records?go('/ic/userinfo'):null).then(()=>{window.scrollTo(0,0);return true;});
  };
})();
