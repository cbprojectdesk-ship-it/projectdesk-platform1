// Cloudflare Access identity verifier for a future standalone Worker.
// Access policy configuration and webhook bypass routing are separate launch gates.
const decoder=new TextDecoder();
const decode=(part)=>{if(!/^[A-Za-z0-9_-]+$/.test(part))throw Error('Invalid token encoding');const padded=part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=');return Uint8Array.from(atob(padded),c=>c.charCodeAt(0))};
const parse=(part)=>JSON.parse(decoder.decode(decode(part)));
export async function verifyAccessIdentity(request,{teamDomain,audience,fetcher=fetch,now=()=>Date.now()}={}){
 if(typeof teamDomain!=='string'||!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain)||typeof audience!=='string'||!audience)throw Error('Access verifier configuration missing');
 const token=request.headers.get('cf-access-jwt-assertion');
 if(!token)return null;
 const parts=token.split('.');if(parts.length!==3)return null;
 let header,claims;
 try{header=parse(parts[0]);claims=parse(parts[1])}catch{return null}
 if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid)return null;
 const expectedIssuer='https://'+teamDomain;
 const seconds=Math.floor(now()/1000);
 if(claims.iss!==expectedIssuer||!Array.isArray(claims.aud)||!claims.aud.includes(audience)||!Number.isInteger(claims.exp)||claims.exp<=seconds||!Number.isInteger(claims.iat)||claims.iat>seconds+60||typeof claims.sub!=='string'||!claims.sub||typeof claims.email!=='string'||!claims.email.includes('@'))return null;
 if(claims.nbf!==undefined&&(!Number.isInteger(claims.nbf)||claims.nbf>seconds))return null;
 const response=await fetcher(expectedIssuer+'/cdn-cgi/access/certs');
 if(!response.ok)throw Error('Access key retrieval failed');
 const keys=(await response.json()).keys;
 if(!Array.isArray(keys))throw Error('Invalid Access key response');
 const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use==='sig'&&k.alg==='RS256');
 if(!jwk)return null;
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const data=new TextEncoder().encode(parts[0]+'.'+parts[1]);
 const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),data);
 return valid?{id:'access:'+claims.sub,email:claims.email}:null;
}
