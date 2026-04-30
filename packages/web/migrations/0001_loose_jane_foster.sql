CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `mediaFiles_projectId_idx` ON `mediaFiles` (`projectId`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`userId`);--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organizationId`);--> statement-breakpoint
CREATE INDEX `org_access_grants_orgId_idx` ON `org_access_grants` (`orgId`);--> statement-breakpoint
CREATE INDEX `project_invitations_projectId_idx` ON `project_invitations` (`projectId`);--> statement-breakpoint
CREATE INDEX `project_members_projectId_idx` ON `project_members` (`projectId`);--> statement-breakpoint
CREATE INDEX `project_members_userId_idx` ON `project_members` (`userId`);--> statement-breakpoint
CREATE INDEX `projects_orgId_idx` ON `projects` (`orgId`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE INDEX `subscription_referenceId_idx` ON `subscription` (`referenceId`);