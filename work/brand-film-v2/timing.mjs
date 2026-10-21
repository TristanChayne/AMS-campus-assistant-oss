export const FPS = 30;
export const BPM = 125;
export const BEAT = 60 / BPM;
export const BARS = [2, 2, 2, 1, 3, 2, 3, 2, 2];
export const TITLES = ['产品登场', '灵动岛课程提醒', '今日课表', '扫码签到', '图书馆选座', '讨论室预约', '宿舍通行码', 'AMS 功能生态', '品牌落版'];
export const SHOTS = BARS.map((bars, i) => {
  const firstBar = BARS.slice(0, i).reduce((a, b) => a + b, 0);
  return {id: i + 1, title: TITLES[i], bars, firstBar, start: Math.round(firstBar * 4 * BEAT * FPS), end: Math.round((firstBar + bars) * 4 * BEAT * FPS)};
});
export const FRAMES = SHOTS.at(-1).end;
export const MUSIC = {startSeconds: 46.080, endSeconds: 82.560, sourceSampleRate: 44100, startSample: 2032128, endSample: 3640896, status: '125 BPM measured; phrase boundary inferred from spectral repetition, listening acceptance pending', endTreatment: '80 ms fade-in, 1.2 s fade-out; this cut is not a natural song ending'};
