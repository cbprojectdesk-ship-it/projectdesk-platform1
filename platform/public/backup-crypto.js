// Encryption happens on the manager's device. No password is sent to Quenvira.
export const BACKUP_LIMIT=20*1024*1024;
const iterations=600000,format='quenvira-encrypted-business-backup-v1';
const text=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const encode=bytes=>{let raw='';for(let n=0;n<bytes.length;n+=8192)raw+=String.fromCharCode(...bytes.subarray(n,n+8192));return btoa(raw)};
const decode=(value,max)=>{if(typeof value!=='string'||value.length>max*1.34+8||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('Invalid backup encoding.');const raw=atob(value);if(raw.length>max)throw Error('Backup is too large.');return Uint8Array.from(raw,c=>c.charCodeAt(0))};
function passwordCheck(password){if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Use a backup password with 12–256 characters.');if(!globalThis.crypto?.subtle)throw Error('Secure backup encryption is unavailable in this browser.');}
async function keyFor(password,salt,usage){const key=await crypto.subtle.importKey('raw',text.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,[usage])}
export async function encryptBusinessBackup(snapshot,password){
 passwordCheck(password);const bytes=text.encode(JSON.stringify(snapshot));if(bytes.length>BACKUP_LIMIT)throw Error('Backup exceeds the 20 MB limit.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:text.encode(format)},await keyFor(password,salt,'encrypt'),bytes);
 return JSON.stringify({format,iterations,salt:encode(salt),iv:encode(iv),encrypted:encode(new Uint8Array(encrypted))});
}
export async function decryptBusinessBackup(fileText,password){
 passwordCheck(password);if(typeof fileText!=='string'||fileText.length>BACKUP_LIMIT*1.4+1024)throw Error('Choose a backup smaller than 29 MB.');
 try{const x=JSON.parse(fileText);if(x.format!==format||x.iterations!==iterations)throw Error();const salt=decode(x.salt,16),iv=decode(x.iv,12),encrypted=decode(x.encrypted,BACKUP_LIMIT+16);if(salt.length!==16||iv.length!==12||encrypted.length<17)throw Error();
 const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:text.encode(format)},await keyFor(password,salt,'decrypt'),encrypted);
 if(bytes.byteLength>BACKUP_LIMIT)throw Error();const snapshot=JSON.parse(decoder.decode(bytes));if(snapshot?.format!=='quenvira-business-backup-v1')throw Error();return snapshot;
 }catch{throw Error('The backup password is incorrect, or the file is damaged or unsupported. No records were restored.')}
}
