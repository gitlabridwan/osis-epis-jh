CREATE TABLE `kas_auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `kas_auth_limits_reset_idx` ON `kas_auth_limits` (`reset_at`);--> statement-breakpoint
CREATE TABLE `kas_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `kas_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kas_sessions_user_idx` ON `kas_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `kas_sessions_expiry_idx` ON `kas_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `kas_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kas_users_email_unique` ON `kas_users` (`email`);