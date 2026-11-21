import {emailConfig,dispatchEmails} from './invoice-delivery.mjs';

// Only a successful, authenticated workspace command can wake its own outbox.
// Keep the response independent of provider latency and preserve queued work on
// failure. One request per wake fits within the Worker's background lifetime.
export function dispatchAfterCommand(request,response,env,context){
 if(request.method!=='POST'||!response.ok||!env.DB||response.headers.get('x-quenvira-email-wake')==='skip')return;
 const match=new URL(request.url).pathname.match(/^\/api\/quenvira\/workspaces\/([a-zA-Z0-9_-]+)\/commands(?:\/photo)?$/);
 const config=emailConfig(env);
 if(!match||!config)return;
 context.waitUntil(dispatchEmails(env.DB,config,{workspace:match[1],limit:1}).catch(()=>{
  // Never log provider payloads, recipient details, credentials or raw errors.
  console.error('Invoice email dispatch deferred; durable queue retained.');
 }));
}
