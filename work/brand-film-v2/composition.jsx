import React from 'react';
import {AbsoluteFill, Composition, Img, interpolate, registerRoot, staticFile, useCurrentFrame} from 'remotion';
import {FPS, FRAMES, SHOTS} from './timing.mjs';

const C = {void: '#030507', rim: '#657080', campus: '#6fa0ff', paper: '#f5f7fb', ink: '#15243c'};
const smooth = t => t * t * (3 - 2 * t);
const mix = (f, a, b, x, y) => interpolate(f, [a, b], [x, y], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: smooth});
const layer = (f, start, end, edge = 13) => mix(f, start, start + edge, 0, 1) * (1 - mix(f, end - edge, end, 0, 1));
const Screen = ({name, style = {}}) => <Img src={staticFile(name + '.png')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', ...style}}/>;

// These two surfaces are deliberate animatic placeholders. The native SwiftUI
// layout is the reference; a CSS drawing is never native/system acceptance.
const LockScreen = ({f}) => <AbsoluteFill style={{background: 'linear-gradient(160deg,#253a5a,#08111e 70%)', color: '#fff'}}>
  <div style={{position: 'absolute', top: 165, width: '100%', textAlign: 'center', fontSize: 30, color: '#bdcce2'}}>10月14日 星期三</div>
  <div style={{position: 'absolute', top: 205, width: '100%', textAlign: 'center', fontSize: 112, fontWeight: 650, letterSpacing: -6}}>09:28</div>
  <div style={{position: 'absolute', left: 28, right: 28, top: 980, borderRadius: 32, background: '#18263c', padding: 28}}>
    <div style={{fontSize: 25, color: C.campus, marginBottom: 14}}>AMS · 即将上课</div>
    <div style={{fontSize: 34, fontWeight: 600}}>Programming with C++</div>
    <div style={{fontSize: 25, color: '#acbbce', marginTop: 15}}>SOE106TC · DE-2001</div>
  </div>
  <div style={{position: 'absolute', top: 20, left: '50%', width: mix(f, 135, 164, 248, 580), height: mix(f, 135, 164, 66, 245), transform: 'translateX(-50%)', borderRadius: 65, background: '#000', overflow: 'hidden', padding: mix(f, 135, 164, 0, 28), boxSizing: 'border-box'}}>
    <div style={{opacity: mix(f, 150, 165, 0, 1)}}>
      <div style={{display: 'flex', justifyContent: 'space-between', padding: '8px 9px 0', color: C.campus, fontSize: 24, fontWeight: 600}}><span>♧ SOE106TC</span><span style={{color: '#adb4bf', fontSize: 19}}>还剩 1 节</span></div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 21}}><div><div style={{fontSize: 28, fontWeight: 600}}>Programming with C++</div><div style={{fontSize: 21, marginTop: 5, color: '#9aa5b6'}}>DE-2001</div></div><div style={{textAlign: 'right', marginLeft: 10}}><div style={{fontSize: 31, whiteSpace: 'nowrap'}}>32 分钟</div><div style={{fontSize: 18, color: '#9aa5b6'}}>后上课</div></div></div>
      <div style={{display: 'flex', gap: 15, marginTop: 19, fontSize: 22, textAlign: 'center'}}><div style={{flex: 1, background: '#26282c', padding: '12px 0', borderRadius: '10px 10px 15px 39px'}}>扫码签到</div><div style={{flex: 1, background: '#26282c', padding: '12px 0', borderRadius: '10px 10px 39px 15px'}}>结束提醒</div></div>
    </div>
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-around', fontSize: 20, color: C.campus, opacity: 1 - mix(f, 135, 149, 0, 1)}}><span>SOE</span><span>DE-2001</span></div>
  </div>
</AbsoluteFill>;

const Scan = ({f}) => <AbsoluteFill style={{background: '#131b29', color: '#fff', clipPath: `inset(${mix(f, 329, 346, 100, 0)}% 0 0 0)`}}>
  <div style={{position: 'absolute', top: 100, left: 34, right: 34, fontSize: 28, textAlign: 'center'}}>‹ <span style={{marginLeft: 90, marginRight: 120}}>扫码签到</span></div>
  <div style={{position: 'absolute', top: 535, width: '100%', textAlign: 'center', color: '#a9b6c9', fontSize: 24}}>将课堂二维码放入扫描框</div>
  <div style={{position: 'absolute', top: 690, left: 196, width: 232, height: 232, transform: `translateY(${mix(f, 353, 384, 160, 0)}px)`, background: '#d1dbe9', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#18263d', fontSize: 25, fontWeight: 600}}>AMS DEMO</div>
</AbsoluteFill>;

// Independent vector overlay: the source screenshot pixels are never morphed.
const ScanToSeats = ({f}) => {
  const emerge = layer(f, 337, 436, 8);
  const p = mix(f, 392, 422, 0, 1);
  const size = mix(f, 352, 373, 450, 430) + 74 * p;
  const height = mix(f, 352, 373, 450, 430) - 10 * p;
  const top = 633 - 102 * p;
  return <svg width="620" height="1374" viewBox="0 0 620 1374" style={{position: 'absolute', inset: 0, opacity: emerge, pointerEvents: 'none'}}>
    {[0, 1, 2, 3].map(k => {const x = k % 2 ? 310 + size / 2 : 310 - size / 2; const y = k < 2 ? top : top + height; const dx = k % 2 ? -54 : 54; const dy = k < 2 ? 54 : -54; return <path key={k} d={`M ${x} ${y + dy} L ${x} ${y} L ${x + dx} ${y}`} fill="none" stroke={C.campus} strokeWidth="7" strokeLinecap="round"/>;})}
    <g opacity={p * (1 - mix(f, 419, 436, 0, 1))}>{Array.from({length: 13}, (_, i) => <path key={'c' + i} d={`M ${310 - size / 2 + (i + 1) * size / 14} ${top} v ${height}`} stroke={C.campus} strokeWidth="2"/>)}{Array.from({length: 8}, (_, i) => <path key={'r' + i} d={`M ${310 - size / 2} ${top + (i + 1) * height / 9} h ${size}`} stroke={C.campus} strokeWidth="2"/>)}</g>
  </svg>;
};

const Phone = ({f}) => {
  const entrance = mix(f, 0, 112, .89, 1);
  const focus = mix(f, 127, 166, 1, 1.16) - mix(f, 207, 243, 0, .16);
  const returnPhone = mix(f, 701, 735, 1.025, 1);
  const settle = mix(f, 922, 1010, 1, .56);
  const scale = entrance * focus * returnPhone * settle;
  const y = mix(f, 0, 112, 70, 0) + mix(f, 127, 166, 0, 145) - mix(f, 207, 243, 0, 145) + mix(f, 949, 1010, 0, 280);
  const rotate = mix(f, 0, 112, -6, 0) + mix(f, 687, 704, 0, 4) - mix(f, 704, 747, 0, 4);
  const screenOn = mix(f, 57, 107, 0, 1);
  const timetable = mix(f, 206, 242, 0, 1);
  const scan = layer(f, 329, 416, 12);
  return <div style={{position: 'absolute', left: 215, top: 300, width: 650, height: 1404, transform: `translateY(${y}px) scale(${scale}) rotate(${rotate}deg)`, transformOrigin: 'center 38%'}}>
    <div style={{position: 'absolute', inset: 0, borderRadius: 88, background: `linear-gradient(115deg,${C.rim},#151a20 23%,#080b10 63%,#7894ad)`, padding: 14, boxSizing: 'border-box', border: '1px solid #46515e'}}>
      <div style={{position: 'absolute', left: -4, top: 250, height: 115, width: 4, background: '#657080', borderRadius: 3}}/>
      <div style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 75, background: '#020407'}}>
        <div style={{position: 'absolute', inset: 0, opacity: screenOn}}>
          <LockScreen f={f}/>
          <div style={{position: 'absolute', inset: 0, clipPath: `inset(${mix(f, 206, 242, 100, 0)}% 0 0 0)`}}><Screen name="timetable"/></div>
          <Scan f={f}/>
          <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 0 ${mix(f, 397, 421, 100, 0)}% 0)`}}><Screen name={f < 472 ? 'seat' : 'seat-selected'}/></div>
          <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${mix(f, 570, 603, 100, 0)}% 0 0)`}}><Screen name={f < 637 ? 'room' : 'room-selected'}/></div>
          <div style={{position: 'absolute', inset: 0, clipPath: `inset(${mix(f, 686, 718, 100, 0)}% 0 0 0)`}}><Screen name="dorm"/><div style={{position: 'absolute', left: 140, right: 140, bottom: 140, opacity: layer(f, 778, 803, 5), background: C.paper, borderRadius: 20, color: C.ink, textAlign: 'center', padding: 18, fontSize: 22}}>正在刷新</div></div>
          <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${mix(f, 862, 899, 50, 0)}% 0 ${mix(f, 862, 899, 50, 0)}%)`}}><Screen name="home"/></div>
          <ScanToSeats f={f}/>
          <div style={{position: 'absolute', top: 19, left: '50%', width: 196, height: 51, borderRadius: 30, background: '#000', transform: 'translateX(-50%)', opacity: timetable * (1 - scan)}}/>
          <div style={{position: 'absolute', left: '35%', right: '35%', height: 7, bottom: 13, borderRadius: 9, background: '#b4becb', opacity: .75}}/>
        </div>
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg,rgba(171,209,255,.06),transparent 30%)', pointerEvents: 'none'}}/>
      </div>
    </div>
  </div>;
};

const Ecosystem = ({f}) => <>
  {['attendance', 'leave', 'room'].map((name, i) => {
    const open = mix(f, 865 + i * 5, 888 + i * 5, 0, 1);
    const close = mix(f, 919 + i * 4, 951 + i * 4, 0, 1);
    const spread = open * (1 - close);
    return <div key={name} style={{position: 'absolute', top: 560 + (i - 1) * 90 * spread, left: 355 + (i - 1) * 310 * spread, width: 370, height: 801, overflow: 'hidden', borderRadius: 36, border: '1px solid #455369', opacity: layer(f, 865 + i * 5, 959 + i * 4, 10), transform: `scale(${.78 + .12 * spread}) rotate(${(i - 1) * 4 * spread}deg)`}}><Screen name={name}/></div>;
  })}
</>;

const Animatic = () => {
  const f = useCurrentFrame();
  const shot = SHOTS.find(s => f >= s.start && f < s.end) || SHOTS.at(-1);
  const heading = shot.id > 1 && shot.id < 9 ? layer(f, shot.start + 10, shot.end - 6, 14) : 0;
  const label = shot.id === 2 ? '下一节，先一步。' : shot.title;
  const brand = mix(f, 978, 1002, 0, 1);
  return <AbsoluteFill style={{background: C.void, overflow: 'hidden', fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif', color: '#f7f9fc'}}>
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 56% 57%,rgba(30,62,105,.17),transparent 56%)'}}/>
    <div style={{position: 'absolute', top: 112, left: 60, right: 60, opacity: heading, transform: `translateY(${mix(f, shot.start + 10, shot.start + 30, 20, 0)}px)`, textAlign: 'center'}}><div style={{fontSize: 21, letterSpacing: 4, color: '#97a8c1', marginBottom: 24}}>AMS 校园助手</div><div style={{fontSize: 61, fontWeight: 700, letterSpacing: -1.5}}>{label}</div></div>
    <Phone f={f}/>
    <Ecosystem f={f}/>
    <div style={{position: 'absolute', top: 165, left: 55, right: 55, textAlign: 'center', opacity: brand}}>
      <Img src={staticFile('ams-icon.png')} style={{width: 91, height: 91, borderRadius: 23, marginBottom: 46}}/>
      <div style={{fontSize: 76, fontWeight: 700, letterSpacing: -2, opacity: mix(f, 992, 1011, 0, 1)}}>有请 AMS 助手。</div>
      <div style={{fontSize: 91, fontWeight: 700, letterSpacing: -3, marginTop: 14, opacity: mix(f, 1007, 1027, 0, 1)}}>尽享美妙。</div>
    </div>
    <div style={{position: 'absolute', bottom: 60, left: 58, right: 58, display: 'flex', justifyContent: 'space-between', color: '#788497', fontSize: 21, letterSpacing: 1}}><span>动态预演 · 待素材替换</span><span>{String(shot.id).padStart(2, '0')} / 09</span></div>
  </AbsoluteFill>;
};
registerRoot(() => <Composition id="AMS-Brand-V2-Animatic" component={Animatic} width={1080} height={1920} fps={FPS} durationInFrames={FRAMES}/>);
