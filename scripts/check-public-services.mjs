// Read-only external acceptance for the public surfaces. No credentials.
import assert from 'node:assert/strict';
const app='https://quenvira-business-demo.sprogg1973.chatgpt.site';
const ccs='https://ccs-creative-technologies.sprogg1973.chatgpt.site';
async function fetchChecked(url,options={}){
 let last;
 for(let n=0;n<3;n++){
  try{const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000),redirect:'error'});return r}catch(e){last=e}
 }
 throw last;
}
const checks=[
 ['CCS homepage',async()=>{const r=await fetchChecked(ccs+'/');assert.equal(r.status,200);assert.ok(/Try (?:the |Quenvira )?Demo/i.test(await r.text()),'Demo link missing')}],
 ['Gold demo styling',async()=>{const r=await fetchChecked(ccs+'/style.css');assert.equal(r.status,200);const css=await r.text();for(const color of ['#FFF4C9','#E5A900','#F5BE30'])assert.ok(css.includes(color),color)}],
 ['Public demo',async()=>{const r=await fetchChecked(ccs+'/quenvira-demo/');assert.equal(r.status,200);assert.match(await r.text(),/Quenvira/i)}],
 ['Quenvira homepage',async()=>{const r=await fetchChecked(app+'/');assert.equal(r.status,200);assert.match(await r.text(),/Quenvira/)}],
 ['Storage and configuration readiness',async()=>{const r=await fetchChecked(app+'/api/quenvira/health');assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'ok'})}],
 ['Anonymous workspace access denied',async()=>{const r=await fetchChecked(app+'/api/quenvira/session');assert.equal(r.status,401);assert.match((await r.json()).error,/Sign in/)}],
 ['Unsigned payment webhook rejected',async()=>{const r=await fetchChecked(app+'/api/quenvira/subscription-webhook',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(r.status,400);assert.match((await r.json()).error,/signature/i)}],
 ['Subscription terms available',async()=>{const r=await fetchChecked(app+'/subscription-terms');assert.equal(r.status,200);assert.match(await r.text(),/19/)}]
];
let failed=0;
for(const [name,check] of checks){try{await check();console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+': '+error.message)}}
if(failed)process.exitCode=1;
