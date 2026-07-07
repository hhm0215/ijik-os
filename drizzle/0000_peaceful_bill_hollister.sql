CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_posting_id` integer NOT NULL,
	`applied_at` text NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_posting_id`) REFERENCES `job_postings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `askbacks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_posting_id` integer NOT NULL,
	`requirement_id` integer,
	`question` text NOT NULL,
	`why` text DEFAULT '' NOT NULL,
	`answer` text,
	`result_card_id` integer,
	`result_type` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_posting_id`) REFERENCES `job_postings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`result_card_id`) REFERENCES `experience_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `draft_sentence_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sentence_id` integer NOT NULL,
	`card_id` integer NOT NULL,
	FOREIGN KEY (`sentence_id`) REFERENCES `draft_sentences`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `experience_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `draft_sentences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draft_id` integer NOT NULL,
	`order_idx` integer DEFAULT 0 NOT NULL,
	`text` text NOT NULL,
	`type` text NOT NULL,
	`warning` text,
	`primary_source_card_id` integer,
	`askback_id` integer,
	`edited` integer DEFAULT false NOT NULL,
	`source_changed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`primary_source_card_id`) REFERENCES `experience_cards`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_sentence_requires_source" CHECK("draft_sentences"."type" != 'ai' OR "draft_sentences"."primary_source_card_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_posting_id` integer NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_posting_id`) REFERENCES `job_postings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `experience_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`situation` text NOT NULL,
	`role` text NOT NULL,
	`action` text NOT NULL,
	`result_metrics` text DEFAULT '' NOT NULL,
	`learned` text DEFAULT '' NOT NULL,
	`evidence_sentence` text DEFAULT '' NOT NULL,
	`claimable` text DEFAULT '' NOT NULL,
	`not_claimable` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interview_answer_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`order_idx` integer DEFAULT 0 NOT NULL,
	`text` text NOT NULL,
	`type` text NOT NULL,
	`primary_source_card_id` integer,
	FOREIGN KEY (`question_id`) REFERENCES `interview_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`primary_source_card_id`) REFERENCES `experience_cards`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_answer_requires_source" CHECK("interview_answer_points"."type" != 'ai' OR "interview_answer_points"."primary_source_card_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `interview_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_posting_id` integer NOT NULL,
	`question` text NOT NULL,
	`qtype` text NOT NULL,
	`order_idx` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`job_posting_id`) REFERENCES `job_postings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `job_postings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`raw_text` text NOT NULL,
	`pipeline_status` text DEFAULT 'new' NOT NULL,
	`analysis_status` text DEFAULT 'pending' NOT NULL,
	`analysis_error` text,
	`fit_json` text,
	`verdict` text,
	`collected_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requirement_id` integer NOT NULL,
	`card_id` integer NOT NULL,
	`strength` text NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `experience_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `requirements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_posting_id` integer NOT NULL,
	`category` text NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`job_posting_id`) REFERENCES `job_postings`(`id`) ON UPDATE no action ON DELETE cascade
);
