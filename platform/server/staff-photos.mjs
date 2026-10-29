// JPEG thumbnails only. Files remain behind workspace membership checks.
export const photoKey=(workspace,staff,id)=>`${workspace}/staff/${staff}/${id}.jpg`;
export function decodePhoto(base64,{maxBytes=32768,maxSide=256}={}){
 if(typeof base64!=='string'||base64.length>Math.ceil(maxBytes/3)*4||!base64.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)||base64.length%4)throw Error('Choose a valid staff photo.');
 const raw=atob(base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 if(bytes.length>maxBytes||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('Photo must be a JPEG within the upload size limit.');
 let offset=2,dimensions=null,scan=false;
 while(offset<bytes.length-2){
  if(bytes[offset++]!==255)throw Error('Invalid JPEG photo.');
  while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];if(marker===217)break;
  const length=(bytes[offset]<<8)|bytes[offset+1];if(length<2||offset+length>bytes.length)throw Error('Invalid JPEG photo.');
  if([192,193,194].includes(marker)){if(length<8)throw Error('Invalid JPEG photo.');dimensions={height:(bytes[offset+3]<<8)|bytes[offset+4],width:(bytes[offset+5]<<8)|bytes[offset+6]};}
  if(marker===218){scan=true;break}offset+=length;
 }
 if(!scan||!dimensions||dimensions.width<1||dimensions.height<1||dimensions.width>maxSide||dimensions.height>maxSide)throw Error('Photo exceeds the allowed dimensions.');
 return bytes;
}
export function setStaffPhoto(state,actor,id,photoId){
 if(actor.role!=='manager')throw Error('Manager permission required.');
 const staff=state.staff.find(s=>s.id===id);if(!staff)throw Error('Staff member not found.');
 staff.photoId=photoId;state.audit.unshift({at:new Date().toISOString(),actor:'Manager',message:(photoId?'Updated':'Removed')+' staff photo · '+id});state.audit=state.audit.slice(0,200);return staff;
}
