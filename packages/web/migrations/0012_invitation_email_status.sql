ALTER TABLE `project_invitations` ADD `emailSentAt` integer;--> statement-breakpoint
ALTER TABLE `project_invitations` ADD `emailStatus` text;--> statement-breakpoint
CREATE UNIQUE INDEX `project_invitations_projectId_email_uidx` ON `project_invitations` (`projectId`,`email`);