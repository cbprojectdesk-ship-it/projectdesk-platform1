import { env } from 'cloudflare:workers';
import { handle } from '../../../../server/api.mjs';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>handle(request,env.DB,{bucket:env.BUCKET});
export const POST=(request:Request)=>handle(request,env.DB,{bucket:env.BUCKET});
