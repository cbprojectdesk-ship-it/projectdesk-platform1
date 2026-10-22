// Security boundary for future standalone public Cloudflare Worker hosting.
// The managed Sites runtime injects verified identity headers, but an ordinary
// public Worker cannot trust the same names when supplied by browsers.
// Until a real session verifier is implemented, reject standalone private routes.
const forbidden=/^oai-authenticated-user-/i;
export function guardStandaloneRequest(request,{verifiedPrincipal}={}){
 const url=new URL(request.url);
 const headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(forbidden.test(name))headers.delete(name);
 if(url.pathname==='/api/quenvira/subscription-webhook'){
  // Stripe signs the raw request body. The webhook handler verifies its signature.
  return {request:new Request(request,{headers}),principal:null};
 }
 if(!verifiedPrincipal?.id||!verifiedPrincipal?.email){
  return {response:new Response(JSON.stringify({error:'Authentication unavailable.'}),{
   status:401,headers:{'content-type':'application/json','cache-control':'no-store'}
  })};
 }
 // Identity must come from a verified server-side session, never caller headers.
 headers.set('oai-authenticated-user-id',verifiedPrincipal.id);
 headers.set('oai-authenticated-user-email',verifiedPrincipal.email);
 return {request:new Request(request,{headers}),principal:verifiedPrincipal};
}
