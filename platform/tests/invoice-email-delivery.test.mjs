import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDelivery} from '../server/invoice-email-delivery.mjs';
test('drafts cannot be sent',()=>assert.throws(()=>prepareDelivery({status:'Draft'},'customer@example.com',{from:'billing@example.com'})));
test('missing recipient is rejected',()=>assert.throws(()=>prepareDelivery({status:'Issued',issue:{}},'',{from:'billing@example.com'})));
