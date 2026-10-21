CREATE TABLE `subscription_accounts` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`trial_end` text NOT NULL,
	`customer_id` text,
	`checkout_id` text,
	`checkout_generation` integer DEFAULT 0 NOT NULL,
	`terms_version` text,
	`terms_accepted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_accounts_customer_id_unique` ON `subscription_accounts` (`customer_id`);--> statement-breakpoint
CREATE TABLE `subscription_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`received_at` text NOT NULL
);
