CREATE TABLE `contact_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`message` text NOT NULL,
	`dedupKey` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_submissions_dedupKey_unique` ON `contact_submissions` (`dedupKey`);--> statement-breakpoint
CREATE INDEX `contact_submissions_email_createdAt_idx` ON `contact_submissions` (`email`,`createdAt`);