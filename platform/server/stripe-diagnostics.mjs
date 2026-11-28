// Resource/operation labels only: never log provider messages, parameters, URLs,
// account identifiers, keys, customer data or payment details.
const permissions=Object.freeze({
 'subscriptions.list':['subscription_read','invoice_read'], // expands latest_invoice
 'subscriptions.retrieve':['subscription_read'],
 'invoices.retrieve':['invoice_read'],
 'invoices.list':['invoice_read'],
 'invoicePayments.list':['invoice_read'],
 'charges.retrieve':['charge_read'],
 'prices.retrieve':['plan_read'],
 'customers.create':['customer_write'],
 'checkout.sessions.retrieve':['checkout_session_read'],
 'checkout.sessions.create':['checkout_session_write'],
 'checkout.sessions.expire':['checkout_session_write'],
 'billingPortal.sessions.create':['customer_portal_session_write'],
});
const failures=new WeakMap();
export async function stripeOperation(operation,execute){
 if(!Object.hasOwn(permissions,operation))throw Error('Unknown billing operation.');
 try{return await execute()}catch(error){
  if(error&&typeof error==='object'&&!failures.has(error))failures.set(error,operation);
  throw error;
 }
}
export function stripeFailureDiagnostic(error){
 if(!error||typeof error!=='object'||typeof error.type!=='string'||!/^Stripe[A-Za-z]+Error$/.test(error.type))return null;
 const requestId=typeof error.requestId==='string'&&/^req_[A-Za-z0-9]{1,100}$/.test(error.requestId)?error.requestId:undefined;
 const status=Number.isInteger(error.statusCode)&&error.statusCode>=400&&error.statusCode<=599?error.statusCode:undefined;
 const operation=failures.get(error);
 return {type:error.type.slice(0,80),requestId,status,...(operation?{operation,expectedPermissions:[...permissions[operation]]}:{})};
}
