import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, Composition, registerRoot, staticFile, useCurrentFrame, useRemotionEnvironment, useVideoConfig} from 'remotion';
import {ThreeCanvas, useOffthreadVideoTexture, useVideoTexture} from '@remotion/three';
import {useLoader, useThree} from '@react-three/fiber';
import {Box3, MeshBasicMaterial, PMREMGenerator, SRGBColorSpace, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const Environment = () => {
  const {gl, scene, advance} = useThree();
  useLayoutEffect(() => {
    // Procedural neutral room: no downloaded HDRI or licensed photography.
    const room = new RoomEnvironment();
    const generator = new PMREMGenerator(gl);
    const map = generator.fromScene(room, .04);
    scene.environment = map.texture;
    advance(performance.now());
    return () => {scene.environment = null; map.dispose(); generator.dispose(); room.dispose();};
  }, [gl, scene, advance]);
  return null;
};

const OffthreadTexture = ({src, children}) => {
  const texture = useOffthreadVideoTexture({src, toneMapped: false});
  const {advance} = useThree();
  useLayoutEffect(() => {
    if (texture) {texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true; advance(performance.now());}
  }, [texture, advance]);
  return texture ? children(texture) : null;
};

const PreviewTexture = ({src, children}) => {
  const texture = useVideoTexture({src, muted: true});
  return texture ? children(texture) : null;
};

const VideoTexture = ({src, children}) => {
  const {isRendering} = useRemotionEnvironment();
  return isRendering ? <OffthreadTexture src={src}>{children}</OffthreadTexture> : <PreviewTexture src={src}>{children}</PreviewTexture>;
};

const Calibration = ({screenUrl}) => <>
  <VideoTexture src={staticFile(screenUrl)}>{texture => <mesh position={[0, .55, .02]}>
    <planeGeometry args={[2.8, 2.8]}/><meshBasicMaterial map={texture} toneMapped={false}/>
  </mesh>}</VideoTexture>
  <mesh position={[-.8, -1.5, 0]} rotation={[.24, -.35, .16]} castShadow>
    <sphereGeometry args={[.5, 64, 32]}/><meshPhysicalMaterial color="#b8bcc0" metalness={1} roughness={.22} clearcoat={.12}/>
  </mesh>
  {[0, 1, 2, 3].map(row => [0, 1, 2, 3].map(col => <mesh key={row + ':' + col} position={[.425 + col * .28, -1.92 + row * .28, -.5]}>
    <planeGeometry args={[.28, .28]}/><meshBasicMaterial color={(row + col) % 2 ? '#67847b' : '#192d2b'} toneMapped={false}/>
  </mesh>))}
  <mesh position={[.85, -1.5, .1]} rotation={[.12, .32, -.13]}>
    <sphereGeometry args={[.5, 64, 32]}/><meshPhysicalMaterial color="#fff" metalness={0} roughness={.02} transmission={1} thickness={.8} ior={1.5}/>
  </mesh>
</>;

const LicensedModel = ({modelUrl, screenUrl, screenMesh, modelRotation = [0, .1, 0], modelScale = 1}) => {
  const gltf = useLoader(GLTFLoader, staticFile(modelUrl));
  const model = useMemo(() => {
    const object = gltf.scene.clone(true);
    const matches = [];
    object.traverse(node => {if (node.name === screenMesh) matches.push(node);});
    if (matches.length !== 1) throw Error('Screen binding must resolve to exactly one node: ' + screenMesh);
    const screen = matches[0];
    if (!screen?.isMesh || !screen.geometry.attributes.uv) throw Error('Screen binding needs an exact mesh name and UV coordinates: ' + screenMesh);
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    if (!(size.y > 0)) throw Error('Model has no measurable height');
    const center = box.getCenter(new Vector3());
    object.position.sub(center);
    return {object, screen, fitScale: 4.5 / size.y};
  }, [gltf.scene, screenMesh]);
  return <VideoTexture src={staticFile(screenUrl)}>{texture => <BoundModel model={model} texture={texture} rotation={modelRotation} scale={model.fitScale * modelScale}/>}</VideoTexture>;
};

const BoundModel = ({model, texture, rotation, scale}) => {
  const {advance} = useThree();
  useLayoutEffect(() => {
    const original = model.screen.material;
    const previousFlip = texture.flipY;
    // glTF UV convention; actual aspect/UV calibration remains model-specific.
    texture.flipY = false;
    texture.needsUpdate = true;
    const material = new MeshBasicMaterial({map: texture, toneMapped: false});
    model.screen.material = material;
    advance(performance.now());
    return () => {model.screen.material = original; material.dispose(); texture.flipY = previousFlip;};
  }, [model, texture, advance]);
  return <group rotation={rotation} scale={scale}><primitive object={model.object}/></group>;
};

const Proof = ({mode = 'calibration', screenUrl = 'calibration-screen.mp4', modelUrl, screenMesh, modelRotation, modelScale}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return <AbsoluteFill style={{backgroundColor: '#000', color: '#d2d5d8', fontFamily: 'Arial, sans-serif'}}>
    <ThreeCanvas width={width} height={height} style={{position: 'absolute', inset: 0, zIndex: 0}} orthographic dpr={1} shadows camera={{position: [0, 0, 8], zoom: 230, near: .01, far: 100}} gl={{antialias: true, alpha: true}} onCreated={({gl}) => {
      const context = gl.getContext();
      const extension = context.getExtension('WEBGL_debug_renderer_info');
      console.log('__PHONE_PROOF_GL__' + JSON.stringify({version: context.getParameter(context.VERSION), vendor: extension ? context.getParameter(extension.UNMASKED_VENDOR_WEBGL) : context.getParameter(context.VENDOR), renderer: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER)}));
    }}>
      <Environment/>
      <ambientLight intensity={.06}/>
      <directionalLight position={[-3, 3, 4]} intensity={2} castShadow/>
      <directionalLight position={[3, 1, 2]} intensity={.45}/>
      {mode === 'model' ? <LicensedModel {...{modelUrl, screenUrl, screenMesh, modelRotation, modelScale}}/> : <Calibration screenUrl={screenUrl}/>}
    </ThreeCanvas>
    <div style={{position: 'absolute', top: 130, left: 72, right: 72, zIndex: 2, transform: 'translateZ(0)', fontSize: 42, lineHeight: 1.5}}>技术校准 · 非手机产品镜头</div>
    <div style={{position: 'absolute', bottom: 135, left: 72, right: 72, zIndex: 2, transform: 'translateZ(0)', fontSize: 31, lineHeight: 1.7}}>WebGL / ANGLE · 60 fps<br/>视频纹理帧 {String(frame).padStart(2, '0')} / 59<br/>中性材质样本 · 无 iOS 系统动画</div>
  </AbsoluteFill>;
};

registerRoot(() => <Composition id="PhoneOpeningTechnicalCalibration" component={Proof} width={1080} height={1920} fps={60} durationInFrames={60}/>);
