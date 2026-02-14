CREATE TABLE `chat` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_chat_user` ON `chat` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_updated` ON `chat` (`updated_at`);--> statement-breakpoint
CREATE TABLE `chat_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`confidence` real DEFAULT 0.5 NOT NULL,
	`entropy` real DEFAULT 0 NOT NULL,
	`dissonance` real DEFAULT 0 NOT NULL,
	`health_score` real DEFAULT 1 NOT NULL,
	`safety_state` text DEFAULT 'green' NOT NULL,
	`risk_score` real DEFAULT 0 NOT NULL,
	`focus_depth` real DEFAULT 3 NOT NULL,
	`temperature_scale` real DEFAULT 1 NOT NULL,
	`queries_processed` integer DEFAULT 0 NOT NULL,
	`tda` text,
	`concepts` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chat`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_signals_chat` ON `chat_signals` (`chat_id`);--> statement-breakpoint
CREATE TABLE `daemon_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daemon_event_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_type` text NOT NULL,
	`task_name` text,
	`payload` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daemon_status` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`pid` integer,
	`state` text DEFAULT 'stopped' NOT NULL,
	`current_task` text,
	`started_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`dual_message` text,
	`truth_assessment` text,
	`confidence` real,
	`evidence_grade` text,
	`mode` text,
	`attachments` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chat`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_message_chat` ON `message` (`chat_id`);--> statement-breakpoint
CREATE INDEX `idx_message_created` ON `message` (`created_at`);--> statement-breakpoint
CREATE TABLE `note_block` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`type` text DEFAULT 'paragraph' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`parent_id` text,
	`block_order` text DEFAULT 'a0' NOT NULL,
	`collapsed` integer DEFAULT false NOT NULL,
	`indent` integer DEFAULT 0 NOT NULL,
	`properties` text DEFAULT '{}' NOT NULL,
	`refs` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `note_page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_note_block_page` ON `note_block` (`page_id`);--> statement-breakpoint
CREATE INDEX `idx_note_block_parent` ON `note_block` (`parent_id`);--> statement-breakpoint
CREATE TABLE `note_book` (
	`id` text PRIMARY KEY NOT NULL,
	`vault_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`icon` text,
	`cover_color` text,
	`page_ids` text DEFAULT '[]' NOT NULL,
	`chapters` text DEFAULT '[]' NOT NULL,
	`auto_generated` integer DEFAULT false NOT NULL,
	`category` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`vault_id`) REFERENCES `note_vault`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `note_concept` (
	`id` text PRIMARY KEY NOT NULL,
	`vault_id` text NOT NULL,
	`name` text NOT NULL,
	`source_page_id` text NOT NULL,
	`source_block_id` text NOT NULL,
	`type` text NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`vault_id`) REFERENCES `note_vault`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_note_concept_page` ON `note_concept` (`source_page_id`);--> statement-breakpoint
CREATE TABLE `note_concept_correlation` (
	`id` text PRIMARY KEY NOT NULL,
	`concept_a_id` text NOT NULL,
	`concept_b_id` text NOT NULL,
	`page_a_id` text NOT NULL,
	`page_b_id` text NOT NULL,
	`correlation_type` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`strength` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `note_page` (
	`id` text PRIMARY KEY NOT NULL,
	`vault_id` text NOT NULL,
	`title` text NOT NULL,
	`name` text NOT NULL,
	`is_journal` integer DEFAULT false NOT NULL,
	`journal_date` text,
	`icon` text,
	`cover_image` text,
	`properties` text DEFAULT '{}' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`vault_id`) REFERENCES `note_vault`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_note_page_vault` ON `note_page` (`vault_id`);--> statement-breakpoint
CREATE INDEX `idx_note_page_name` ON `note_page` (`vault_id`,`name`);--> statement-breakpoint
CREATE TABLE `note_page_link` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_page_id` text NOT NULL,
	`target_page_id` text NOT NULL,
	`source_block_id` text NOT NULL,
	`context` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_note_page_link_source` ON `note_page_link` (`source_page_id`);--> statement-breakpoint
CREATE INDEX `idx_note_page_link_target` ON `note_page_link` (`target_page_id`);--> statement-breakpoint
CREATE TABLE `note_vault` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`page_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pipeline_run` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`message_id` text NOT NULL,
	`stages` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`chat_id`) REFERENCES `chat`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pipeline_chat` ON `pipeline_run` (`chat_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
