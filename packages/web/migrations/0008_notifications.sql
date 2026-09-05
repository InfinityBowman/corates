CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`readAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_userId_createdAt_idx` ON `notifications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_userId_readAt_idx` ON `notifications` (`userId`,`readAt`);
