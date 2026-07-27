CREATE TABLE `contact_inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`work_email` text NOT NULL,
	`organization` text NOT NULL,
	`role` text NOT NULL,
	`inquiry_type` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_inquiries_created_idx` ON `contact_inquiries` (`created_at`);--> statement-breakpoint
CREATE INDEX `contact_inquiries_status_idx` ON `contact_inquiries` (`status`);