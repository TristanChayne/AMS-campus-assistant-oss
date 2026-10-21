import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {FPS, FRAMES, SHOTS, BEAT} from './timing.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const arg = (key, fallback) => {const i = process.argv.indexOf(key); return i < 0 ? fallback : process.argv[i + 1];};
const deps = path.resolve(arg('--deps', here));
const out = path.resolve(arg('--output', path.join(root, 'outputs/brand-film-v2')));
const require = createRequire(path.join(deps, 'package.json'));
const {PNG} = require('pngjs');
const {QRCodeReader, DataMatrixReader, Code128Reader, RGBLuminanceSource, HybridBinarizer, BinaryBitmap, DecodeHintType} = require('@zxing/library');
const bin = path.join(deps, 'node_modules/@remotion/compositor-win32-x64-msvc');
const ffmpeg = arg('--ffmpeg', 'ffmpeg');
const availableFilters = execFileSync(ffmpeg, ['-hide_banner', '-filters'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
if (!/\bblackdetect\b/.test(availableFilters)) throw Error('A full FFmpeg build is required for blackdetect');
const media = ['AMS-V2-Animatic-Music.mp4', 'AMS-V2-Animatic-Silent.mp4'].map(name => {
  const file = path.join(out, name);
  const info = JSON.parse(execFileSync(path.join(bin, 'ffprobe.exe'), ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], {encoding: 'utf8'}));
  const v = info.streams.find(s => s.codec_type === 'video');
  if (v.width !== 1080 || v.height !== 1920 || v.r_frame_rate !== '30/1' || v.avg_frame_rate !== '30/1' || Number(v.nb_frames) !== FRAMES) throw Error('Video specification mismatch: ' + name);
  const frameInfo = JSON.parse(execFileSync(path.join(bin, 'ffprobe.exe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', file], {encoding: 'utf8', maxBuffer: 2e6}));
  const timestamps = frameInfo.frames.map(f => Number(f.best_effort_timestamp_time));
  const timestampError = Math.max(...timestamps.map((t, i) => Math.abs(t - i / FPS)));
  if (timestamps.length !== FRAMES || timestampError > .00001) throw Error('Frame timing discontinuity: ' + name);
  const a = info.streams.find(s => s.codec_type === 'audio');
  if (name.includes('Music') && (!a || Number(a.sample_rate) !== 48000 || a.channels !== 2)) throw Error('Audio specification mismatch');
  const decoded = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-vf', 'blackdetect=d=0.04:pix_th=0.01:pic_th=0.99', '-an', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 10e6});
  if (decoded.status !== 0) throw Error('Full video decode failed: ' + name);
  fs.writeFileSync(path.join(out, name + '.decode.log'), decoded.stderr);
  const blackIntervals = [...decoded.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)].map(m => ({start: Number(m[1]), end: Number(m[2]), duration: Number(m[3])}));
  if (blackIntervals.length) throw Error('Unexpected almost-total black frames: ' + name);
  return {name, duration: Number(info.format.duration), frames: Number(v.nb_frames), fps: v.avg_frame_rate, frameTimestampMaxErrorUs: timestampError * 1000000, video: v.codec_name, audio: a ? {codec: a.codec_name, sampleRate: Number(a.sample_rate), channels: a.channels} : null, fullDecodePassed: true, blackIntervals, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex'), size: fs.statSync(file).size};
});
// A code scan is supplementary. Safety comes from offline source fixtures;
// absence of a decoded code alone is never an adequate privacy guarantee.
const codes = [];
for (const dir of ['public', 'stills']) for (const name of fs.readdirSync(path.join(out, dir)).filter(n => n.endsWith('.png'))) {
  const png = PNG.sync.read(fs.readFileSync(path.join(out, dir, name)));
  const gray = new Uint8ClampedArray(png.width * png.height);
  for (let i = 0; i < gray.length; i++) gray[i] = (png.data[4 * i] + 2 * png.data[4 * i + 1] + png.data[4 * i + 2]) / 4;
  let decoded = false;
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray, png.width, png.height)));
  const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
  for (const Reader of [QRCodeReader, DataMatrixReader, Code128Reader]) {
    try {new Reader().decode(bitmap, hints); decoded = true;} catch (e) {if (!['NotFoundException', 'FormatException', 'ChecksumException'].includes(e.constructor.name)) throw e;}
  }
  if (decoded) throw Error('Unexpected barcode in safe fixture: ' + name);
  codes.push({file: dir + '/' + name, decoded});
}
if (SHOTS.length !== 9 || SHOTS.reduce((a, b) => a + b.bars, 0) !== 19) throw Error('Shot structure mismatch');
const errors = Array.from({length: 77}, (_, n) => Math.abs(Math.round(n * BEAT * FPS) / FPS - n * BEAT));
const report = {media, codeChecks: codes, codeFormats: ['QR_CODE', 'DATA_MATRIX', 'CODE_128'], timing: {shots: 9, bars: 19, beatFrameMaxErrorMs: Math.max(...errors) * 1000, endCardFullyVisibleSeconds: (FRAMES - 1027) / FPS, phoneStillSeconds: (FRAMES - 1010) / FPS}, scope: 'Media metadata, source PNG and rendered key PNG scan, frame-grid arithmetic. Full-stream decode and blackdetect logs are separate. Retail EAN/UPC formats excluded because form text produced an EAN_8 false candidate; credential safety comes from the isolated fixtures.', remaining: ['User visual/listening acceptance', 'Transition proof and production replacement', 'Native system recording', 'True hand-held footage', '4K master QC']};
fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({media, safeImagesChecked: codes.length, timing: report.timing}, null, 2));
