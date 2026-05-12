CREATE TABLE `processed_emails` (
	`queueMessageId` text PRIMARY KEY NOT NULL,
	`processedAt` integer DEFAULT (unixepoch())
);
