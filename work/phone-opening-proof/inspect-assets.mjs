import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const options = process.argv.slice(2);
const option = key => {const i = options.indexOf(key); return i < 0 ? undefined : options[i + 1];};
const sources = JSON.parse(fs.readFileSync(path.join(root, 'work/phone-opening-proof/sources.json')));
const out = path.resolve(option('--output') || path.join(root, 'outputs/phone-opening-proof'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(path.join(out, 'inputs'), {recursive: true});
const report = {scope: 'Input identity and native recording metadata; not commercial product preview acceptance', visual: sources.visual, wallpaper: null, reference: null, nativeRecording: null, model: null, pending: []};

const wallpaperPath = option('--wallpaper');
if (wallpaperPath) {
  const bytes = fs.readFileSync(wallpaperPath);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('Wallpaper must be the supplied original PNG');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), digest = sha(bytes);
  if (digest !== sources.wallpaper.sha256 || width !== 1320 || height !== 2868) throw Error('Wallpaper does not match the selected original Cosmic Orange file');
  let remoteMatch = null;
  if (options.includes('--verify-source')) {
    const response = await fetch(sources.wallpaper.original);
    if (!response.ok) throw Error('Original wallpaper source unavailable: ' + response.status);
    // Compare in memory; do not substitute a thumbnail or re-encode the PNG.
    remoteMatch = sha(Buffer.from(await response.arrayBuffer())) === digest;
    if (!remoteMatch) throw Error('Original wallpaper source bytes differ');
  }
  fs.writeFileSync(path.join(out, 'inputs/cosmic-orange-original.png'), bytes);
  report.wallpaper = {file: 'inputs/cosmic-orange-original.png', width, height, bytes: bytes.length, sha256: digest, originalUrl: sources.wallpaper.original, remoteMatch, changedPixels: false};
} else report.pending.push('Original Cosmic Orange wallpaper');

const referencePath = option('--reference');
if (referencePath) {
  const bytes = fs.readFileSync(referencePath), digest = sha(bytes);
  if (digest !== sources.reference.sha256) throw Error('Unexpected hand/composition reference; review its intended role first');
  fs.writeFileSync(path.join(out, 'inputs/hand-composition-reference.jpg'), bytes);
  report.reference = {file: 'inputs/hand-composition-reference.jpg', sha256: digest, role: sources.reference.purpose, usableAsNativeRecording: false, phoneAccuracyVerified: false};
} else report.pending.push('Hand/composition reference');

const nativePath = option('--native');
if (nativePath) {
  const probe = option('--ffprobe');
  if (!probe) throw Error('--ffprobe is required to inspect native recording');
  const result = JSON.parse(execFileSync(probe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', nativePath], {encoding: 'utf8'}));
  const v = result.streams.find(s => s.codec_type === 'video');
  if (!v) throw Error('Native recording has no video stream');
  const frames = JSON.parse(execFileSync(probe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', nativePath], {encoding: 'utf8', maxBuffer: 30e6})).frames;
  const times = frames.map(f => Number(f.best_effort_timestamp_time)).filter(Number.isFinite);
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const hdr = ['smpte2084', 'arib-std-b67'].includes(v.color_transfer);
  report.nativeRecording = {sha256: sha(fs.readFileSync(nativePath)), width: v.width, height: v.height, codec: v.codec_name, duration: Number(result.format.duration), declaredRate: v.avg_frame_rate, color: {primaries: v.color_primaries, transfer: v.color_transfer, space: v.color_space, hdr}, frames: times.length, measuredFramesPerSecond: times.length > 1 ? (times.length - 1) / (times.at(-1) - times[0]) : null, maxGapMs: gaps.length ? Math.max(...gaps) * 1000 : null, nonIncreasingTimestampCount: gaps.filter(g => g <= 0).length, limitations: 'Metadata/PTS do not prove every frame contains a new system animation image. Inspect wake, island visibility and region differences visually. Original pixels retained; no interpolation or time stretching.'};
  if (report.nativeRecording.nonIncreasingTimestampCount) throw Error('Native recording has non-increasing timestamps');
  report.pending.push('Native animation coverage and recording/mirroring indicator visual review; metadata alone does not prove all required clips are supplied');
  if (hdr) report.pending.push('HDR colour conversion inspection before composition');
} else report.pending.push('Original iOS26 lock/wake and Dynamic Island recording');

const modelPath = option('--model');
if (modelPath) {
  const bytes = fs.readFileSync(modelPath);
  if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw Error('Expected a complete GLB 2.0 model');
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.toString('ascii', 16, 20) !== 'JSON') throw Error('Missing GLB JSON chunk');
  const document = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).trim());
  report.model = {sha256: sha(bytes), generator: document.asset?.generator, meshNames: (document.meshes || []).map(m => m.name || '(unnamed)'), materialNames: (document.materials || []).map(m => m.name || '(unnamed)'), uvPrimitiveCount: (document.meshes || []).flatMap(m => m.primitives).filter(p => p.attributes.TEXCOORD_0 !== undefined).length, externalUris: [...(document.images || []), ...(document.buffers || [])].map(i => i.uri).filter(Boolean), limitations: 'Mesh metadata does not verify physical size, front/back orientation, flat screen UV or commercial appearance. Exact model and licence review are still required.'};
  report.pending.push('Model dimensions/materials/screen UV and commercial licence review');
} else report.pending.push('Licensed, locally inspected iPhone17ProMax model or layered hand plate');

report.readyForEightSecondNativePreview = report.wallpaper !== null && report.reference !== null && report.nativeRecording !== null && report.model !== null && report.pending.length === 0;
fs.writeFileSync(path.join(out, 'asset-preflight.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({wallpaper: report.wallpaper, reference: report.reference, nativeRecording: report.nativeRecording, model: report.model, pending: report.pending, readyForEightSecondNativePreview: report.readyForEightSecondNativePreview}, null, 2));
