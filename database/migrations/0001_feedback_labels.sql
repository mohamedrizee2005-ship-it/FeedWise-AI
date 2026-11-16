-- Rebuild changed SQLite CHECK constraints while preserving every record.
-- Copy the child tables before removing the old parent. No CASCADE or FK toggle.
CREATE TABLE `__new_feedback` (
 `id` text PRIMARY KEY NOT NULL,
 `session_id` text NOT NULL REFERENCES `sessions`(`id`),
 `comment` text NOT NULL,
 `rating` integer,
 `receipt` text NOT NULL,
 `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
 CONSTRAINT `comment_length` CHECK(length(`comment`) BETWEEN 2 AND 2000),
 CONSTRAINT `rating_range` CHECK(`rating` BETWEEN 1 AND 5)
);

INSERT INTO `__new_feedback` SELECT `id`,`session_id`,`comment`,`rating`,`receipt`,`created_at` FROM `feedback`;

CREATE TABLE `__new_reviews` (
 `feedback_id` text PRIMARY KEY NOT NULL REFERENCES `__new_feedback`(`id`),
 `label` text NOT NULL,
 `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
 CONSTRAINT `review_label` CHECK(`label` IN ('positive','negative','neutral','mixed'))
);

INSERT INTO `__new_reviews` SELECT `feedback_id`,`label`,`updated_at` FROM `reviews`;

CREATE TABLE `__new_review_history` (
 `id` text PRIMARY KEY NOT NULL,
 `feedback_id` text NOT NULL REFERENCES `__new_feedback`(`id`),
 `label` text NOT NULL,
 `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
 CONSTRAINT `history_label` CHECK(`label` IN ('positive','negative','neutral','mixed'))
);

INSERT INTO `__new_review_history` SELECT `id`,`feedback_id`,`label`,`created_at` FROM `review_history`;

CREATE TABLE `__new_predictions` (
 `feedback_id` text NOT NULL REFERENCES `__new_feedback`(`id`),
 `model_version` text NOT NULL,
 `label` text NOT NULL,
 `probability` real NOT NULL,
 CONSTRAINT `prediction_label` CHECK(`label` IN ('positive','negative','neutral','mixed','unreviewed'))
);

INSERT INTO `__new_predictions` SELECT `feedback_id`,`model_version`,`label`,`probability` FROM `predictions`;

DROP TABLE `reviews`;

DROP TABLE `review_history`;

DROP TABLE `predictions`;

DROP TABLE `feedback`;

ALTER TABLE `__new_feedback` RENAME TO `feedback`;

ALTER TABLE `__new_reviews` RENAME TO `reviews`;

ALTER TABLE `__new_review_history` RENAME TO `review_history`;

ALTER TABLE `__new_predictions` RENAME TO `predictions`;

CREATE UNIQUE INDEX `feedback_receipt_unique` ON `feedback` (`receipt`);

CREATE INDEX `feedback_session_idx` ON `feedback` (`session_id`);

CREATE INDEX `history_feedback_idx` ON `review_history` (`feedback_id`);

CREATE INDEX `prediction_feedback_idx` ON `predictions` (`feedback_id`);
