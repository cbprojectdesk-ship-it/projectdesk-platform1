CREATE TABLE `command_rate_limits` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`window_start` integer NOT NULL,
	`attempts` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
