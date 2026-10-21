const fs=require('node:fs'),path=require('node:path');
const ci=require('E:/DevTools/Cache/AmsMiniProgramCI/node_modules/miniprogram-ci');
const artifacts=path.resolve('outputs/ams-miniprogram-delivery');fs.mkdirSync(artifacts,{recursive:true});
const project=new ci.Project({appid:'wxe5308ca806b9e927',type:'miniProgram',projectPath:path.resolve('outputs/ams-miniprogram'),privateKeyPath:'C:/Users/linla/Downloads/private.wxe5308ca806b9e927.key',ignores:['node_modules/**/*','*.md']});
(async()=>{const issues=await ci.checkCodeQuality(project);fs.writeFileSync(path.join(artifacts,'code-quality.json'),JSON.stringify(issues,null,2));const result=await ci.preview({project,desc:'AMS 0.2.4 课表跨日刷新、卡片样式与自定义课程详情',setting:{useProjectConfig:true},qrcodeFormat:'image',qrcodeOutputDest:path.join(artifacts,'preview-0.2.4.jpg'),pagePath:'pages/today/index',robot:1,threads:2,onProgressUpdate:()=>{}});fs.writeFileSync(path.join(artifacts,'preview-result.json'),JSON.stringify({createdAt:new Date().toISOString(),subPackageInfo:result.subPackageInfo||[]},null,2));console.log('OFFICIAL_PREVIEW_OK');})().catch(e=>{const safe=String(e.message||e).replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/g,'[REDACTED]');fs.writeFileSync(path.join(artifacts,'preview-error.txt'),safe);console.log('OFFICIAL_PREVIEW_FAILED',safe.slice(0,1200));process.exitCode=1;}).finally(()=>process.exit(process.exitCode||0));




