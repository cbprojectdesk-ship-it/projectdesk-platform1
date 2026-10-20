import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
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
