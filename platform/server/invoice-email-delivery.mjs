// Server-only email adapter. Not connected to a live route: no sends until release approval.
// Provider: Resend HTTPS API; inject fetch for deterministic sandbox tests.
const emailPattern=/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/;
export function prepareDelivery(invoice,recipient,{from,replyTo}={}){
 if(!invoice?.issue||invoice.status!=='Issued'||invoice.credit)throw Error('Only an issued, uncredited invoice may be delivered.');
 if(!invoice.issue.supplier||!/^QV-[1-9]\d{3,11}$/.test(invoice.number))throw Error('Invalid invoice snapshot.');
 if(!emailPattern.test(recipient||'')||recipient.length>150||recipient.includes(','))throw Error('Invalid recipient.');
 if(!emailPattern.test(from||'')||!emailPattern.test(replyTo||from))throw Error('Sender is not configured.');
 if(!Number.isSafeInteger(invoice.total)||invoice.total<0)throw Error('Invalid invoice total.');
 const supplier=invoice.issue.supplier.tradingName||invoice.issue.supplier.legalName;
 const pounds=new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(invoice.total/100);
 const subject=`Invoice ${invoice.number} from ${supplier}`;
 const text=`Invoice ${invoice.number}\nSupplier: ${supplier}\nCustomer: ${invoice.customerName}\nService: ${invoice.description}\nSupply date: ${invoice.issue.supplyDate}\nIssued: ${invoice.issued}\nDue: ${invoice.due}\nTotal: ${pounds}\n\nContact: ${invoice.issue.supplier.contact}`;
 if(/[\r\n]/.test(supplier)||/[\r\n]/.test(invoice.number))throw Error('Invalid invoice header.');
 return {from,to:[recipient],reply_to:replyTo||from,subject,text};
}
export async function sendInvoiceViaResend({message,apiKey,idempotencyKey,fetchImpl=fetch,endpoint='https://api.resend.com/emails'}){
 if(typeof apiKey!=='string'||!apiKey||!/^[-\w]{8,100}$/.test(idempotencyKey||''))throw Error('Email transport is not configured.');
 if(endpoint!=='https://api.resend.com/emails')throw Error('Unsupported email endpoint.');
 const response=await fetchImpl(endpoint,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify(message)});
 if(!response.ok)throw Error(`Email provider rejected request (HTTP ${response.status}).`);
 const body=await response.json();
 if(typeof body?.id!=='string'||!body.id)throw Error('Email provider response was incomplete.');
 return {providerMessageId:body.id,status:'accepted'}; // accepted is NOT delivered
}
