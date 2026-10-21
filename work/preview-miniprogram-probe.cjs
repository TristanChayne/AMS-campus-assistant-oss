// Official CI runs outside the mini-program; the private key is never copied into the bundle.
const fs=require('node:fs');
const path=require('node:path');
const ci=require('E:/DevTools/Cache/AmsMiniProgramCI/node_modules/miniprogram-ci');
const projectPath=path.resolve('outputs/miniprogram-interface-probe');
const artifacts=path.resolve('outputs/miniprogram-interface-probe-delivery');
fs.mkdirSync(artifacts,{recursive:true});
const project=new ci.Project({appid:'wxe5308ca806b9e927',type:'miniProgram',projectPath,privateKeyPath:'C:/Users/linla/Downloads/private.wxe5308ca806b9e927.key',ignores:['node_modules/**/*','*.md']});
(async()=>{
 const issues=await ci.checkCodeQuality(project);
 fs.writeFileSync(path.join(artifacts,'code-quality.json'),JSON.stringify(issues,null,2));
 console.log('Official code-quality results saved; items:',issues.length);
 const result=await ci.preview({project,desc:'AMS接口验证0.1.12：AMS入口及微服务识别',setting:{useProjectConfig:true},qrcodeFormat:'image',qrcodeOutputDest:path.join(artifacts,'preview-0.1.12.jpg'),pagePath:'pages/probe/index',robot:1,threads:2,onProgressUpdate:()=>{}});
 fs.writeFileSync(path.join(artifacts,'preview-result.json'),JSON.stringify({createdAt:new Date().toISOString(),subPackageInfo:result.subPackageInfo||[]},null,2));
 console.log('PREVIEW_OK',path.join(artifacts,'preview-0.1.12.jpg'));
})().catch(e=>{
 // CI errors can include the originating IP; preserve a local diagnostic, never a key payload.
 const safe=String(e&&e.message||e).replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/g,'[PRIVATE KEY REDACTED]');
 fs.writeFileSync(path.join(artifacts,'preview-error.txt'),safe);
 console.log('PREVIEW_FAILED:',/whitelist|white list|IP.*白名单|invalid ip/i.test(safe)?'IP whitelist configuration required':safe.slice(0,1200));process.exitCode=1;
}).finally(()=>process.exit(process.exitCode||0));
