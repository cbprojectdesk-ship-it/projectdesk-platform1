import {prepareDelivery,sendInvoiceViaResend} from './invoice-email-delivery.mjs';
// A durable, tenant-scoped queue. Dispatch is intentionally operator-gated.
export async function enqueueInvoice(db,{workspace,invoice,recipient,from,replyTo,requestId,now=new Date()}){
 if(!/^[-\w]{8,100}$/.test(requestId||''))throw Error('Invalid request ID.');
 const message=prepareDelivery(invoice,recipient,{from,replyTo});
 const created=now.toISOString();
 await db.prepare("INSERT OR IGNORE INTO invoice_email_outbox (workspace_id,request_id,invoice_id,invoice_number,recipient,payload,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'pending',?,?)").bind(workspace,requestId,invoice.id,invoice.number,recipient,JSON.stringify(message),created,created).run();
 const row=await db.prepare('SELECT request_id,invoice_id,invoice_number,recipient,status,provider_message_id,created_at,updated_at FROM invoice_email_outbox WHERE workspace_id = ? AND request_id = ?').bind(workspace,requestId).first();
 if(row.invoice_id!==invoice.id||row.recipient!==recipient)throw Error('Request ID already belongs to a different invoice delivery.');
 return row;
}
export async function deliveryStatus(db,workspace,invoiceId){
 const result=await db.prepare('SELECT request_id,invoice_number,recipient,status,provider_message_id,created_at,updated_at FROM invoice_email_outbox WHERE workspace_id = ? AND invoice_id = ? ORDER BY created_at DESC LIMIT 30').bind(workspace,invoiceId).all();
 return result.results;
}
export async function dispatchPending(db,{workspace,requestId,apiKey,now=new Date(),fetchImpl=fetch}){
 // Claim before network call. An ambiguous timeout is marked unknown, never auto-retried.
 const stamp=now.toISOString();
 const claim=await db.prepare("UPDATE invoice_email_outbox SET status='sending',updated_at=? WHERE workspace_id=? AND request_id=? AND status='pending' RETURNING payload").bind(stamp,workspace,requestId).first();
 if(!claim)return {status:'not-pending'};
 try{
  const result=await sendInvoiceViaResend({message:JSON.parse(claim.payload),apiKey,idempotencyKey:requestId,fetchImpl});
  await db.prepare("UPDATE invoice_email_outbox SET status='accepted',provider_message_id=?,updated_at=? WHERE workspace_id=? AND request_id=? AND status='sending'").bind(result.providerMessageId,new Date().toISOString(),workspace,requestId).run();
  return result;
 }catch{
  await db.prepare("UPDATE invoice_email_outbox SET status='unknown',updated_at=? WHERE workspace_id=? AND request_id=? AND status='sending'").bind(new Date().toISOString(),workspace,requestId).run();
  return {status:'unknown'};
 }
}
