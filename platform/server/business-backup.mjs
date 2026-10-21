import {validateState,requireManager} from './domain.mjs';
import {photoKey,decodePhoto} from './staff-photos.mjs';
export const BACKUP_LIMIT=20*1024*1024;
const encoder=new TextEncoder();
export async function createBusinessBackup(state,workspaceName,workspace,bucket,timestamp){
 const backup={format:'quenvira-business-backup-v1',createdAt:timestamp,workspaceName,state,photos:[]};let size=encoder.encode(JSON.stringify(backup)).length;
 for(const staff of state.staff.filter(s=>s.photoId)){
  if(!bucket)throw Error('Photo storage is unavailable. A complete backup could not be created.');
  const object=await bucket.get(photoKey(workspace,staff.id,staff.photoId));if(!object)throw Error('A staff photo is unavailable. A complete backup could not be created.');
  const bytes=new Uint8Array(await new Response(object.body).arrayBuffer());const jpegBase64=btoa(String.fromCharCode(...bytes));decodePhoto(jpegBase64);
  const photo={staffId:staff.id,photoId:staff.photoId,jpegBase64};size+=encoder.encode(JSON.stringify(photo)).length+1;if(size>BACKUP_LIMIT)throw Error('Backup exceeds the 20 MB limit.');backup.photos.push(photo);
 }
 return backup;
}
export async function prepareBusinessRestore(current,actor,backup,workspace,bucket,hash){
 requireManager(actor);
 if(['staff','customers','jobs','invoices','audit'].some(key=>current[key].length)||current.supplier)throw Error('Restore requires an empty workspace. Existing work has not been changed.');
 if(!backup||backup.format!=='quenvira-business-backup-v1'||typeof backup.createdAt!=='string'||!Number.isFinite(Date.parse(backup.createdAt))||typeof backup.workspaceName!=='string'||!backup.workspaceName.trim()||backup.workspaceName.length>120||!Array.isArray(backup.photos)||!validateState(backup.state))throw Error('The business backup is incomplete or unsupported.');
 if(Object.keys(backup.state).some(key=>!['version','customers','staff','jobs','invoices','audit','supplier'].includes(key)))throw Error('The backup contains unsupported record fields.');
 if(encoder.encode(JSON.stringify(backup)).length>BACKUP_LIMIT)throw Error('Backup exceeds the 20 MB limit.');
 const staff=backup.state.staff.filter(s=>s.photoId);if(backup.photos.length!==staff.length)throw Error('The backup is missing staff photos or contains extra photos.');
 const seen=new Set(),uploads=[];
 for(const photo of backup.photos){
  const member=staff.find(s=>s.id===photo.staffId);if(!member||seen.has(photo.staffId)||member.photoId!==photo.photoId)throw Error('The backup contains inconsistent photo references.');seen.add(photo.staffId);
  const bytes=decodePhoto(photo.jpegBase64);if(await hash(photo.jpegBase64)!==photo.photoId)throw Error('A backup photo failed its integrity check.');uploads.push({key:photoKey(workspace,member.id,photo.photoId),bytes});
 }
 if(uploads.length&&!bucket){const error=Error('Photo storage is unavailable. No records were restored.');error.backupStorage=true;throw error}
 // Validate every record and image before storing any image. Database publication
 // happens later in the usual atomic, revision-checked command transaction.
 try{for(const upload of uploads)await bucket.put(upload.key,upload.bytes,{httpMetadata:{contentType:'image/jpeg'}})}catch{const error=Error('Backup photos could not be stored. No records were restored. Try again.');error.backupStorage=true;throw error}
 return structuredClone(backup.state);
}
