import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareInvoiceEmail} from '../public/invoice-email.js';
const invoice={number:'QV-1001',customerName:'Fictional Client',address:'Example Street',issued:'2026-10-20',due:'2026-11-03',description:'Cleaning service',net:7899,tax:1580,total:9479,vat:20,status:'Draft',paidOn:null};

test('email preparation uses the single saved address and exact invoice amounts without mutating the invoice',()=>{
 const before=structuredClone(invoice),mail=prepareInvoiceEmail(invoice,'client+cleaning@example.com','Example Cleaning');
 assert.ok(mail.href.startsWith('mailto:client%2Bcleaning@example.com?'));assert.match(mail.href,/%0D%0A/);const uri=new URL(mail.href);assert.equal(uri.protocol,'mailto:');assert.equal(decodeURIComponent(uri.pathname),'client+cleaning@example.com');
 assert.equal(uri.searchParams.get('subject'),mail.subject);assert.equal(uri.searchParams.get('body'),mail.body);assert.equal(mail.recipientError,'');
 assert.match(mail.body,/DRAFT — NOT A VALID TAX INVOICE/);assert.match(mail.body,/Net: £78\.99/);assert.match(mail.body,/VAT \(20%\): £15\.80/);assert.match(mail.body,/Total: £94\.79/);assert.deepEqual(invoice,before);
});
test('missing addresses and recipient/header injection never produce a compose link',()=>{
 for(const email of ['',undefined,'a@example.com,b@example.com','a@example.com;b@example.com','a@example.com\r\nBcc: hidden@example.com','Display <a@example.com>','a@example.com?bcc=other@example.com','a..b@example.com']){
  const mail=prepareInvoiceEmail(invoice,email);assert.equal(mail.href,null);assert.ok(mail.recipientError);assert.match(mail.body,/£94\.79/);
 }
});
test('subject headers stay on one line and special address characters cannot add query headers',()=>{
 const mail=prepareInvoiceEmail(invoice,'a&b+tag@example.com','Business\r\nBcc: nobody');const uri=new URL(mail.href);
 assert.equal(decodeURIComponent(uri.pathname),'a&b+tag@example.com');assert.equal(uri.searchParams.has('bcc'),false);assert.ok(!/[\r\n]/.test(mail.subject));assert.equal(uri.searchParams.size,2);
});
test('inconsistent totals refuse preparation and recorded payment remains clearly manual',()=>{
 assert.throws(()=>prepareInvoiceEmail({...invoice,total:9999},'client@example.com'),/Invoice/);
 const mail=prepareInvoiceEmail({...invoice,status:'Paid',paidOn:'2026-10-20'},'client@example.com');assert.match(mail.body,/Status: Paid/);assert.match(mail.body,/Manual payment recorded/);assert.match(mail.body,/not a valid tax invoice/);
});
test('secure and fictional demo email helpers remain identical',()=>{
 assert.equal(fs.readFileSync(new URL('../public/invoice-email.js',import.meta.url),'utf8'),fs.readFileSync(new URL('../public/demo/invoice-email.js',import.meta.url),'utf8'));
});
