CREATE TABLE `api_rate_limits` (
	`client_hash` text NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`client_hash`, `window_start`)
);
