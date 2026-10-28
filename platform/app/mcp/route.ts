import {env} from 'cloudflare:workers';
import {emailMcp} from '../../server/email-mcp.mjs';
export const dynamic='force-dynamic';
export const POST=(request:Request)=>emailMcp(request,env.DB,{billingEnv:env,bucket:env.BUCKET});
