// Preparing a mail-app message is not delivery. Never persist a "sent" status here.
const gbp=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n/100);
const mailbox=/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
export function prepareInvoiceEmail(invoice,email,businessName='Quenvira'){
 if(!invoice||!/^QV-[1-9]\d{3,11}$/.test(invoice.number)||!['net','tax','total'].every(k=>Number.isSafeInteger(invoice[k])&&invoice[k]>=0)||![0,20].includes(invoice.vat)||invoice.tax!==Math.round(invoice.net*invoice.vat/100)||invoice.total!==invoice.net+invoice.tax)throw Error('Invoice details are unavailable.');
 const business=String(businessName).replace(/[\r\n]+/g,' ').trim().slice(0,100)||'Quenvira';
 const to=typeof email==='string'?email.trim():'';
 const local=to.split('@')[0];
 const valid=to.length<=150&&mailbox.test(to)&&!local.startsWith('.')&&!local.endsWith('.')&&!local.includes('..');
 const issued=Boolean(invoice.issue);
 const supplier=invoice.issue?.supplier;
 const subject=`${supplier?.tradingName||supplier?.legalName||business} — ${issued?'invoice':'draft invoice'} ${invoice.number}`;
 const body=[
  issued?'PRIVATE TEST DOCUMENT — NOT FOR CUSTOMER USE':'DRAFT — NOT A VALID TAX INVOICE',supplier?.legalName||business,...(supplier?[supplier.tradingName,supplier.address,supplier.contact,supplier.companyNumber?'Company number: '+supplier.companyNumber:'',supplier.vatRegistered?'VAT registration: '+supplier.vatNumber:'Not VAT registered'].filter(Boolean):[]),'',
  `Reference: ${invoice.number}`,`Customer: ${invoice.customerName}`,`Service address: ${invoice.address}`,
  ...(issued?[`Supply date: ${invoice.issue.supplyDate}`,`Quantity: 1 visit; unit price: ${gbp(invoice.net)}`]:[]),`Issued: ${invoice.issued}`,`Due: ${invoice.due}`,`Service: ${invoice.description}`,'',
  `Net: ${gbp(invoice.net)}`,`VAT (${invoice.vat}%): ${gbp(invoice.tax)}`,`Total: ${gbp(invoice.total)}`,
  `Status: ${invoice.status}`,...(invoice.credit?[`Full credit: ${invoice.credit.number} (${invoice.credit.date})`,`Credit reason: ${invoice.credit.reason}`,'Balance due: £0.00']:[]),...(invoice.paidOn?[`Manual payment recorded: ${invoice.paidOn}`]:[]),'',
  issued?'Private testing only. Do not use this document to request customer payment.':'This is a development-release draft for review, not a valid tax invoice or a request for payment.',
  'No payment is collected through this message.'
 ].join('\n').replace(/\r\n?|\n/g,'\r\n');
 return {to,subject,body,href:valid?`mailto:${encodeURIComponent(local)}@${to.split('@')[1]}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`:null,
  recipientError:valid?'':to?'Save a single valid customer email address before preparing an email.':'Add the customer’s email address in Customers before preparing an email.'};
}

export async function copyInvoiceText(text,clipboard,select){
 try{if(typeof clipboard?.writeText!=='function')throw Error('Clipboard unavailable');await clipboard.writeText(text);return true}catch{select();return false}
}
