import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('workspaces', {
 id:text('id').primaryKey(), name:text('name').notNull(), revision:integer('revision').notNull().default(0),
 document:text('document').notNull(), lastOperation:text('last_operation'), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull()
});
export const memberships=sqliteTable('memberships',{
 workspaceId:text('workspace_id').notNull().references(()=>workspaces.id,{onDelete:'cascade'}),
 userId:text('user_id').notNull(),role:text('role').notNull(),staffId:text('staff_id'),
},t=>[primaryKey({columns:[t.workspaceId,t.userId]}),index('memberships_user').on(t.userId)]);
export const history=sqliteTable('history',{
 workspaceId:text('workspace_id').notNull().references(()=>workspaces.id,{onDelete:'cascade'}),
 revision:integer('revision').notNull(),document:text('document').notNull(),createdAt:text('created_at').notNull()
},t=>[primaryKey({columns:[t.workspaceId,t.revision]})]);
export const operations=sqliteTable('operations',{
 workspaceId:text('workspace_id').notNull().references(()=>workspaces.id,{onDelete:'cascade'}),
 id:text('id').notNull(),userId:text('user_id').notNull(),response:text('response').notNull(),createdAt:text('created_at').notNull()
},t=>[primaryKey({columns:[t.workspaceId,t.id]})]);
export const events=sqliteTable('events',{
 workspaceId:text('workspace_id').notNull().references(()=>workspaces.id,{onDelete:'cascade'}),
 id:text('id').notNull(),userId:text('user_id').notNull(),action:text('action').notNull(),createdAt:text('created_at').notNull()
},t=>[primaryKey({columns:[t.workspaceId,t.id]})]);
export const invitations=sqliteTable('invitations',{
 hash:text('hash').primaryKey(),workspaceId:text('workspace_id').notNull().references(()=>workspaces.id,{onDelete:'cascade'}),
 email:text('email').notNull(),staffId:text('staff_id').notNull(),expiresAt:text('expires_at').notNull(),acceptedBy:text('accepted_by'),createdAt:text('created_at').notNull()
});

// Survive workspace deletion to retain trial and external billing identity.
export const subscriptionAccounts=sqliteTable('subscription_accounts',{
 workspaceId:text('workspace_id').primaryKey(),trialEnd:text('trial_end').notNull(),
 customerId:text('customer_id').unique(),checkoutId:text('checkout_id'),
 checkoutGeneration:integer('checkout_generation').notNull().default(0),
 termsVersion:text('terms_version'),termsAcceptedAt:text('terms_accepted_at')
});
export const subscriptionEvents=sqliteTable('subscription_events',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull(),
 type:text('type').notNull(),receivedAt:text('received_at').notNull()
});

// Immutable provider payload is private server state; never include it in staff views.
export const invoiceOutbox=sqliteTable('invoice_outbox',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull().references(()=>workspaces.id,{onDelete:'cascade'}),
 invoiceId:text('invoice_id').notNull(),mode:text('mode').notNull(),payload:text('payload').notNull(),status:text('status').notNull(),
 attempts:integer('attempts').notNull().default(0),providerId:text('provider_id').unique(),firstAttemptAt:text('first_attempt_at'),nextAttemptAt:text('next_attempt_at').notNull(),
 leaseToken:text('lease_token'),leaseUntil:text('lease_until'),lastError:text('last_error'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[uniqueIndex('invoice_outbox_invoice').on(t.workspaceId,t.invoiceId),index('invoice_outbox_pending').on(t.mode,t.status,t.nextAttemptAt)]);
export const invoiceEmailEvents=sqliteTable('invoice_email_events',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull().references(()=>workspaces.id,{onDelete:'cascade'}),
 outboxId:text('outbox_id').notNull().references(()=>invoiceOutbox.id,{onDelete:'cascade'}),status:text('status').notNull(),createdAt:text('created_at').notNull()
});
