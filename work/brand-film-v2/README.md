# AMS 品牌片 V2.0 · Animatic

本工程只交付第一阶段完整动态预演，供确认九镜头的构图、功能停留和音乐节奏。画面含“动态预演 · 待素材替换”标记。正式手机摄影、系统灵动岛录屏和 4K 母版在后续阶段验收，不能把本预演当成正式 iOS 录屏。

## 输出与时间线

输出目录 `outputs/brand-film-v2/`，不纳入 Git：

- `AMS-V2-Animatic-Music.mp4`：1080×1920、9:16、H.264、30 fps / 1094 帧，约 36.47 秒；AAC、48 kHz、立体声。
- `AMS-V2-Animatic-Silent.mp4`：同画面静音版。
- `Nine-Shot-Contact-Sheet.png`：九镜头中段概览。
- `Transition-Frames.png`：三个重点衔接的五帧取样，仅预演检查，不是第二阶段精修验收。
- `timeline.json`、`asset-manifest.json`、`verification.json`：音乐格点、素材来源与检查证据。

| 镜头 | 格点目标（秒） | 预演内容 |
|---|---|---|
| 01 | 0–3.84 | 黑场轮廓光、简化手机，真实手持待替换 |
| 02 | 3.84–7.68 | 原生布局参考绘制的锁屏/灵动岛占位 |
| 03 | 7.68–11.52 | Build 6 包内课表 HTML 的离线演示 |
| 04 | 11.52–13.44 | 扫码布局占位与无效 DEMO 图块 |
| 05 | 13.44–19.20 | Build 6 审核选座表单与完整虚构矩阵 |
| 06 | 19.20–23.04 | Build 6 审核讨论室选择表单 |
| 07 | 23.04–28.80 | Build 6 HHT HTML 与无效弧线图形 |
| 08 | 28.80–32.64 | 首页与三个辅助页面沿固定轨迹收拢 |
| 09 | 32.64–36.48 | 两行原定宣传语，完整文字稳定约 2.23 秒 |

30 fps 的时长与切点采用最近整帧；19 小节音乐原长 36.480 秒，视频为 36.4667 秒，误差约 13.3 ms。用户文案保持“有请 AMS 助手。” / “尽享美妙。”。

## 音乐依据

仅本地使用用户提供的 Bonobo / Kerala / Migration MP3，整首音频与剪辑音轨不写入 Git。正常解码 PCM 为 44.1 kHz 双声道；从样本 2032128 至 3640896 剪取，对应 46.080–82.560 秒。

40–90 秒的三频段正向谱通量/STFT（2048 窗、110 样本 hop、分析采样率 22050）都得到 0.4800 秒节拍周期；8 拍纹理重复的相关峰约 0.8038，支持 125 BPM。46.080 秒入点由谱结构变化与 15.36 秒周期推断，未经人工听审。片尾添加 1.2 秒淡出；82.560 秒不能称原曲自然结束。

## 素材与真实程度

准备脚本核对 iOS 0.2.0(6) IPA SHA256 `a550235cabbab0f9a3c4ab525fb8618e43556e740e9691733d1ff0e577ad63fb`，只提取包内两份公开展示 HTML 并核对发行清单。应用图标也对照包内输入清单校验。

全部课表、出勤、房间、座位均手工构造；课程统一 SOE106TC / Programming with C++ / DE-2001。未导入私人审核 seed、真实学生记录、token、有效二维码、签名材料；网络被拦截，没有签到、预约、支付或入场操作。

屏幕来源于 Windows 浏览器离线渲染，浏览器日期控件、字体与导航不能代表 iPhone WebKit/UIKit。图书馆矩阵为虚构 14×9 布局；讨论室为审核演示表单，不能当成真实学校页面。本阶段借此确认镜头节奏；正式制作仍需可授权、已脱敏的真实 UI 素材。

## 复跑

本目录依赖固定于 Remotion 4.0.534 / React 19.2.0。可在本目录安装 package.json 依赖，也可通过 `--deps` 使用现有宣传工程的依赖；仅复用依赖，不复用其旧截图。prepare 默认使用已核验本地 IPA 和本机 bundled Playwright，可用参数明确指定。

音频淡出、接触表与黑帧检查需完整 FFmpeg（Remotion 随附的裁剪版缺少这些过滤器），默认从 PATH 读取或用 `--ffmpeg` 指定。本次复用了本机 DevEcoStudio 已有 FFmpeg 7.1 的临时解压副本，没有下载第三方音频。

```powershell
node work/brand-film-v2/prepare-assets.mjs --ipa E:/Codex/Ams-prototype/outputs/ios-release-0.2.0-6/AMS-0.2.0-6.ipa
node work/brand-film-v2/render.mjs --deps E:/Codex/Ams-prototype/outputs/promo-remotion-v3 --ffmpeg C:/Users/linla/AppData/Local/Temp/ams-v2-audio-tools/ffmpeg.exe --audio C:/Users/linla/Downloads/M800004ARirJ2f5OJE.mp3
node work/brand-film-v2/verify.mjs --deps E:/Codex/Ams-prototype/outputs/promo-remotion-v3 --ffmpeg C:/Users/linla/AppData/Local/Temp/ams-v2-audio-tools/ffmpeg.exe
```

`--stills-only` 只重新生成关键帧与接触表。画面源码未变化、仅重做音轨时，可用 `--reuse-video` 复用静音画面，不能用来掩盖新源码未渲染。默认输出在本 checkout 的忽略目录；render/verify 的 `--output` 可另指定。检查包括媒体规格、全部视频解码、近全黑画面、PNG 的 QR/Data Matrix/Code128 解码和帧格点误差。纯表单曾被全格式扫描误判为 EAN_8，因此不声称全格式零检测；隐私保证以隔离素材来源为主。关键帧视觉检查不代替整片移动端观看、人工音乐听审或正式素材验收。
