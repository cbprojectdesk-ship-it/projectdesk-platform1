// Crop and re-encode on the device: no original file or EXIF metadata is uploaded.
export async function prepareStaffPhoto(file,{job=false}={}){
 if(!file||!file.size)throw Error('Take or choose a staff photo first.');
 if(file.size>20*1024*1024)throw Error('Choose a photo smaller than 20 MB.');
 if(file.type&&!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type))throw Error('Choose a JPEG, PNG, WebP or supported phone photo.');
 let image,url;
 try{
  if(typeof createImageBitmap==='function')image=await createImageBitmap(file,{imageOrientation:'from-image'});
  else{url=URL.createObjectURL(file);image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Photo could not be opened. Try a JPEG or PNG.'));img.src=url});}
  const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;if(!width||!height)throw Error('Photo could not be opened.');
  const canvas=document.createElement('canvas');const scale=Math.min(1,1280/Math.max(width,height));canvas.width=job?Math.max(1,Math.round(width*scale)):224;canvas.height=job?Math.max(1,Math.round(height*scale)):224;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Photo resizing is unavailable in this browser.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);const edge=Math.min(width,height);if(job)ctx.drawImage(image,0,0,canvas.width,canvas.height);else ctx.drawImage(image,(width-edge)/2,(height-edge)/2,edge,edge,0,0,224,224);
  for(const quality of [0.8,0.65,0.5,0.35]){const base64=canvas.toDataURL('image/jpeg',quality).split(',')[1];if(base64&&atob(base64).length<=(job?262144:32768))return base64;}
  throw Error('This photo is too detailed. Try a simpler photo.');
 }catch(e){throw Error(e.message||'Photo could not be opened. Try a JPEG or PNG.');}
 finally{image?.close?.();if(url)URL.revokeObjectURL(url);}
}
