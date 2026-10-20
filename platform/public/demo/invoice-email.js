// Preparing a mail-app message is not delivery. Never persist a "sent" status here.
const gbp=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n/100);
const mailbox=/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
export function prepareInvoiceEmail(invoice,email,businessName='Quenvira'){
 if(!invoice||!/^QV-[1-9]\d{3,11}$/.test(invoice.number)||!['net','tax','total'].every(k=>Number.isSafeInteger(invoice[k])&&invoice[k]>=0)||![0,20].includes(invoice.vat)||invoice.tax!==Math.round(invoice.net*invoice.vat/100)||invoice.total!==invoice.net+invoice.tax)throw Error('Invoice details are unavailable.');
 const business=String(businessName).replace(/[\r\n]+/g,' ').trim().slice(0,100)||'Quenvira';
 const to=typeof email==='string'?email.trim():'';
 const local=to.split('@')[0];
 const valid=to.length<=150&&mailbox.test(to)&&!local.startsWith('.')&&!local.endsWith('.')&&!local.includes('..');
 const subject=`${business} — draft invoice ${invoice.number}`;
 const body=[
  'DRAFT — NOT A VALID TAX INVOICE',business,'',
  `Reference: ${invoice.number}`,`Customer: ${invoice.customerName}`,`Service address: ${invoice.address}`,
  `Issued: ${invoice.issued}`,`Due: ${invoice.due}`,`Service: ${invoice.description}`,'',
  `Net: ${gbp(invoice.net)}`,`VAT (${invoice.vat}%): ${gbp(invoice.tax)}`,`Total: ${gbp(invoice.total)}`,
  `Status: ${invoice.status}`,...(invoice.paidOn?[`Manual payment recorded: ${invoice.paidOn}`]:[]),'',
  'This is a development-release draft for review, not a valid tax invoice or a request for payment.',
  'No payment is collected through this message.'
 ].join('\n');
 return {to,subject,body,href:valid?`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`:null,
  recipientError:valid?'':to?'Save a single valid customer email address before preparing an email.':'Add the customer’s email address in Customers before preparing an email.'};
}
