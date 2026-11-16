CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`comment` text NOT NULL,
	`rating` integer,
	`receipt` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "comment_length" CHECK(length("feedback"."comment") BETWEEN 10 AND 2000),
	CONSTRAINT "rating_range" CHECK("feedback"."rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX `feedback_receipt_unique` ON `feedback` (`receipt`);
CREATE INDEX `feedback_session_idx` ON `feedback` (`session_id`);
CREATE TABLE `predictions` (
	`feedback_id` text NOT NULL,
	`model_version` text NOT NULL,
	`label` text NOT NULL,
	`probability` real NOT NULL,
	FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "prediction_label" CHECK("predictions"."label" IN ('positive','negative'))
);

CREATE INDEX `prediction_feedback_idx` ON `predictions` (`feedback_id`);
CREATE TABLE `review_history` (
	`id` text PRIMARY KEY NOT NULL,
	`feedback_id` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "history_label" CHECK("review_history"."label" IN ('positive','negative','neutral','mixed'))
);

CREATE INDEX `history_feedback_idx` ON `review_history` (`feedback_id`);
CREATE TABLE `reviews` (
	`feedback_id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "review_label" CHECK("reviews"."label" IN ('positive','negative','neutral','mixed'))
);

CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`public_token` text NOT NULL,
	`review_hash` text NOT NULL,
	`is_open` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "title_length" CHECK(length("sessions"."title") BETWEEN 1 AND 100),
	CONSTRAINT "open_boolean" CHECK("sessions"."is_open" IN (0,1))
);

CREATE UNIQUE INDEX `sessions_public_token_unique` ON `sessions` (`public_token`);
CREATE UNIQUE INDEX `sessions_review_hash_unique` ON `sessions` (`review_hash`);