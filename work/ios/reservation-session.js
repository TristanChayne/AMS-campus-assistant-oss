/* AMS reservation session bridge */
(()=>{
 'use strict';
 if(location.protocol!=='https:'||location.hostname!==__RESERVATION_HOST__||!['seatbookings.xjtlu.edu.cn','roombookings.xjtlu.edu.cn'].includes(location.hostname)||window!==window.top)return;
 const saved=__RESERVATION_SESSION__,keys=['userInfo','isLogin'];
 const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem,clear=Storage.prototype.clear;
 if(saved){try{const data=JSON.parse(saved),user=JSON.parse(data.userInfo);if(user.token&&data.isLogin==='true'){for(const key of keys)set.call(sessionStorage,key,data[key]);}}catch{}}
 const invalidate=raw=>{try{const user=JSON.parse(raw);if(typeof user?.token==='string'&&user.token)window.webkit.messageHandlers.reservationSession.postMessage(JSON.stringify({expiredToken:user.token}));}catch{}};
 const publish=()=>{
  const logged=sessionStorage.getItem('isLogin');
  if(logged==='false'){invalidate(sessionStorage.getItem('userInfo'));return;}
  try{const user=JSON.parse(sessionStorage.getItem('userInfo'));if(logged==='true'&&typeof user?.token==='string'&&user.token)window.webkit.messageHandlers.reservationSession.postMessage(JSON.stringify({userInfo:JSON.stringify(user),isLogin:'true'}));}catch{}
 };
 Storage.prototype.setItem=function(key,value){set.call(this,key,value);if(this===sessionStorage&&keys.includes(String(key)))publish();};
 Storage.prototype.removeItem=function(key){const old=this===sessionStorage?sessionStorage.getItem('userInfo'):null;remove.call(this,key);if(this===sessionStorage&&keys.includes(String(key)))invalidate(old);};
 Storage.prototype.clear=function(){const old=this===sessionStorage?sessionStorage.getItem('userInfo'):null;clear.call(this);if(this===sessionStorage)invalidate(old);};
})();
