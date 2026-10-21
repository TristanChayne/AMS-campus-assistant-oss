let mapsOpen=false;
const campusMaps={sip:{name:'SIP 苏州工业园区校区',file:'sip.png'},tc:{name:'TC 太仓校区',file:'tc.jpg'}};
const campusMapImages={};
const mapUrl=key=>campusMapImages[key];
function renderCampusMaps(screen){
 screen.innerHTML='<button class="return" id="mapsBack">‹ 返回设置</button>'+Object.entries(campusMaps).map(([key,map])=>`<button class="card campus-map-card" data-map="${key}" aria-label="放大查看${map.name}地图"><h3>${map.name}</h3><img src="${mapUrl(key)}" alt="${map.name}地图" loading="lazy"><p>点击放大查看 ›</p></button>`).join('');
 document.getElementById('mapsBack').onclick=()=>{mapsOpen=false;render();};
 screen.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>openCampusMap(b.dataset.map));
}
function openCampusMap(key){
 let viewer=document.getElementById('mapViewer');
 if(!viewer){viewer=document.createElement('dialog');viewer.id='mapViewer';viewer.className='map-viewer';document.body.appendChild(viewer);}
 viewer.innerHTML=`<div class="map-toolbar"><button id="mapClose" aria-label="关闭地图">‹ 返回</button><span>${campusMaps[key].name}</span><button id="mapReset">重置</button></div><div class="map-viewport" id="mapViewport"><img id="mapImage" src="${mapUrl(key)}" alt="${campusMaps[key].name}地图" draggable="false"></div><div class="map-controls"><button id="mapZoomOut" aria-label="缩小地图">−</button><span>双指缩放 · 拖动查看</span><button id="mapZoomIn" aria-label="放大地图">＋</button></div>`;
 viewer.showModal();
 const viewport=document.getElementById('mapViewport'),image=document.getElementById('mapImage');
 let scale=1,x=0,y=0;const pointers=new Map();let gesture=null;
 const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
 function paint(){const limitX=Math.max(0,(image.clientWidth*scale-viewport.clientWidth)/2),limitY=Math.max(0,(image.clientHeight*scale-viewport.clientHeight)/2);x=clamp(x,-limitX,limitX);y=clamp(y,-limitY,limitY);image.style.transform=`translate(${x}px,${y}px) scale(${scale})`;}
 function zoom(value,cx=0,cy=0){const next=clamp(value,1,8),ratio=next/scale;x=cx-(cx-x)*ratio;y=cy-(cy-y)*ratio;scale=next;paint();}
 function point(e){const r=viewport.getBoundingClientRect();return {x:e.clientX-r.left-r.width/2,y:e.clientY-r.top-r.height/2};}
 function measure(){const points=[...pointers.values()];if(points.length>=2){const a=points[0],b=points[1];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)};}return {...points[0],distance:0};}
 function begin(){gesture=pointers.size?{...measure(),scale,xOffset:x,yOffset:y}:null;}
 viewport.onpointerdown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;viewport.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));begin();};
 viewport.onpointermove=e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,point(e));const m=measure();if(pointers.size>=2&&gesture.distance>0){scale=clamp(gesture.scale*m.distance/gesture.distance,1,8);const ratio=scale/gesture.scale;x=m.x-(gesture.x-gesture.xOffset)*ratio;y=m.y-(gesture.y-gesture.yOffset)*ratio;}else{x=gesture.xOffset+m.x-gesture.x;y=gesture.yOffset+m.y-gesture.y;}paint();};
 const release=e=>{pointers.delete(e.pointerId);begin();};viewport.onpointerup=release;viewport.onpointercancel=release;viewport.onlostpointercapture=release;
 viewport.addEventListener('wheel',e=>{e.preventDefault();const p=point(e);zoom(scale*Math.exp(-e.deltaY*.002),p.x,p.y);},{passive:false});
 viewport.ondblclick=e=>{const p=point(e);zoom(scale>1?1:3,p.x,p.y);};
 document.getElementById('mapZoomIn').onclick=()=>zoom(scale*1.5);
 document.getElementById('mapZoomOut').onclick=()=>zoom(scale/1.5);
 document.getElementById('mapReset').onclick=()=>{scale=1;x=y=0;paint();};
 document.getElementById('mapClose').onclick=()=>viewer.close();
 image.onload=paint;
}
