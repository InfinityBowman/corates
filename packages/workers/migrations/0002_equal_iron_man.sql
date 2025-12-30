PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mediaFiles` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`originalName` text,
	`fileType` text,
	`fileSize` integer,
	`uploadedBy` text,
	`bucketKey` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`uploadedBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_mediaFiles`("id", "filename", "originalName", "fileType", "fileSize", "uploadedBy", "bucketKey", "createdAt") SELECT "id", "filename", "originalName", "fileType", "fileSize", "uploadedBy", "bucketKey", "createdAt" FROM `mediaFiles`;--> statement-breakpoint
DROP TABLE `mediaFiles`;--> statement-breakpoint
ALTER TABLE `__new_mediaFiles` RENAME TO `mediaFiles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;