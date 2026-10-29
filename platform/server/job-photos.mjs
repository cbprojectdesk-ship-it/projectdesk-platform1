import {getJob} from './domain.mjs';
import {decodePhoto} from './staff-photos.mjs';
export const jobPhotoKey=(workspace,job,id)=>`${workspace}/jobs/${job}/${id}.jpg`;
export const decodeJobPhoto=value=>decodePhoto(value,{maxBytes:262144,maxSide:1280});
export function prepareJobPhoto(state,actor,data,timestamp){
 const j=getJob(state,actor,data.id);
 if(['Completed','Cancelled'].includes(j.status))throw Error('Completed and cancelled visits keep their photo evidence unchanged.');
 j.photos??=[];
 if(data.remove){const i=j.photos.findIndex(p=>p.id===data.remove);if(i<0)throw Error('Job photo not found.');j.photos.splice(i,1);return null;}
 if(j.photos.length>=4)throw Error('Use up to four before/after photos per visit.');
 if(!['before','after'].includes(data.stage)||typeof data.caption!=='string'||data.caption.length>200)throw Error('Choose before or after and a caption up to 200 characters.');
 const p={id:'pending',stage:data.stage,caption:data.caption.trim(),addedAt:timestamp};j.photos.push(p);
 state.audit.unshift({at:timestamp,actor:actor.role==='manager'?'Manager':actor.staffId,message:'Added private visit photo · '+j.id});state.audit=state.audit.slice(0,200);return p;
}
