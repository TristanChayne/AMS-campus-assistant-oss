import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, Composition, registerRoot, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas, useOffthreadVideoTexture} from '@remotion/three';
import {useLoader, useThree} from '@react-three/fiber';
import {Box3, CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Scene, SRGBColorSpace, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const Studio = () => {
  const {gl, scene, advance} = useThree();
  useLayoutEffect(() => {
    const room = new Scene();
    const cards = [
      {at: [-3.2, 1.4, 4], size: [1.8, 6.5], color: '#fff4e9', power: 3},
      {at: [4, -.4, 2.7], size: [.7, 5.2], color: '#eef2fa', power: 1.2},
      {at: [0, 6, 2], size: [4.5, .8], color: '#fffaf2', power: 1.8},
    ].map(({at,size,color,power}) => {
      const material = new MeshBasicMaterial({color, side: DoubleSide});
      material.color.multiplyScalar(power);
      const mesh = new Mesh(new PlaneGeometry(...size), material);
      mesh.position.set(...at); mesh.lookAt(0,0,0); room.add(mesh); return mesh;
    });
    const generator = new PMREMGenerator(gl);
    const environment = generator.fromScene(room, .015, .1, 100);
    scene.environment = environment.texture;
    advance(performance.now());
    return () => {scene.environment = null; environment.dispose(); generator.dispose(); cards.forEach(c => {c.geometry.dispose(); c.material.dispose();});};
  }, [gl,scene,advance]);
  return null;
};

const ProofCaption = () => {
  const map = useMemo(() => {
    const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=160;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#999'; ctx.font='28px "Microsoft YaHei", Arial, sans-serif'; ctx.textAlign='center';
    ctx.fillText('机身与换屏验证',512,57); ctx.fillText('手持画面与 AMS 灵动岛待补',512,112);
    const texture=new CanvasTexture(canvas); texture.colorSpace=SRGBColorSpace; return texture;
  }, []);
  useLayoutEffect(() => () => map.dispose(), [map]);
  return <mesh position={[0,-3.38,3]} renderOrder={20}><planeGeometry args={[4,.625]}/><meshBasicMaterial map={map} transparent depthTest={false} depthWrite={false} toneMapped={false}/></mesh>;
};

const Phone = ({modelUrl, screenUrl}) => {
  const gltf = useLoader(GLTFLoader, staticFile(modelUrl));
  const texture = useOffthreadVideoTexture({src: staticFile(screenUrl), toneMapped: false});
  const frame = useCurrentFrame();
  const {advance} = useThree();
  const prepared = useMemo(() => {
    const model = gltf.scene.clone(true);
    const displays = [];
    model.traverse(node => {
      if (!node.isMesh) return;
      node.material = Array.isArray(node.material) ? node.material.map(m => m.clone()) : node.material.clone();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of materials) {
        if (['Metal Body','Metal Camera Frame','Glass Camera Control'].includes(m.name)) m.color.set('#d87445');
      }
      if (node.name === 'PhoneDisplay') displays.push(node);
      if (node.name === 'PhoneScreenGlass') {
        // Thin optical cover: reflected softboxes remain independent of the changing display.
        const m = node.material;
        m.transmission = 0; m.transparent = true; m.opacity = .045; m.depthWrite = false;
        m.color.set('#fff'); m.metalness = 0; m.roughness = .025; m.clearcoat = 1; m.clearcoatRoughness = .025;
        m.side = DoubleSide;
      }
    });
    if (displays.length !== 1 || !displays[0].geometry.attributes.uv) throw Error('Expected one UV-calibrated PhoneDisplay mesh');
    const box = new Box3().setFromObject(model), size = box.getSize(new Vector3());
    model.position.sub(box.getCenter(new Vector3()));
    return {model, display: displays[0], scale: 5.45/size.y};
  }, [gltf]);
  useLayoutEffect(() => {
    if (!texture) return;
    texture.colorSpace = SRGBColorSpace; texture.flipY = false; texture.needsUpdate = true;
    const material = new MeshBasicMaterial({map: texture, side: DoubleSide, toneMapped: false});
    const old = prepared.display.material;
    prepared.display.material = material;
    advance(performance.now());
    return () => {prepared.display.material = old; material.dispose();};
  }, [prepared, texture, advance]);
  const t = Math.min(1, frame/479);
  const ease = t*t*(3-2*t);
  return <group position={[0, -.02, 0]} rotation={[.015, -.12+.06*ease, -.025]} scale={prepared.scale*(1+.018*ease)}><primitive object={prepared.model}/></group>;
};

const Opening = ({modelUrl='model.glb', screenUrl='screen-60fps.mp4'}) => {
  const {width,height} = useVideoConfig();
  return <AbsoluteFill style={{backgroundColor:'#000',fontFamily:'Arial, sans-serif',color:'#888'}}>
    <ThreeCanvas width={width} height={height} style={{position:'absolute',inset:0,zIndex:0}} dpr={1} orthographic camera={{position:[0,0,8],zoom:250,near:.01,far:100}} gl={{antialias:true,alpha:true}} onCreated={({gl}) => {
      const c=gl.getContext(), e=c.getExtension('WEBGL_debug_renderer_info');
      console.log('__OPENING_GL__'+JSON.stringify({version:c.getParameter(c.VERSION),renderer:e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):c.getParameter(c.RENDERER)}));
    }}>
      <Studio/>
      <ambientLight intensity={.08}/>
      <directionalLight position={[-3,3,4]} intensity={.65} color="#fff1df"/>
      <Phone {...{modelUrl,screenUrl}}/>
      <ProofCaption/>
    </ThreeCanvas>
  </AbsoluteFill>;
};
registerRoot(() => <Composition id="PhoneOpeningSwapProof" component={Opening} width={1080} height={1920} fps={60} durationInFrames={480}/>);
