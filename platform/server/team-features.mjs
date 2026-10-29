import * as D from './domain.mjs';
const fail=message=>{throw Error(message)};
const text=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim())?v.trim():fail('Enter valid text of up to '+max+' characters.');
const ident=v=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v);
const stamp=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
const person=(s,id)=>s.staff.find(p=>p.id===id)||fail('Staff member not found.');
const own=(s,a,id)=>{person(s,id);if(a.role!=='manager'&&(a.role!=='staff'||a.staffId!==id))fail('This staff record is not assigned to you.');};
const log=(s,a,m)=>{s.audit.unshift({at:new Date().toISOString(),actor:a.role==='manager'?'Manager':a.staffId,message:m});s.audit=s.audit.slice(0,200);};
export const recipient=a=>a.role==='manager'?'manager':a.staffId;
export function notify(s,target,message,createdAt=new Date().toISOString()){
 s.notifications??=[];s.notifications.unshift({id:'n-'+crypto.randomUUID(),target,message:text(message,300,true),createdAt,readAt:null});s.notifications=s.notifications.slice(0,100);
}
export const notificationsFor=(s,a)=>(s.notifications||[]).filter(n=>n.target===recipient(a));
export function readNotification(s,a,id,at){const n=notificationsFor(s,a).find(n=>n.id===id)||fail('Notification not found or not assigned to you.');n.readAt||=at;return {id:n.id,readAt:n.readAt};}
const weekday=date=>(new Date(date+'T12:00:00Z').getUTCDay()+6)%7;
const time=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const validWeek=week=>Array.isArray(week)&&week.length===7&&Array.from(week).every(d=>d&&typeof d.available==='boolean'&&time(d.start)&&time(d.end)&&D.minutes(d.end)>D.minutes(d.start));
export function assertAvailable(s,j){
 if(!j.staffId||['Cancelled','Paused'].includes(j.status))return;
 if((s.leaveRequests||[]).some(r=>r.staffId===j.staffId&&r.status==='Approved'&&r.from<=j.date&&j.date<=r.to))fail('Approved time off: choose another staff member on '+j.date+'.');
 const w=(s.availability||[]).find(r=>r.staffId===j.staffId)?.week;if(!w)return;
 const d=w[weekday(j.date)];if(!d.available||D.minutes(j.time)<D.minutes(d.start)||D.minutes(j.time)+j.duration>D.minutes(d.end))fail('Outside this staff member’s availability on '+j.date+'.');
}
export function saveAvailability(s,a,data,asOf){
 own(s,a,data.staffId);if(!validWeek(data.week))fail('Set seven valid daily availability windows. Overnight work needs separate daily visits.');
 const next=structuredClone(s);next.availability??=[];const old=next.availability.find(r=>r.staffId===data.staffId),value={staffId:data.staffId,week:structuredClone(data.week)};if(old)Object.assign(old,value);else next.availability.push(value);
 for(const j of next.jobs.filter(j=>j.staffId===data.staffId&&j.date>=asOf&&['Scheduled','In progress'].includes(j.status)))assertAvailable(next,j);
 s.availability=next.availability;log(s,a,'Updated staff availability · '+data.staffId);if(a.role==='staff')notify(s,'manager','A team member updated their weekly availability.');return value;
}
export function requestLeave(s,a,data,asOf){
 own(s,a,data.staffId);if(!D.validDate(data.from)||!D.validDate(data.to)||data.from<asOf||data.to<data.from||(Date.parse(data.to)-Date.parse(data.from))/86400000>366)fail('Choose today or future dates, up to 367 calendar days.');
 if(!['Holiday','Unavailable'].includes(data.type))fail('Choose Holiday or Unavailable.');
 if((s.leaveRequests||[]).some(r=>r.staffId===data.staffId&&['Pending','Approved'].includes(r.status)&&r.from<=data.to&&data.from<=r.to))fail('A pending or approved request already covers these dates.');
 const r={id:'leave-'+crypto.randomUUID(),staffId:data.staffId,from:data.from,to:data.to,type:data.type,note:text(data.note||'',300),status:'Pending',managerNote:''};s.leaveRequests??=[];if(s.leaveRequests.length>=500)fail('Time-off record limit reached. Export records and contact support.');s.leaveRequests.push(r);notify(s,'manager','A new time-off request needs review.');log(s,a,'Requested time off · '+r.id);return r;
}
export function decideLeave(s,a,data){
 const r=(s.leaveRequests||[]).find(r=>r.id===data.id)||fail('Time-off request not found.');
 if(data.status==='Withdrawn'){own(s,a,r.staffId);if(r.status!=='Pending')fail('Only pending requests can be withdrawn.');r.status='Withdrawn';notify(s,'manager','A pending time-off request was withdrawn.');}
 else{
  D.requireManager(a);if(!['Approved','Declined','Cancelled'].includes(data.status)||!(r.status==='Pending'&&data.status!=='Cancelled'||r.status==='Approved'&&data.status==='Cancelled'))fail('Choose a valid decision for this request.');
  if(data.status==='Approved'&&s.jobs.some(j=>j.staffId===r.staffId&&r.from<=j.date&&j.date<=r.to&&['Scheduled','In progress'].includes(j.status)))fail('Reassign or pause booked visits before approving this time off.');
  r.status=data.status;r.managerNote=text(data.managerNote||'',300);notify(s,r.staffId,'Your time-off request was '+data.status.toLowerCase()+'.');
 }log(s,a,'Time-off decision · '+r.id+' · '+r.status);return r;
}
const quoteStatuses=['Draft','Sent','Accepted','Declined','Converted'];
function quoteAmounts(lines,vat){
 if(!Array.isArray(lines)||!lines.length||lines.length>20)fail('Use 1–20 quote lines.');
 const cleaned=lines.map(l=>{const description=text(l.description,200,true),quantity=Number(l.quantity),unitPrice=Number(l.unitPrice);if(!Number.isInteger(quantity)||quantity<1||quantity>1000||!Number.isSafeInteger(unitPrice)||unitPrice<0||unitPrice>10000000)fail('Use whole quantities and prices between £0 and £100,000.');return {description,quantity,unitPrice};});
 const net=cleaned.reduce((n,l)=>n+l.quantity*l.unitPrice,0);if(net>10000000)fail('Quote net value must not exceed £100,000.');const tax=Math.round(net*vat/100);return {lines:cleaned,net,tax,total:net+tax};
}
export function saveQuote(s,a,data,asOf){
 D.requireManager(a);const old=data.id?(s.quotes||[]).find(q=>q.id===data.id):null;if(data.id&&!old)fail('Quote not found.');if(old&&old.status!=='Draft')fail('Issued quotes are locked. Create a new quote for revised terms.');
 if(!s.customers.some(c=>c.id===data.customerId&&c.active))fail('Choose an active customer.');if(!D.validDate(data.validUntil)||data.validUntil<asOf)fail('Choose today or a future expiry date.');
 const vat=Number(data.vat||0);if(![0,20].includes(vat)||vat===20&&!s.supplier?.vatRegistered)fail('VAT quotes require a VAT-registered supplier.');
 const terms=text(data.terms||'',1000),description=text(data.description,500,true),amounts=quoteAmounts(data.lines,vat);
 s.quotes??=[];if(!old&&s.quotes.length>=1000)fail('Quote record limit reached. Export records and contact support.');
 const n=Math.max(1000,...s.quotes.map(q=>Number(q.number.slice(4))))+1;
 const q={...(old||{id:'q-'+crypto.randomUUID(),number:'QVQ-'+n,created:asOf,status:'Draft',snapshot:null,jobId:null}),customerId:data.customerId,validUntil:data.validUntil,description,terms,vat,...amounts};
 if(old)Object.assign(old,q);else s.quotes.push(q);log(s,a,'Saved quote '+q.number);return q;
}
export function quoteAction(s,a,data,asOf,documentMode){
 D.requireManager(a);const q=(s.quotes||[]).find(q=>q.id===data.id)||fail('Quote not found.');
 if(data.action==='issue'){
  if(q.status!=='Draft')fail('Only draft quotes can be issued.');if(q.validUntil<asOf)fail('This quote has expired. Update it before issuing.');
  const c=s.customers.find(c=>c.id===q.customerId);if(!c?.active)fail('Choose an active customer.');const p=s.supplier;if(!p?.legalName||!p.address||!p.contact)fail('Save supplier details in Settings before issuing a quote.');
  if(q.vat===20&&!p.vatRegistered)fail('VAT quotes require a VAT-registered supplier.');
  q.snapshot={supplier:{legalName:p.legalName,tradingName:p.tradingName,address:p.address,contact:p.contact,vatRegistered:p.vatRegistered,vatNumber:p.vatNumber},customer:{name:c.name,address:c.address,email:c.email},issued:asOf,documentMode:documentMode==='live'?'live':'test'};q.status='Sent';
 }else if(['accept','decline'].includes(data.action)){
  if(q.status!=='Sent')fail('Only issued quotes can receive a decision.');if(q.validUntil<asOf)fail('This quote has expired. Create a revised quote.');q.status=data.action==='accept'?'Accepted':'Declined';q.decided=asOf;
 }else if(data.action==='convert'){
  if(q.status!=='Accepted'||q.jobId)fail('Only accepted, unconverted quotes can create a booking.');
  if(!D.validDate(data.date)||data.date<asOf)fail('Choose today or a future booking date.');
  const [j]=D.saveJob(s,a,{customerId:q.customerId,staffId:data.staffId||'',date:data.date,time:data.time,duration:data.duration,price:q.net,round:'Quote '+q.number,repeat:'One-off',count:1});
  j.quoteId=q.id;q.jobId=j.id;q.status='Converted';notify(s,'manager','An accepted quote was converted to a booking.');
 }else fail('Unknown quote action.');log(s,a,'Quote '+q.number+' · '+data.action);return q;
}
export function assignmentNotifications(s,before){
 for(const j of s.jobs){const prior=before.jobs.find(x=>x.id===j.id);if(j.staffId&&(!prior||prior.staffId!==j.staffId||prior.date!==j.date||prior.time!==j.time||prior.status!==j.status&&['Cancelled','Paused'].includes(j.status)))notify(s,j.staffId,'Your work schedule changed. Open Jobs to review your assigned visits.');if(prior?.staffId&&prior.staffId!==j.staffId)notify(s,prior.staffId,'Your work schedule changed. Refresh your assigned jobs.');}
}
const unique=(rows,key='id')=>new Set(rows.map(r=>r?.[key])).size===rows.length;
export function validateFeatures(s){
 try{
  const staff=new Set(s.staff.map(p=>p.id)),jobs=new Map(s.jobs.map(j=>[j.id,j])),qs=s.quotes===undefined?[]:s.quotes,av=s.availability===undefined?[]:s.availability,lr=s.leaveRequests===undefined?[]:s.leaveRequests,ns=s.notifications===undefined?[]:s.notifications;
  if(![qs,av,lr,ns].every(Array.isArray)||qs.length>1000||av.length>s.staff.length||lr.length>500||ns.length>100||!unique(qs)||!unique(qs,'number')||!unique(av,'staffId')||!unique(lr)||!unique(ns))return false;
  if(!av.every(r=>staff.has(r.staffId)&&validWeek(r.week)))return false;
  if(!lr.every(r=>ident(r.id)&&staff.has(r.staffId)&&D.validDate(r.from)&&D.validDate(r.to)&&r.from<=r.to&&['Holiday','Unavailable'].includes(r.type)&&['Pending','Approved','Declined','Cancelled','Withdrawn'].includes(r.status)&&text(r.note,300)===r.note&&text(r.managerNote,300)===r.managerNote))return false;
  if(!ns.every(n=>ident(n.id)&&(n.target==='manager'||staff.has(n.target))&&text(n.message,300,true)===n.message&&stamp(n.createdAt)&&(n.readAt===null||stamp(n.readAt))))return false;
  if(!qs.every(q=>{
   if(!ident(q.id)||!/^QVQ-[1-9]\d{3,11}$/.test(q.number)||!s.customers.some(c=>c.id===q.customerId)||!D.validDate(q.created)||!D.validDate(q.validUntil)||q.validUntil<q.created||!quoteStatuses.includes(q.status)||text(q.description,500,true)!==q.description||text(q.terms,1000)!==q.terms||![0,20].includes(q.vat))return false;
   const v=quoteAmounts(q.lines,q.vat);if(v.net!==q.net||v.tax!==q.tax||v.total!==q.total)return false;
   if(q.status==='Draft'){if(q.snapshot!==null||q.jobId!==null)return false;}else{const x=q.snapshot;if(!x||!D.validDate(x.issued)||!['test','live'].includes(x.documentMode)||!x.supplier||!x.customer||!text(x.supplier.legalName,150,true)||!text(x.supplier.address,500,true)||!text(x.supplier.contact,150,true)||typeof x.supplier.vatRegistered!=='boolean'||q.vat===20&&!x.supplier.vatRegistered||!text(x.customer.name,100,true)||!text(x.customer.address,250,true)||text(x.customer.email,150)!==x.customer.email)return false;}
   if(['Accepted','Declined','Converted'].includes(q.status)&&(!D.validDate(q.decided)||q.decided<q.snapshot.issued||q.decided>q.validUntil))return false;
   return q.status==='Converted'?jobs.get(q.jobId)?.quoteId===q.id&&jobs.get(q.jobId)?.customerId===q.customerId:q.jobId===null;
  }))return false;
  for(const j of s.jobs){if(j.quoteId!==undefined&&!qs.some(q=>q.id===j.quoteId&&q.jobId===j.id&&q.status==='Converted'))return false;const photos=j.photos===undefined?[]:j.photos;if(!Array.isArray(photos)||photos.length>4||!unique(photos)||!photos.every(p=>/^[a-f0-9]{64}$/.test(p.id)&&['before','after'].includes(p.stage)&&text(p.caption,200)===p.caption&&stamp(p.addedAt)))return false;}
  return true;
 }catch{return false;}
}
export function assertFeatureRestore(current,restored){for(const q of current.quotes||[]){if(q.status!=='Draft'&&JSON.stringify((restored.quotes||[]).find(x=>x.id===q.id))!==JSON.stringify(q))fail('Recovery cannot remove or change issued quote evidence.');}}
