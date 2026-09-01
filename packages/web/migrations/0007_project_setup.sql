ALTER TABLE `projects` ADD `setupStatus` text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `setupStep` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `setupSkipInvites` integer DEFAULT false NOT NULL;