import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// node prepare-screen.mjs --input <local video> --config <JSON> --ffmpeg <full FFmpeg>
// Optional: --ffprobe, --encoder-ffmpeg, --deps, --output. Paths stay in ignored reports.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const arg = (key, fallback) => {const i = process.argv.indexOf(key); return i < 0 ? fallback : process.argv[i + 1];};
const inputArg = arg('--input');
if (!inputArg) throw Error('Provide --input with a local recording; no native UI is generated.');
const input = path.resolve(inputArg);
const configPath = path.resolve(arg('--config', path.join(here, 'screen-edit.json')));
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const out = path.resolve(arg('--output', path.join(root, 'outputs/phone-opening-proof/screen')));
const ffmpeg = arg('--ffmpeg', 'ffmpeg');
const ffprobe = arg('--ffprobe', path.isAbsolute(ffmpeg) ? path.join(path.dirname(ffmpeg), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe') : 'ffprobe');
const deps = path.resolve(arg('--deps', path.join(root, 'outputs/phone-opening-proof/runtime')));
const encoder = arg('--encoder-ffmpeg', process.platform === 'win32' ? path.join(deps, 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe') : ffmpeg);
const video = path.join(out, 'screen-60fps.mp4');
if (input.toLowerCase() === video.toLowerCase()) throw Error('Output must differ from the source recording.');
const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = (exe, args) => execFileSync(exe, args, {encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'pipe']});
const probe = file => JSON.parse(run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
const probeFrames = file => JSON.parse(run(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time,duration_time', '-of', 'json', file])).frames;
const requireValue = (passed, message) => {if (!passed) throw Error(message);};
const sourceHash = sha256(input);
const info = probe(input), stream = info.streams.find(s => s.codec_type === 'video');
requireValue(Boolean(stream), 'Input needs a video stream.');
const rotation = Number(stream.side_data_list?.find(s => s.rotation !== undefined)?.rotation ?? 0);
requireValue(rotation === 0, 'Normalize rotation metadata before specifying a pixel crop.');
const sourceFrames = probeFrames(input).map((frame, index) => ({index, pts: Number(frame.best_effort_timestamp_time)}));
requireValue(sourceFrames.length > 0 && sourceFrames.every(f => Number.isFinite(f.pts)), 'Source needs decoded frame presentation timestamps.');
requireValue(sourceFrames.every((f, i) => i === 0 || f.pts > sourceFrames[i - 1].pts), 'Source frame timestamps must increase.');
const {crop, target, hdrToSdr, trimIn, trimOut, placeAt, durationSeconds, fps} = config;
requireValue(fps === 60 && durationSeconds === 8, 'This isolated opening slot is 8 seconds / 480 frames at 60fps.');
requireValue(crop && ['x', 'y', 'width', 'height'].every(k => Number.isInteger(crop[k])), 'Crop coordinates and dimensions must be integer pixels.');
requireValue(crop.x >= 0 && crop.y >= 0 && crop.width > 0 && crop.height > 0 && crop.x + crop.width <= stream.width && crop.y + crop.height <= stream.height, 'Crop lies outside the source pixel raster.');
requireValue(target?.fit === 'contain' && target.padColor === 'black', 'Use contain with black padding; screen pixels are never stretched.');
requireValue(['width', 'height'].every(k => Number.isInteger(target[k]) && target[k] > 0 && target[k] % 2 === 0), 'Target dimensions must be positive even pixels for H.264.');
requireValue([trimIn, trimOut, placeAt].every(Number.isFinite) && trimIn >= 0 && trimOut > trimIn && trimOut <= Number(stream.duration ?? info.format.duration) + .000001 && placeAt >= 0 && placeAt + trimOut - trimIn <= durationSeconds, 'Trim and placement must fit the source and 8-second slot.');
const eligible = sourceFrames.filter(f => f.pts >= trimIn && f.pts < trimOut);
requireValue(eligible.length > 0, 'Trim contains no source frames.');
const hdr = ['smpte2084', 'arib-std-b67'].includes(stream.color_transfer);
const colorFilters = [];
if (hdr) {
  requireValue(hdrToSdr?.method === 'hable' && Number.isFinite(hdrToSdr.toneMapPeak) && hdrToSdr.toneMapPeak > 0 && Number.isFinite(hdrToSdr.referenceWhiteNits) && hdrToSdr.referenceWhiteNits > 0 && Number.isFinite(hdrToSdr.desaturation) && hdrToSdr.desaturation >= 0, 'HDR needs explicit positive toneMapPeak/referenceWhiteNits and nonnegative desaturation.');
  colorFilters.push(`zscale=t=linear:npl=${hdrToSdr.referenceWhiteNits}`, 'format=gbrpf32le', `tonemap=hable:peak=${hdrToSdr.toneMapPeak}:desat=${hdrToSdr.desaturation}`, 'zscale=p=bt709:t=bt709:m=bt709:r=full');
} else if (stream.color_primaries && stream.color_transfer && stream.color_space) colorFilters.push('zscale=p=bt709:t=bt709:m=bt709:r=full');
const fitScale = Math.min(target.width / crop.width, target.height / crop.height);
const scaledWidth = Math.min(target.width, Math.max(2, 2 * Math.round(crop.width * fitScale / 2)));
const scaledHeight = Math.min(target.height, Math.max(2, 2 * Math.round(crop.height * fitScale / 2)));
const padLeft = Math.floor((target.width - scaledWidth) / 2), padTop = Math.floor((target.height - scaledHeight) / 2);
const filter = [...colorFilters, 'format=rgb24', `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}:exact=1`, `scale=${scaledWidth}:${scaledHeight}:flags=lanczos`, 'setsar=1', `pad=${target.width}:${target.height}:${padLeft}:${padTop}:color=black`, 'format=rgb24'].join(',');
const frames = Math.round(durationSeconds * fps), clipEnd = placeAt + trimOut - trimIn;
const mapping = [];
let selected = 0;
for (let frame = 0; frame < frames; frame++) {
  const time = frame / fps;
  const phase = time + 1e-9 < placeAt ? 'hold-first' : time + 1e-9 >= clipEnd ? 'hold-last' : 'play-1x';
  const requested = phase === 'hold-first' ? trimIn : phase === 'hold-last' ? trimOut : trimIn + time - placeAt;
  while (selected + 1 < eligible.length && eligible[selected + 1].pts <= requested + .0000001) selected++;
  const source = phase === 'hold-last' ? eligible.at(-1) : eligible[selected];
  mapping.push({frame, outputTime: time, phase, requestedSourceTime: requested, sourceFrame: source.index, sourcePTS: source.pts});
}
fs.mkdirSync(out, {recursive: true});
const decoded = fs.mkdtempSync(path.join(out, 'decoded-'));
const conform = fs.mkdtempSync(path.join(out, 'conform-'));
let report;
try {
  console.log('Decoding native frames, applying the configured crop and colour conversion.');
  run(ffmpeg, ['-v', 'error', '-y', '-noautorotate', '-i', input, '-map', '0:v:0', '-vf', filter, '-fps_mode', 'passthrough', '-start_number', '0', path.join(decoded, 'source-%06d.png')]);
  requireValue(fs.readdirSync(decoded).length === sourceFrames.length, 'Decoded image count differs from source PTS count.');
  for (const m of mapping) {
    const from = path.join(decoded, `source-${String(m.sourceFrame).padStart(6, '0')}.png`);
    const to = path.join(conform, `frame-${String(m.frame).padStart(6, '0')}.png`);
    try {fs.linkSync(from, to);} catch {fs.copyFileSync(from, to);}
  }
  for (const frame of [0, Math.round(placeAt * fps), Math.min(frames - 1, Math.round((placeAt + .9) * fps)), Math.min(frames - 1, Math.round(clipEnd * fps)), frames - 1]) {
    fs.copyFileSync(path.join(conform, `frame-${String(frame).padStart(6, '0')}.png`), path.join(out, `screen-frame-${String(frame).padStart(3, '0')}.png`));
  }
  console.log(`Encoding ${frames} existing-frame samples at ${fps}fps; no optical flow.`);
  run(encoder, ['-v', 'error', '-y', '-framerate', String(fps), '-start_number', '0', '-i', path.join(conform, 'frame-%06d.png'), '-an', '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', video]);
  const outputInfo = probe(video), outputStream = outputInfo.streams.find(s => s.codec_type === 'video');
  const outputFrames = probeFrames(video);
  const maxPtsError = Math.max(...outputFrames.map((f, i) => Math.abs(Number(f.best_effort_timestamp_time) - i / fps)));
  requireValue(outputStream.width === target.width && outputStream.height === target.height && outputStream.avg_frame_rate === '60/1' && Number(outputStream.nb_frames) === frames && outputFrames.length === frames && Math.abs(Number(outputInfo.format.duration) - durationSeconds) < .00001 && maxPtsError < .00001, 'Encoded output failed dimensions, frame count, duration or constant 60fps PTS verification.');
  run(ffmpeg, ['-v', 'error', '-i', video, '-map', '0:v:0', '-f', 'null', '-']);
  const sourceHashAfter = sha256(input);
  requireValue(sourceHashAfter === sourceHash, 'Source recording changed while processing.');
  const used = new Set(mapping.map(m => m.sourceFrame));
  const intervals = sourceFrames.slice(1).map((f, i) => f.pts - sourceFrames[i].pts);
  report = {
    stage: 'Replaceable screen slot only; product appearance and native AMS island acceptance remain pending',
    config, source: {path: input, sha256: sourceHash, sha256After: sourceHashAfter, bytesUnchanged: true, raster: {width: stream.width, height: stream.height}, decodedFrames: sourceFrames.length, codec: stream.codec_name, pixelFormat: stream.pix_fmt, color: {primaries: stream.color_primaries, transfer: stream.color_transfer, matrix: stream.color_space}, averageFrameRate: stream.avg_frame_rate, minFrameIntervalMs: Math.min(...intervals) * 1000, maxFrameIntervalMs: Math.max(...intervals) * 1000},
    cropGeometry: {sourceCrop: crop, target, scaledWidth, scaledHeight, padding: {left: padLeft, right: target.width - scaledWidth - padLeft, top: padTop, bottom: target.height - scaledHeight - padTop}, sourceAspect: crop.width / crop.height, scaledAspect: scaledWidth / scaledHeight, pixelRoundingAspectErrorPercent: (scaledWidth / scaledHeight / (crop.width / crop.height) - 1) * 100, fit: 'Uniform contain, nearest even-pixel dimensions; black letterbox, no content stretch'},
    colorConversion: {appliedHDRToneMap: hdr, filter, parameters: hdr ? hdrToSdr : null, output: 'BT.709 SDR, yuv420p', acceptance: 'Explicit technical conversion; visual brightness and wallpaper match need review'},
    timing: {speed: 1, interpolation: false, opticalFlow: false, sampling: 'Most recent eligible native PTS at each output time; first/last eligible frames held outside trim', eligibleSourceFrames: eligible.length, distinctSourceFramesUsed: used.size, repeatedOutputSamples: frames - used.size, holdFirstFrames: mapping.filter(m => m.phase === 'hold-first').length, playFrames: mapping.filter(m => m.phase === 'play-1x').length, holdLastFrames: mapping.filter(m => m.phase === 'hold-last').length, native60fpsClaim: false, note: '60fps is the output container cadence. No missing source motion frames are synthesized.'},
    verification: {fps, frames, durationSeconds: Number(outputInfo.format.duration), maxTimestampErrorUs: maxPtsError * 1e6, fullDecodePassed: true, sourceBytesUnchanged: true},
    output: {file: path.basename(video), bytes: fs.statSync(video).size, sha256: sha256(video)},
    limitations: ['Existing capture indicators and UI are preserved; no cleanup or fabricated system animation.', 'No AMS island footage is generated when absent from the input.', 'Crop, trim, placement and tone-map settings are replaceable in JSON; video source is replaced through --input.', 'Upscaling cannot restore missing source detail; this screen derivative is not real-device or 4K acceptance.', 'Screen audio is omitted; the original advertisement music timeline is separate and unchanged.']
  };
  fs.writeFileSync(path.join(out, 'source-pts-map.json'), JSON.stringify({sourcePath: input, sourceSha256: sourceHash, selection: report.timing.sampling, frames: mapping}, null, 2));
  fs.writeFileSync(path.join(out, 'screen-report.json'), JSON.stringify(report, null, 2));
} finally {
  // Only files created inside these unique temporary directories are removed.
  for (const dir of [conform, decoded]) {for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name)); fs.rmdirSync(dir);}
}
console.log(JSON.stringify({output: video, fps, frames, sourceBytesUnchanged: report.verification.sourceBytesUnchanged, padding: report.cropGeometry.padding, distinctSourceFramesUsed: report.timing.distinctSourceFramesUsed}, null, 2));
