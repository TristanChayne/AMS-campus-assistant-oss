import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const arg = (name, fallback) => {const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1];};
const runtime = path.resolve(arg('--deps', path.join(root, 'outputs/phone-opening-proof/runtime')));
const out = path.resolve(arg('--output', path.join(root, 'outputs/phone-opening-proof/compatibility')));
const publicDir = path.join(out, 'public');
const ffmpeg = arg('--ffmpeg', 'ffmpeg');
const ffprobe = arg('--ffprobe', 'ffprobe');
const browserExecutable = arg('--browser');
const sourceEncoder = arg('--source-ffmpeg', process.platform === 'win32' ? path.join(runtime, 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe') : ffmpeg);
const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const width = 1080, height = 1920, fps = 60, frames = 60;
fs.mkdirSync(publicDir, {recursive: true});
const modelFile = arg('--model');
const inputProps = {mode: modelFile ? 'model' : 'calibration', screenUrl: 'calibration-screen.mp4'};
let modelReview = null;
if (modelFile) {
  const reviewPath = arg('--model-review');
  if (!reviewPath || !arg('--screen-mesh') || !arg('--screen')) throw Error('Model mode needs --model-review, --screen-mesh and --screen. No production assets are bundled.');
  modelReview = JSON.parse(fs.readFileSync(path.resolve(reviewPath), 'utf8'));
  if (modelReview.commercialUseConfirmed !== true || modelReview.modelSha256 !== sha256(path.resolve(modelFile))) throw Error('Model review must confirm commercial use and match modelSha256. A website listing alone does not verify the delivered model.');
  const extension = path.extname(modelFile).toLowerCase();
  if (extension !== '.glb') throw Error('This minimal model entry accepts a self-contained GLB only.');
  fs.copyFileSync(path.resolve(modelFile), path.join(publicDir, 'model.glb'));
  inputProps.modelUrl = 'model.glb';
  inputProps.screenMesh = arg('--screen-mesh');
}
const screenFile = arg('--screen');
if (screenFile) {
  inputProps.screenUrl = 'screen' + path.extname(screenFile).toLowerCase();
  fs.copyFileSync(path.resolve(screenFile), path.join(publicDir, inputProps.screenUrl));
} else {
  // A neutral numbered-frame calibration source, not wallpaper or phone UI.
  const tw = 320, th = 320;
  const raw = Buffer.alloc(tw * th * 3 * frames);
  for (let f = 0; f < frames; f++) {
    const offset = f * tw * th * 3;
    raw.fill(32 + f * 3, offset, offset + tw * th * 3);
    const x = f * 5;
    for (let y = 12; y < 40; y++) for (let col = x; col < x + 9; col++) for (let c = 0; c < 3; c++) raw[offset + (y * tw + col) * 3 + c] = 255;
  }
  const sourceFrames = path.join(out, 'calibration-source-frames');
  fs.mkdirSync(sourceFrames, {recursive: true});
  const pattern = path.join(sourceFrames, 'frame-%03d.png');
  execFileSync(ffmpeg, ['-y', '-v', 'error', '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', `${tw}x${th}`, '-framerate', String(fps), '-i', 'pipe:0', '-an', '-frames:v', String(frames), pattern], {input: raw, maxBuffer: 2e6});
  execFileSync(sourceEncoder, ['-y', '-v', 'error', '-framerate', String(fps), '-i', pattern, '-an', '-c:v', 'libx264', '-crf', '0', '-pix_fmt', 'yuv444p', path.join(publicDir, inputProps.screenUrl)], {maxBuffer: 2e6});
}
const {bundle} = await import(pathToFileURL(path.join(runtime, 'node_modules/@remotion/bundler/dist/index.js')));
const {renderMedia, renderStill, selectComposition} = await import(pathToFileURL(path.join(runtime, 'node_modules/@remotion/renderer/dist/index.js')));
const chromiumOptions = {gl: 'angle'};
const serveUrl = await bundle({entryPoint: path.join(here, 'scene.jsx'), publicDir, webpackOverride: config => ({...config, resolve: {...config.resolve, modules: [path.join(runtime, 'node_modules'), ...(config.resolve?.modules || [])]}})});
const composition = await selectComposition({serveUrl, id: 'PhoneOpeningTechnicalCalibration', inputProps, chromiumOptions, browserExecutable});
const video = path.join(out, 'Technical-Calibration-60fps.mp4');
let browserErrors = [], webGL = null;
const onBrowserLog = log => {
  if (log.type === 'error') browserErrors.push(log.text);
  if (log.text.startsWith('__PHONE_PROOF_GL__')) webGL = JSON.parse(log.text.slice('__PHONE_PROOF_GL__'.length));
};
const began = Date.now();
await renderMedia({serveUrl, composition, inputProps, chromiumOptions, browserExecutable, codec: 'h264', crf: 18, pixelFormat: 'yuv420p', concurrency: 1, outputLocation: video, onBrowserLog, onProgress: p => {if (p.renderedFrames % 15 === 0) process.stdout.write(`Technical frames ${p.renderedFrames}/${frames}\n`);}});
const renderingSeconds = (Date.now() - began) / 1000;
for (const frame of [0, 15, 30, 59]) await renderStill({serveUrl, composition, inputProps, chromiumOptions, browserExecutable, frame, output: path.join(out, `frame-${String(frame).padStart(2, '0')}.png`), onBrowserLog});
const info = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', video], {encoding: 'utf8'}));
const v = info.streams.find(s => s.codec_type === 'video');
const timeline = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', video], {encoding: 'utf8'}));
const maxTimestampError = Math.max(...timeline.frames.map((f, i) => Math.abs(Number(f.best_effort_timestamp_time) - i / fps)));
if (v.width !== width || v.height !== height || v.avg_frame_rate !== '60/1' || Number(v.nb_frames) !== frames || timeline.frames.length !== frames || maxTimestampError > .00001) throw Error('Rendered media failed 60 fps or timestamp validation.');
execFileSync(ffmpeg, ['-v', 'error', '-i', video, '-an', '-f', 'null', '-'], {stdio: 'pipe'});
let textureCheck = {scope: 'Input video decoding and frame synchronization; model UV/appearance still requires visual inspection.'};
if (!screenFile && !modelFile) {
  const decoded = execFileSync(ffmpeg, ['-v', 'error', '-i', video, '-vf', 'crop=10:10:535:828', '-an', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], {maxBuffer: 1e6});
  const means = Array.from({length: frames}, (_, f) => {let sum = 0; for (let i = 0; i < 300; i++) sum += decoded[f * 300 + i]; return sum / 300;});
  const maxDifference = Math.max(...means.map((value, f) => Math.abs(value - (32 + f * 3))));
  const monotonic = means.slice(1).every((value, f) => value > means[f]);
  if (decoded.length !== frames * 300 || !monotonic || maxDifference > 4) throw Error('Dynamic texture frame synchronization failed: ' + JSON.stringify({monotonic, maxDifference}));
  textureCheck = {sourceFrames: frames, decodedFrames: decoded.length / 300, firstMean: means[0], lastMean: means.at(-1), allFramesChangedMonotonically: monotonic, expectedColorMaxDifference: maxDifference, scope: 'Neutral per-frame grayscale source measured on the rendered screen at all 60 frames. No native iOS recording.'};
}
const versions = Object.fromEntries(['@remotion/bundler', '@remotion/renderer', '@remotion/three', '@remotion/media', 'remotion', 'react', 'react-dom', '@react-three/fiber', 'three'].map(name => [name, JSON.parse(fs.readFileSync(path.join(runtime, 'node_modules', name, 'package.json'), 'utf8')).version]));
const report = {stage: 'Technical calibration only; not a 0–8 second commercial preview', versions, mode: inputProps.mode, modelPassed: modelFile ? 'Load/screen-binding only; visual/product/physical dimensions not accepted' : false, nativeIOSAnimationPassed: false, wallpaperPassed: false, wallpaperScope: 'Calibration does not use wallpaper. Original asset identity is assessed separately by asset-preflight; model-specific mapping/colour remains pending.', renderer: 'Chromium ANGLE', webGL, width, height, fps, frames, durationSeconds: Number(info.format.duration), maxFrameTimestampErrorUs: maxTimestampError * 1e6, fullDecodePassed: true, dynamicTexture: textureCheck, browserErrors: [...new Set(browserErrors)], renderingSeconds, output: {file: path.basename(video), bytes: fs.statSync(video).size, sha256: sha256(video)}, screenSource: {file: inputProps.screenUrl, sha256: sha256(path.join(publicDir, inputProps.screenUrl)), providedByUser: Boolean(screenFile), nativeOriginVerified: false}, modelReview, remaining: ['Actual licensed iPhone 17 Pro Max GLB or photographic plate', 'Accurate geometry/dimensions and model-specific screen UV inspection', 'Model-specific Cosmic Orange wallpaper mapping/colour and native recording', 'Handheld reference match and studio materials/reflections', 'Independent 0–8 second production preview and user visual acceptance'], unchanged: ['Original Remotion composition and dependency runtime', 'Existing music timeline and later shots', 'Android/iOS/Mini Program app source and packages']};
fs.writeFileSync(path.join(out, 'compatibility.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
