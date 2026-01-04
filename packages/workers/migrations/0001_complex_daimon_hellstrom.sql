CREATE TABLE `stripe_event_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`payloadHash` text NOT NULL,
	`signaturePresent` integer NOT NULL,
	`receivedAt` integer NOT NULL,
	`route` text NOT NULL,
	`requestId` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`error` text,
	`httpStatus` integer,
	`stripeEventId` text,
	`type` text,
	`livemode` integer,
	`apiVersion` text,
	`created` integer,
	`processedAt` integer,
	`orgId` text,
	`stripeCustomerId` text,
	`stripeSubscriptionId` text,
	`stripeCheckoutSessionId` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_event_ledger_payloadHash_unique` ON `stripe_event_ledger` (`payloadHash`);--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_event_ledger_stripeEventId_unique` ON `stripe_event_ledger` (`stripeEventId`);