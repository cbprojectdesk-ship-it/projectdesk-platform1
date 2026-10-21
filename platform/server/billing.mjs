// Server-only billing operations. Issued snapshots are independent of editable
// customer/supplier records. All monetary values are integer pence.
const fail=message=>{throw Error(message)};
const manager=actor=>{if(actor?.role!=='manager')fail('Manager permission required.')};
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))fail('Supplier text is invalid or too long.');const v=value.trim();if(required&&!v)fail('Complete the required supplier details.');return v};
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='0001-01-01'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
function profile(data){
 const p={legalName:text(data.legalName,150,true),tradingName:text(data.tradingName||'',100),address:text(data.address,500,true),contact:text(data.contact,150,true),entity:data.entity,companyNumber:text(data.companyNumber||'',20),vatRegistered:data.vatRegistered,vatNumber:text(data.vatNumber||'',20)};
 if(!['sole-trader','limited-company','other'].includes(p.entity)||typeof p.vatRegistered!=='boolean')fail('Choose the supplier type and VAT registration status.');
 if(p.entity==='limited-company'&&!/^(?:\d{8}|[A-Z]{2}\d{6})$/.test(p.companyNumber))fail('Enter an eight-character UK company number.');
 if(p.vatRegistered&&!/^(?:GB)?\d{9}(?:\d{3})?$/.test(p.vatNumber))fail('Enter a UK VAT registration number (9 or 12 digits, optional GB prefix).');
 if(!p.vatRegistered&&p.vatNumber)fail('Clear the VAT number when not VAT registered.');
 return p;
}
const audit=(state,message)=>{state.audit.unshift({at:new Date().toISOString(),actor:'Manager',message});state.audit=state.audit.slice(0,200)};
export function saveSupplier(state,actor,data){manager(actor);const p=profile(data);state.supplier=p;audit(state,'Updated invoice supplier profile');return p}
export function issueInvoice(state,actor,id,asOf){
 manager(actor);const i=state.invoices.find(i=>i.id===id);
 if(!i||i.status!=='Draft'||i.issue)fail('Only an unpaid draft can be issued.');
 if(!date(asOf))fail('Choose a valid invoice date.');
 if(!state.supplier)fail('Save your supplier details in Settings before issuing an invoice.');
 const supplier=profile(state.supplier),j=state.jobs.find(j=>j.id===i.jobId);
 if(!j||j.status!=='Completed'||j.date>asOf)fail('The completed service date must not be in the future.');
 if(i.vat&&!supplier.vatRegistered)fail('A supplier without VAT registration cannot issue a VAT invoice.');
 const due=new Date(asOf+'T12:00:00Z');due.setUTCDate(due.getUTCDate()+14);if(due.getUTCFullYear()>9999)fail('Due date is outside the supported calendar.');
 const issue={supplier:structuredClone(supplier),supplyDate:j.date,line:{description:i.description,quantity:1,unit:'visit',unitPrice:i.net}};
 Object.assign(i,{issued:asOf,due:due.toISOString().slice(0,10),issue,status:'Issued'});audit(state,'Issued invoice '+i.number);return i;
}
export function creditInvoice(state,actor,id,reason,asOf){
 manager(actor);const i=state.invoices.find(i=>i.id===id);
 if(!i?.issue||i.status!=='Issued'||i.credit||i.paidOn)fail('Only an unpaid issued invoice can be fully credited. Paid-invoice refunds are not supported.');
 const clean=text(reason,500,true);if(!date(asOf)||asOf<i.issued)fail('Choose a valid credit date after issue.');
 const highest=Math.max(1000,...state.invoices.filter(v=>v.credit).map(v=>Number(v.credit.number.slice(3))));
 i.credit={number:'CN-'+(highest+1),date:asOf,reason:clean,invoiceNumber:i.number,invoiceDate:i.issued,net:i.net,tax:i.tax,total:i.total};i.status='Credited';audit(state,'Fully credited invoice '+i.number+' · '+i.credit.number);return i;
}
export function validBilling(state){
 try{
  if(state.supplier!==undefined&&JSON.stringify(profile(state.supplier))!==JSON.stringify(state.supplier))return false;
  const credits=new Set();
  for(const i of state.invoices){
   if(!i.issue){if(i.credit||['Issued','Credited'].includes(i.status))return false;continue}
   const x=i.issue,p=profile(x.supplier),line=x.line;
   if(JSON.stringify(p)!==JSON.stringify(x.supplier)||!date(x.supplyDate)||x.supplyDate>i.issued||!['Issued','Paid','Credited'].includes(i.status)||i.vat&&!p.vatRegistered)return false;
   if(!line||line.description!==i.description||line.quantity!==1||line.unit!=='visit'||line.unitPrice!==i.net)return false;
   if(i.status==='Credited'){
    const c=i.credit;if(!c||!/^CN-[1-9]\d{3,11}$/.test(c.number)||credits.has(c.number)||!date(c.date)||c.date<i.issued||text(c.reason,500,true)!==c.reason||c.invoiceNumber!==i.number||c.invoiceDate!==i.issued||c.net!==i.net||c.tax!==i.tax||c.total!==i.total||i.paidOn!==null)return false;
    credits.add(c.number);
   }else if(i.credit!==undefined)return false;
  }
  return true;
 }catch{return false}
}
export function assertFinancialRestore(current,restored){
 // A historical workspace restore must not remove, alter, unpay or reuse an
 // issued invoice/credit. Independent disaster recovery is a separate process.
 for(const i of current.invoices.filter(i=>i.issue)){
  if(JSON.stringify(restored.invoices.find(v=>v.id===i.id))!==JSON.stringify(i))fail('This revision would change issued financial records. Choose a later revision or use the operator recovery procedure.');
 }
}
