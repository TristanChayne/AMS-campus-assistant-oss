/* AMS Android school session bridge: signals only; native code reads the main frame and keeps the school's own session. */
(()=>{
 'use strict';
 const bridge=window.AmsSchoolSession;
 // AMS only: seat / room pages are gated by the UIM cookie session and must keep their own token exchange.
 if(!bridge||location.protocol!=='https:'||location.hostname!=='ams.xjtlu.edu.cn'||window!==window.top||window.__amsSchoolSession)return;
 window.__amsSchoolSession=true;
 const key='amsuserInfo';
 const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem,clear=Storage.prototype.clear;
 const token=()=>{try{const user=JSON.parse(sessionStorage.getItem(key));return typeof user?.token==='string'?user.token:'';}catch{return '';}};
 const expired=value=>{if(value)bridge.expired(value);};
 Storage.prototype.setItem=function(name,value){set.call(this,name,value);if(this===sessionStorage&&String(name)===key)bridge.changed();};
 Storage.prototype.removeItem=function(name){const watched=this===sessionStorage&&String(name)===key,before=watched?token():'';remove.call(this,name);if(watched)expired(before);};
 // The AMS 401 handler and the AMS logout both call sessionStorage.clear(); only the token that was held expires.
 Storage.prototype.clear=function(){const before=this===sessionStorage?token():'';clear.call(this);if(this===sessionStorage)expired(before);};
 bridge.changed();
})();
