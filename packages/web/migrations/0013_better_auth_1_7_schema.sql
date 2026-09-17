DROP INDEX `account_issuer_accountId_uidx`;--> statement-breakpoint
ALTER TABLE `account` DROP COLUMN `issuer`;--> statement-breakpoint
ALTER TABLE `twoFactor` ADD `verified` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `twoFactor` ADD `failedVerificationCount` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `twoFactor` ADD `lockedUntil` integer;