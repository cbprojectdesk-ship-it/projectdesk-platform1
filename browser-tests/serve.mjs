// CI-only bridge: real client + real API/domain + disposable SQLite.
// It simulates hosting identity. It must never run as a hosted application.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {handle} from '../platform/server/api.mjs';
import {database,setup,fixtures,command,job,fixed} from '../platform/tests/support/database.mjs';

if(process.env.GITHUB_ACTIONS!=='true'||process.env.QUENVIRA_E2E!=='1')throw Error('Browser fixture server is GitHub Actions only.');
const origin='http://127.0.0.1:4173';
const root=fileURLToPath(new URL('../platform/public/',import.meta.url));
const sessions=new Map();
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,origin),key=req.headers['x-e2e-session'];
  const send=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body)};
  if(url.pathname==='/__test/health')return send(200,'{}');
  if(req.headers.host!=='127.0.0.1:4173')return send(403,'{}');
  if(typeof key!=='string'||!/^[a-f0-9-]{36}$/.test(key))return send(403,'{}');
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>(url.pathname.endsWith('/commands/photo')?65536:16384))return send(413,'{}');chunks.push(chunk)}
  const body=Buffer.concat(chunks).toString('utf8');
  if(url.pathname==='/__test/seed'&&req.method==='POST'){
   sessions.get(key)?.db.sqlite.close();
   if(!sessions.has(key)&&sessions.size>=200)return send(429,'{}');
   const db=database(),workspaceId=await setup(db,'alice'),otherWorkspaceId=await setup(db,'outsider');
   const scenario=JSON.parse(body||'{}').scenario;let assignedJobId;
   if(scenario==='seeded'){
    const f=await fixtures(db,workspaceId);
    const saved=await command(db,workspaceId,'job.save',{...job(f),price:7899},'alice');assignedJobId=saved.body.result[0].id;
    db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(workspaceId,'worker',f.staffId);
    const c=await command(db,workspaceId,'customer.save',{name:'Other worker customer',type:'Domestic',address:'Other fictional address',email:'private@example.com',notes:''},'alice');
    const s=await command(db,workspaceId,'staff.add',{name:'Other worker',role:'Cleaner',capacity:480},'alice');
    await command(db,workspaceId,'job.save',{...job({customerId:c.body.result.id,staffId:s.body.result.id}),time:'13:00'},'alice');
   }
   sessions.set(key,{db,workspaceId,otherWorkspaceId});return send(200,JSON.stringify({workspaceId,otherWorkspaceId,assignedJobId}));
  }
  const session=sessions.get(key);if(!session)return send(404,'{}');
  if(url.pathname.startsWith('/api/quenvira/')){
   const headers=new Headers(req.headers);
   headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');
   const user=req.headers['x-e2e-user']||'alice';
   if(['alice','worker','outsider'].includes(user)){headers.set('oai-authenticated-user-id',user);headers.set('oai-authenticated-user-email',user+'@example.com')}
   const response=await handle(new Request(url,{method:req.method,headers,...(body?{body}:{})}),session.db,{now:fixed,bucket:session.db.bucket});
   res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
  }
  if(req.method!=='GET')return send(405,'{}');
  const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!filename.startsWith(root)||!fs.existsSync(filename)||!fs.statSync(filename).isFile())return send(404,'{}');
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
  send(200,fs.readFileSync(filename),types[path.extname(filename)]||'application/octet-stream');
 }catch(error){console.error(error.message);res.writeHead(500);res.end('{}')}
});
server.listen(4173,'127.0.0.1');
process.on('SIGTERM',()=>server.close(()=>{for(const {db}of sessions.values())db.sqlite.close();process.exit(0)}));
