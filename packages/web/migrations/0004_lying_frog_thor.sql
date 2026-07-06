CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`context` text,
	`status` text DEFAULT 'new' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feedback_userId_createdAt_idx` ON `feedback` (`userId`,`createdAt`);