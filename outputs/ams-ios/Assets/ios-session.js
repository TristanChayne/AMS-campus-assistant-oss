/* AMS school session bridge */
(() => {
 if(location.protocol!=='https:'||location.hostname!=='ams.xjtlu.edu.cn'||window.top!==window)return;
 const key='amsuserInfo',stored=__AMS_SESSION__;
 const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem,clear=Storage.prototype.clear;
 const publish=()=>window.webkit.messageHandlers.amsSession.postMessage(sessionStorage.getItem(key)||'');
 if(!sessionStorage.getItem(key)&&stored){try{const user=JSON.parse(stored);if(typeof user.token==='string'&&user.token)set.call(sessionStorage,key,stored);}catch{}}
 Storage.prototype.setItem=function(name,value){set.call(this,name,value);if(this===sessionStorage&&String(name)===key)publish();};
 Storage.prototype.removeItem=function(name){remove.call(this,name);if(this===sessionStorage&&String(name)===key)publish();};
 Storage.prototype.clear=function(){clear.call(this);if(this===sessionStorage)publish();};
 publish();
})();
