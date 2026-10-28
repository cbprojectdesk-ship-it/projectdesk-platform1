import {handle} from './api.mjs';
import {emailConfig} from './invoice-delivery.mjs';

const tools=[
 {name:'quenvira_email_retry_status',description:'Read counts of due and review-required invoice emails in workspaces you manage. Does not send messages or return recipient details.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'quenvira_process_due_invoice_emails',description:'Process up to three due invoice emails in workspaces you manage, using existing recipient, mode, subscription, suppression, lease and duplicate-send safeguards. Does not create invoices or enable live sending.',inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

/**
 * @param {Request} request
 * @param {any} db
 * @param {{billingEnv?:Record<string,any>,bucket?:any,now?:()=>Date,billingClient?:any}} [options]
 */
export async function emailMcp(request,db,{billingEnv={},bucket,now=()=>new Date(),billingClient}={}){
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Use JSON requests.'},415);
 let bytes=0,body='';
 const reader=request.body?.getReader();if(!reader)return json({error:'Request required.'},400);
 const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>8192){await reader.cancel();return json({error:'Request too large.'},413)}body+=decoder.decode(value,{stream:true})}
 let rpc;try{rpc=JSON.parse(body);if(!rpc||typeof rpc!=='object'||Array.isArray(rpc))throw Error()}catch{return json({error:'Invalid request.'},400)}
 const reply=result=>json({jsonrpc:'2.0',id:rpc.id??null,result});
 const error=(code,message)=>json({jsonrpc:'2.0',id:rpc.id??null,error:{code,message}});
 if(rpc.method==='server/discover')return reply({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
 if(rpc.method==='tools/list')return reply({tools});
 if(rpc.method!=='tools/call')return error(-32601,'Method not found.');
 const name=rpc.params?.name,args=rpc.params?.arguments??{};
 if(!tools.some(t=>t.name===name))return error(-32601,'Tool not found.');
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)return error(-32602,'This tool accepts no arguments.');
 const user=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
 if(!user||!email)return json({error:'Sign in with ChatGPT to continue.'},401);
 if(!db)return json({error:'Persistent storage is unavailable.'},503);
 try{
  // Authoritative app memberships limit the task to its caller's businesses.
  const authority=await db.prepare("SELECT workspace_id FROM memberships WHERE user_id=? AND role='manager' LIMIT 1").bind(user).first();
  if(!authority)return json({error:'Manager access required.'},403);
  const mode=emailConfig(billingEnv)?.mode;
  if(!mode)return reply({content:[{type:'text',text:'Invoice email is not configured. Nothing was sent.'}],isError:true});
  const timestamp=now().toISOString();
  const count=await db.prepare(`SELECT COUNT(*) AS due FROM invoice_outbox o WHERE o.mode=? AND EXISTS (SELECT 1 FROM memberships m WHERE m.workspace_id=o.workspace_id AND m.user_id=? AND m.role='manager') AND ((o.status IN ('queued','retry') AND o.next_attempt_at<=?) OR (o.status='sending' AND o.lease_until<=?))`).bind(mode,user,timestamp,timestamp).first();
  const review=await db.prepare("SELECT COUNT(*) AS review FROM invoice_outbox o WHERE o.mode=? AND o.status='review' AND EXISTS (SELECT 1 FROM memberships m WHERE m.workspace_id=o.workspace_id AND m.user_id=? AND m.role='manager')").bind(mode,user).first();
  let processed=0,blocked=0;
  if(name==='quenvira_process_due_invoice_emails'){
   const workspaces=await db.prepare(`SELECT o.workspace_id,MIN(o.created_at) AS oldest FROM invoice_outbox o WHERE o.mode=? AND EXISTS (SELECT 1 FROM memberships m WHERE m.workspace_id=o.workspace_id AND m.user_id=? AND m.role='manager') AND ((o.status IN ('queued','retry') AND o.next_attempt_at<=?) OR (o.status='sending' AND o.lease_until<=?)) GROUP BY o.workspace_id ORDER BY oldest LIMIT 3`).bind(mode,user,timestamp,timestamp).all();
   for(const row of workspaces.results){
    // Reuse the ordinary manager API, including fresh membership and billing checks.
    const origin=new URL(request.url).origin;
    const inner=new Request(origin+'/api/quenvira/workspaces/'+encodeURIComponent(row.workspace_id)+'/email-dispatch',{method:'POST',headers:{'content-type':'application/json',origin,'oai-authenticated-user-id':user,'oai-authenticated-user-email':email},body:'{}'});
    const result=await handle(inner,db,{billingEnv,bucket,now,billingClient,emailDispatchLimit:1});
    if(result.ok)processed+=(await result.json()).processed;else blocked++;
   }
  }
  return reply({content:[{type:'text',text:JSON.stringify({mode,dueBefore:count.due,review:review.review,processed,blocked})}],...(blocked?{isError:true}:{})});
 }catch{return reply({content:[{type:'text',text:'Email retry check failed. Queue retained; no delivery claim is made.'}],isError:true})}
}
