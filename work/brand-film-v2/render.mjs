import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {FPS, FRAMES, MUSIC, SHOTS, BEAT} from './timing.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const arg = (key, fallback) => {const i = process.argv.indexOf(key); return i < 0 ? fallback : process.argv[i + 1];};
const deps = path.resolve(arg('--deps', here));
const out = path.resolve(arg('--output', path.join(root, 'outputs/brand-film-v2')));
const assets = path.resolve(arg('--assets', path.join(out, 'public')));
const ffmpeg = arg('--ffmpeg', 'ffmpeg');
const availableFilters = execFileSync(ffmpeg, ['-hide_banner', '-filters'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
for (const filter of ['afade', 'xstack', 'scale']) if (!new RegExp(`\\b${filter}\\b`).test(availableFilters)) throw Error('A full FFmpeg build is required: missing ' + filter);
const {bundle} = await import(pathToFileURL(path.join(deps, 'node_modules/@remotion/bundler/dist/index.js')));
const {renderMedia, renderStill, selectComposition} = await import(pathToFileURL(path.join(deps, 'node_modules/@remotion/renderer/dist/index.js')));
fs.mkdirSync(out, {recursive: true});
for (const name of ['ams-icon', 'home', 'timetable', 'seat', 'seat-selected', 'room', 'room-selected', 'dorm', 'attendance', 'leave']) {
  if (!fs.existsSync(path.join(assets, name + '.png'))) throw Error('Missing safe asset: ' + name);
}
const serveUrl = await bundle({entryPoint: path.join(here, 'composition.jsx'), publicDir: assets, webpackOverride: config => ({...config, resolve: {...config.resolve, modules: [path.join(deps, 'node_modules'), ...(config.resolve?.modules || [])]}})});
const composition = await selectComposition({serveUrl, id: 'AMS-Brand-V2-Animatic'});
const silent = path.join(out, 'AMS-V2-Animatic-Silent.mp4');
if (!process.argv.includes('--stills-only')) {
  if (!process.argv.includes('--reuse-video')) await renderMedia({serveUrl, composition, codec: 'h264', crf: 18, pixelFormat: 'yuv420p', concurrency: 3, outputLocation: silent, onProgress: p => {if (p.renderedFrames % 150 === 0) process.stdout.write(`Frames ${p.renderedFrames}/${FRAMES}\n`);}});
  else if (!fs.existsSync(silent)) throw Error('No rendered silent video to reuse');
  const audio = arg('--audio');
  if (audio) {
    execFileSync(ffmpeg, ['-y', '-i', silent, '-i', path.resolve(audio), '-filter_complex', `[1:a]atrim=start_sample=${MUSIC.startSample}:end_sample=${MUSIC.endSample},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.08,afade=t=out:st=${FRAMES / FPS - 1.2}:d=1.2[a]`, '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-t', String(FRAMES / FPS), '-movflags', '+faststart', path.join(out, 'AMS-V2-Animatic-Music.mp4')], {stdio: 'pipe'});
  }
}
const stills = path.join(out, 'stills');
fs.mkdirSync(stills, {recursive: true});
const frames = [...new Set([0, ...SHOTS.map(s => Math.floor((s.start + s.end) / 2)), 890, 908, 1029, 1049, 1093, ...[230, 403, 950].flatMap(f => [-12, -6, 0, 6, 12].map(d => f + d))])].sort((a, b) => a - b);
for (const frame of frames) await renderStill({serveUrl, composition, frame, output: path.join(stills, `frame-${String(frame).padStart(4, '0')}.png`)});
const board = (chosen, columns, width, height, filename) => {
  const inputs = chosen.flatMap(frame => ['-i', path.join(stills, `frame-${String(frame).padStart(4, '0')}.png`)]);
  const scales = chosen.map((_, i) => `[${i}:v]scale=${width}:${height}:flags=lanczos[v${i}]`).join(';');
  const layout = chosen.map((_, i) => `${i % columns * width}_${Math.floor(i / columns) * height}`).join('|');
  const stack = chosen.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${chosen.length}:layout=${layout}:fill=black[out]`;
  execFileSync(ffmpeg, ['-y', ...inputs, '-filter_complex', scales + ';' + stack, '-map', '[out]', '-frames:v', '1', '-update', '1', path.join(out, filename)], {stdio: 'pipe'});
};
board(SHOTS.map(s => Math.floor((s.start + s.end) / 2)), 3, 270, 480, 'Nine-Shot-Contact-Sheet.png');
board([230, 403, 950].flatMap(f => [-12, -6, 0, 6, 12].map(d => f + d)), 5, 180, 320, 'Transition-Frames.png');
fs.writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({stage: 'Animatic, user visual acceptance pending', width: 1080, height: 1920, fps: FPS, frames: FRAMES, duration: FRAMES / FPS, plannedMusicDuration: 76 * BEAT, music: MUSIC, shots: SHOTS.map(s => ({...s, startSeconds: s.start / FPS, endSeconds: s.end / FPS})), beatGrid: Array.from({length: 77}, (_, n) => ({beat: n, sourceSeconds: MUSIC.startSeconds + n * BEAT, frame: Math.round(n * BEAT * FPS)})), limitations: ['Native Dynamic Island and scanner are layout placeholders.', 'No live school service, scan, reservation or gate action.', 'Screens are offline Web UI captures from verified Build6 IPA, with synthetic demonstration data.', 'No real hand footage or final 3D model; no 4K master.', 'Music phrase detection is algorithmic; listening acceptance is pending.']}, null, 2));
console.log(`Rendered ${FRAMES / FPS}s at ${FPS} fps. Source screenshots stay unchanged during transitions.`);
