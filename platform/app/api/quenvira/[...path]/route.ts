import { env } from 'cloudflare:workers';
import { handle } from '../../../../server/api.mjs';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>handle(request,env.DB,{bucket:env.BUCKET,pilotEmails:env.QUENVIRA_PILOT_EMAILS,billingEnv:env});
export const POST=(request:Request)=>handle(request,env.DB,{bucket:env.BUCKET,pilotEmails:env.QUENVIRA_PILOT_EMAILS,billingEnv:env});
