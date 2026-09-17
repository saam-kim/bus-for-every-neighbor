// PLAYWRIGHT_MODULE may point to a bundled Playwright installation.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('dist'),artifacts=path.resolve('tmp/usability');
fs.mkdirSync(artifacts,{recursive:true});
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/firebase-config.js'){res.setHeader('Content-Type','text/javascript');res.end('export const firebaseConfig=null;');return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.woff2':'font/woff2'};
 try{res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1194,height:834},hasTouch:true});
 const errors=[];context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
 const teacher=await context.newPage();await teacher.goto(url);
 await teacher.locator('#create-class').click();await teacher.locator('.qr-modal').waitFor();
 const code=await teacher.locator('.big-code b').textContent();
 await teacher.locator('.modal-x').click();
 const student=await context.newPage();await student.goto(url+'#join');
 await student.locator('#class-code').fill(code);await student.locator('#code-form button').click();
 await student.locator('#team-name').fill('검토용 2인조');await student.locator('#join-team').click();
 await student.locator('.classroom-lock').waitFor();
 await teacher.waitForFunction(()=>document.querySelector('.team-row:not(.header)')?.textContent.includes('아직 운행 전'));
 await teacher.locator('[data-action=start]').click();await student.locator('.modal .primary[data-action=close]').click();
 await student.locator('.stop[data-id=S] .stop-label').click();
 assert.match(await student.locator('.route-list').innerText(),/학교/);
 const layout=await student.evaluate(()=>{const m=document.querySelector('.map-scene').getBoundingClientRect(),f=document.querySelector('.bottom-bar .primary').getBoundingClientRect();return {ratio:m.width/m.height,buttonBottom:f.bottom,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};});
 assert.ok(Math.abs(layout.ratio-4/3)<.01);assert.ok(layout.buttonBottom<=layout.height);assert.ok(layout.scrollWidth<=layout.width);
 await student.screenshot({path:path.join(artifacts,'student-ipad.png')});
 await student.locator('.bottom-bar [data-action=run]').click();
 const draft=teacher.locator('#broadcast');await draft.fill('입력 중인 교사 안내');const handle=await draft.elementHandle();
 const clock=await student.locator('#clock').innerText();await student.waitForTimeout(1600);
 assert.notEqual(await student.locator('#clock').innerText(),clock);
 assert.equal(await draft.inputValue(),'입력 중인 교사 안내');assert.equal(await handle.evaluate(el=>el.isConnected),true);
 await teacher.locator('[data-action=broadcast]').click();
 const announced=await student.locator('#clock').innerText();await student.waitForTimeout(900);assert.notEqual(await student.locator('#clock').innerText(),announced);
 await teacher.locator('[data-action=pause]').click();await student.locator('.classroom-lock').waitFor();
 assert.equal(await student.locator('.workspace').evaluate(el=>el.inert),true);
 const paused=await student.locator('#clock').innerText();await student.waitForTimeout(700);assert.equal(await student.locator('#clock').innerText(),paused);
 await teacher.locator('[data-action=pause]').click();await student.locator('.classroom-lock').waitFor({state:'detached'});
 assert.equal(await student.locator('.workspace').evaluate(el=>el.inert),false);
 await student.locator('.top-nav [data-action=results]').click();await student.locator('#attempt').waitFor();
 await teacher.waitForFunction(()=>document.querySelector('.team-row:not(.header)')?.textContent.includes('1회'));
 await student.locator('[data-action=reflection]').click();
 const answer=student.locator('#reflection-0');await answer.fill('민서가 학교에 갈 수 있게 되었는지 첫 시도와 비교했다.');const input=await answer.elementHandle();
 await student.waitForTimeout(700);assert.equal(await input.evaluate(el=>el===document.activeElement&&el.isConnected),true);
 await teacher.locator('.team-row:not(.header)').click();
 assert.match(await teacher.locator('.teacher-reflections').innerText(),/민서가 학교/);
 await teacher.locator('.modal-x').click();
 await student.locator('[data-action=results]').last().click();await student.locator('[data-action=redesign]').click();
 await student.locator('#departure').fill('07:10');await student.locator('#departure').dispatchEvent('change');
 await student.locator('.bottom-bar [data-action=run]').click();await student.locator('.bottom-bar [data-action=finish]').click();
 assert.equal(await student.locator('#attempt option').count(),2);
 await teacher.waitForFunction(()=>document.querySelector('.team-row:not(.header)')?.textContent.includes('2회'));
 await teacher.locator('.team-row:not(.header)').click();assert.match(await teacher.locator('.team-modal').innerText(),/첫 시도와 최근 시도 비교/);
 await teacher.screenshot({path:path.join(artifacts,'teacher-comparison.png')});
 await student.reload();await student.locator('.bottom-bar [data-action=results]').click();assert.equal(await student.locator('#attempt option').count(),2);
 await teacher.locator('.modal-x').click();await teacher.setViewportSize({width:1024,height:768});
 assert.equal(await teacher.locator('.stage-pill span').first().isVisible(),true);
 await teacher.screenshot({path:path.join(artifacts,'teacher-1024.png')});
 assert.deepEqual(errors,[]);
 console.log('PASS code entry; touch labels; 1194×834 layout; live student sync; teacher draft; pause/resume; both result buttons; reflections; comparison; reload; 1024px stages');
 console.log(JSON.stringify({layout,screenshots:artifacts},null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

