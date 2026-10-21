# 前0–8秒手机产品镜头 · 独立技术验证

目标为 iPhone 17 Pro Max / Cosmic Orange / iOS 26，纯黑摄影棚、克制暖色高光、自然玻璃反射与单手握持。只验证广告开头；原音乐格点和后续分镜、三个重点转场不改。本目录不接入原品牌片 composition。

## 已确认输入

用户指定壁纸为 [AppleWalls 的 iPhone 17 Pro Cosmic Orange 原始PNG](https://applewalls.com/en/wallpapers/iphone/iphone-17-pro-wallpapers)。本地文件1320×2868、2,031,441字节，与该页面链接的 origin PNG 逐字节SHA256一致：`9e7c03cec0c0c587ebfc89f96165ddf1a845db431b26b1abf80c85a05d0d2d94`。原图复制到本次忽略输出，不重绘、换色或用缩略图替代。

手持参考为用户提供的黑底正面手机图，仅参考构图、手姿及摄影质感。该图中的蓝色壁纸、银色边框和课程UI不作为本次宇宙橙机身或原生系统动画证据。参考图SHA256为 `a017e7a5e5a2ed7d62b4a1dea0da9ab9907fab76901da8f213313f45f913f2ab`。

比例依据 [Apple 官方规格](https://support.apple.com/zh-cn/125091)：163.4×78.0×8.75毫米，屏幕1320×2868，铝金属一体机身。尺寸数据用于模型实际量测；商品图、模型名称或作者声明不能代替这一检查。

## 3D与2.5D选择

| 路线 | 商拍观感与动态屏幕 | 实现工作量 / 约束 |
|---|---|---|
| 真实手持视频 + 原生屏幕合成 | 最自然的皮肤、金属、玻璃与微动作；通过屏幕四角追踪/遮挡/反射层置换屏幕 | 有干净底片时较低；需匹配宇宙橙机身、机位、灯光和屏幕追踪 |
| 高质量分层手持PSD / 静帧 + 2.5D | 固定或轻微推近适合参考构图；屏幕智能对象/遮罩可承载视频，机身与反射层保留 | 较低至中等；不能支持大幅绕机或伪造真实握持变化；PSD层和宇宙橙材质仍需打开验证 |
| 精确3D手机 + 棚拍灯光 | 可控制真实网格、金属/玻璃、焦距、反射和镜头；屏幕通过平直UV映射原生视频 | 中等；材质须重新适配渲染器，真实手部仍需底片或额外资产 |
| 真实手部底片 + 3D手机 | 可兼顾可控机身和自然握持 | 较高；相机匹配、遮挡、接触阴影和反射需逐项验证 |

当前倾向先用可授权手持底片/分层素材验证参考构图，同时用独立3D场景验证模型与动态屏幕。路线选择是制作判断，尚未由商品图证明最终效果；无模型输入时中性材质校准只能证明渲染能力。

来源/许可/格式细节在 `sources.json`。资料完整的 [JNO_MODELS 宇宙橙模型](https://www.artstation.com/marketplace/p/yAj8n/apple-iphone-17-pro-max-cosmic-orange) 页面列39美元Extended Commercial、4K PBR及真实比例，未购买；需从Blend/FBX转换并实测。低价 [vendrakwan 宇宙橙模型](https://www.cgtrader.com/3d-models/electronics/phone/iphone-17-pro-max-cosmic-orange-b955d1be-501e-4a60-9b5f-31707e58f2fb) 列10美元及glTF，未购买且UV为Unknown。手持PSD候选 [Ram Studio](https://www.mockupcloud.com/product/hand-holding-iphone-17-pro-max-mockup) 列9美元/5个PSD/4000×2667/Extended License，未购买；是否能保持所需宇宙橙机身与角度尚不确定。

价格是2026-10-14网页列价，非结算报价。用户已授权Chrome登录并下载 [bhatowais786 的免费模型](https://www.cgtrader.com/free-3d-models/electronics/phone/iphone-17-pro-max-f0b2fff3-c049-4853-bc80-e9d97eb835de)，RAR为1,384,109字节、SHA256 `39664522efe45228775e772c7fb91b05ca8de12048110d65541338f94d8124b5`，含Blend/FBX。页面Royalty Free (no AI)与条款21A/21B/24支持渲染成商业作品，禁止独立资产再分发及模型训练；原档未附额外许可文件，来源/作者/许可链接与原档哈希一并保存。没有购买或将商品预览图当成成片。第三方模型/壁纸/原始录像不写Git。原生系统壁纸来自用户指定下载源，网页的“免费下载”不等于独立Stock授权。

免费FBX实际为21个mesh、24,498个三角形、16个Phong材质，无贴图引用。原Blend包含真实可编辑Principled金属参数，FBX不能保留完整PBR。实际Body为77.6×163.0mm，Screen的Display混在玻璃/边框材质组中，图集UV有缺失值与错误正面法线，不能直接换屏。`prepare-model.py`仅处理该已核对Blend的副本：按官方校准宽高、玻璃到背玻璃平面厚度，分离PhoneDisplay、建立连续投影UV并修正法线，保留独立玻璃层。GLB实测宽78.000mm、高163.400mm、玻璃至背玻璃8.750mm；含相机凸台Body深11.059mm，不能混称机身厚度。细节/橙色/手持商业观感仍未验收。独立look-development场景将金属基色调整为受控橙色并保留金属度/粗糙度，不能称经Apple色标校准。

## 原生屏幕采集

已收到用户标明iPhone17ProMax的解锁原片，SHA256 `4c9a66521766533c7f2f18a47717b058e1b45734a5e7cd5343251ac3eeb0421a`；878×1900、2.976667秒、170帧、HEVC Main10/BT.2020/PQ HDR，平均约57.11fps的VFR。约0.85–1.55秒为连续原生上滑解锁，之前已点亮，之后主屏；全时段有屏幕镜像蓝色/电脑岛面图标，无AMS课卡或熄屏唤醒。片中壁纸方向与原厂图一致，但录屏不是1320×2868原图或恒定原生60fps。设备由用户确认，精确iOS26.x未提供。原文件不修改，HDR→SDR检查衍生品的亮度仍需目视验收。

用户要求AMS素材未准备时先完成其他先决条件和可替换裁切流程。仍待后续采集以下系统片段，每段前后各留约2秒稳定画面：

1. 宇宙橙壁纸锁屏稳定 → 实际唤醒/解锁 → 主屏。若录屏无法记录熄灭/唤醒，补同机位真实拍摄，保留系统过程作为合成依据。
2. AMS示例课程紧凑灵动岛稳定 → 长按展开 → 展开停留 → 收起。使用SOE106TC / Programming with C++ / DE-2001；关闭无关通知/其他Live Activity，不操作学校业务。
3. 锁屏原生课程卡片稳定与实际更新。锁屏卡片和灵动岛是不同系统presentation，不将一个位置移动成另一个冒充原生过渡。

请保留原始MOV/MP4和一张完整锁屏截图，注明设备、iOS26.x与AMS版本；不裁剪、不社交压缩。原片可通过本地路径提供。

Build6审核演示可在“仅本机处理”启用课程提醒与“灵动岛与锁屏”，回演示页点课程阶段按钮，等待HTTP状态成功，再回桌面长按岛面展开/收起。该路径由本机ActivityKit创建/更新，不需要APNs推送，但仍需有效审核授权与可用演示HTTP服务；不要把“服务器延迟切到课中”按钮当成离线入口，不读取或写入私密审核码。若实际App没有此入口，先确认版本。

[内置录屏](https://support.apple.com/en-us/102653) 的红色停止指示会出现在顶部/灵动岛，可能干扰目标。优先试 [Mac有线QuickTime](https://support.apple.com/en-au/guide/quicktime-player/qtp356b55534/10.5/mac/26)；官方支持录iPhone屏幕，但未保证锁屏唤醒、岛面或60fps完整记录。QuickTime的iPhone High/Maximum条目均为H.264，不能把Mac摄像头ProRes条目套过来。

[iOS26屏幕捕捉设置](https://support.apple.com/en-gb/guide/iphone/iph2d2500abc/26/ios/26) 可选择SDR/HDR；首轮优先SDR原片。HDR保留原始色彩标签，另验色彩转换。现有iOS27/iPhone18Pro模拟器不能当成指定iOS26/17ProMax实机素材，本阶段不操作/新建模拟器。

## 60fps与兼容性

独立正式验证片规划为8秒/480帧/1080×1920，音乐继续取现有46.080秒入点的前8秒，原36.47秒预演不重写。产品相机/灯光按60fps渲染；系统视频按原始PTS/1倍速读取。30fps或VFR输入只能按时间重复原帧，不能光流补帧或变速冒称原生60fps。需要逐帧检查实际动画区域是否更新，容器帧率仅为第一项证据。

独立依赖采用Remotion4.0.534、React19.2.0、Three0.178.0、R3F9.2.0，对照[同版本官方模板](https://github.com/remotion-dev/remotion/blob/v4.0.534/packages/template-three/package.json)。`ThreeCanvas`逐帧驱动、`useOffthreadVideoTexture`用于确定帧纹理，Chromium ANGLE用于离线WebGL。依赖只安装在 `outputs/phone-opening-proof/runtime/`。技术校准输出在同目录 `compatibility/`，它不代表已验证iPhone模型、原生录屏或商业棚拍质感。

## 输入检查

```powershell
node work/phone-opening-proof/inspect-assets.mjs --wallpaper "C:/Users/linla/Downloads/iPhone 17 Pro Cosmic Orange.png" --reference "D:/Desktop/宣发/douyin/Oct 14, 2026, 01_26_57 AM.jpg" --verify-source
```

输出 `asset-preflight.json` 与保持原字节的两张输入图。`--native` / `--ffprobe` 可检查原生视频的PTS、实际平均帧间隔、色彩标签；`--model` 可读取GLB2.0网格/材质/UV与外部资源清单。文件元数据通过不等于尺寸、镜头、授权或系统动画验收。

## 可以替换、裁切的屏幕槽位

`prepare-screen.mjs --input <新视频路径>`替换源；`screen-edit.json`独立控制像素crop、trimIn/trimOut、placeAt和HDR转换。原帧按PTS以1倍速选择，8秒范围外保持原片首尾帧；60fps输出仅重复已有帧，不合成运动。1320×2886是当前PhoneDisplay UV的专用画布，原878×1900等比放至1320×2856，上下各15px黑边，无内容拉伸。更换模型时必须按其显示面比例重新设置target，而不是沿用手机名称假定UV一致。

```powershell
node work/phone-opening-proof/prepare-screen.mjs --input "<本地录屏路径>" --ffmpeg "<完整FFmpeg路径>"
node work/phone-opening-proof/render-opening.mjs --model "outputs/phone-opening-proof/model-audit/derived/iphone17pm-calibrated.glb" --model-review "outputs/phone-opening-proof/model-audit/derived/model-review.json" --screen "outputs/phone-opening-proof/screen/screen-60fps.mp4" --browser "<Chromium路径>" --ffmpeg "<完整FFmpeg路径>" --ffprobe "<ffprobe路径>"
```

正式换录屏仅重出屏幕槽位/独立开头，不重新处理机身模型、音乐或后续镜头。编码器默认使用独立Remotion runtime自带FFmpeg，完整FFmpeg提供HDR解码与zscale/tonemap。screen-report/source-pts-map记录逐输出帧的源帧号/PTS、crop/pad、首尾保持及色彩参数。两组crop/trim均已实际验证：8秒480帧、完整解码与时间戳通过，输出几何/哈希不同、源字节不变。镜像指示完整保留，没有伪造AMS动画。

`opening.jsx` / `render-opening.mjs`制作独立1080×1920、8秒/480帧/60fps机身与换屏验证；以GLB PBR机身、独立反射玻璃和视频显示面合成，说明文字在WebGL中保证逐帧出现。这是产品合成技术样片；真实单手、干净系统岛面/唤醒和商业棚拍外观验收仍缺，不以本样片称整体开头通过。原36.47秒预演及音乐时间线不改，三个中段转场继续暂缓。
