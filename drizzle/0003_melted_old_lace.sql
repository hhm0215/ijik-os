ALTER TABLE `applications` ADD `user_id` text REFERENCES user(id) ON DELETE RESTRICT;--> statement-breakpoint
CREATE INDEX `applications_user_posting_idx` ON `applications` (`user_id`,`job_posting_id`);--> statement-breakpoint
ALTER TABLE `askbacks` ADD `user_id` text REFERENCES user(id) ON DELETE RESTRICT;--> statement-breakpoint
CREATE INDEX `askbacks_user_posting_idx` ON `askbacks` (`user_id`,`job_posting_id`);--> statement-breakpoint
ALTER TABLE `draft_sentence_sources` ADD `user_id` text REFERENCES user(id) ON DELETE RESTRICT;--> statement-breakpoint
CREATE INDEX `draft_sentence_sources_user_sentence_idx` ON `draft_sentence_sources` (`user_id`,`sentence_id`);--> statement-breakpoint
CREATE INDEX `draft_sentence_sources_user_card_idx` ON `draft_sentence_sources` (`user_id`,`card_id`);--> statement-breakpoint
ALTER TABLE `draft_sentences` ADD `user_id` text REFERENCES user(id) ON DELETE RESTRICT;--> statement-breakpoint
CREATE INDEX `draft_sentences_user_draft_idx` ON `draft_sentences` (`user_id`,`draft_id`);--> statement-breakpoint
ALTER TABLE `drafts` ADD `user_id` text REFERENCES user(id) ON DELETE RESTRICT;--> statement-breakpoint
CREATE INDEX `drafts_user_posting_idx` ON `drafts` (`user_id`,`job_posting_id`);--> statement-breakpoint
ALTER TABLE `experience_cards` ADD `user_id` text REFERENCES user(id) ON DELETE RESTRICT;--> statement-breakpoint
CREATE INDEX `experience_cards_user_archived_idx` ON `experience_cards` (`user_id`,`archived`);--> statement-breakpoint
ALTER TABLE `interview_answer_points` ADD `user_id` text REFERENCES user(id) ON DELETE RESTRICT;--> statement-breakpoint
CREATE INDEX `interview_answer_points_user_question_idx` ON `interview_answer_points` (`user_id`,`question_id`);--> statement-breakpoint
ALTER TABLE `interview_questions` ADD `user_id` text REFERENCES user(id) ON DELETE RESTRICT;--> statement-breakpoint
CREATE INDEX `interview_questions_user_posting_idx` ON `interview_questions` (`user_id`,`job_posting_id`);--> statement-breakpoint
ALTER TABLE `job_postings` ADD `user_id` text REFERENCES user(id) ON DELETE RESTRICT;--> statement-breakpoint
CREATE INDEX `job_postings_user_collected_idx` ON `job_postings` (`user_id`,`collected_at`);--> statement-breakpoint
ALTER TABLE `matches` ADD `user_id` text REFERENCES user(id) ON DELETE RESTRICT;--> statement-breakpoint
CREATE INDEX `matches_user_requirement_idx` ON `matches` (`user_id`,`requirement_id`);--> statement-breakpoint
CREATE INDEX `matches_user_card_idx` ON `matches` (`user_id`,`card_id`);--> statement-breakpoint
ALTER TABLE `requirements` ADD `user_id` text REFERENCES user(id) ON DELETE RESTRICT;--> statement-breakpoint
CREATE INDEX `requirements_user_posting_idx` ON `requirements` (`user_id`,`job_posting_id`);
--> statement-breakpoint
CREATE TRIGGER `applications_user_id_insert_guard`
BEFORE INSERT ON `applications`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM `job_postings`
    WHERE `id` = NEW.`job_posting_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'applications.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `applications_user_id_update_guard`
BEFORE UPDATE ON `applications`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` <> OLD.`user_id`)
  OR NOT EXISTS (
    SELECT 1 FROM `job_postings`
    WHERE `id` = NEW.`job_posting_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'applications.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `askbacks_user_id_insert_guard`
BEFORE INSERT ON `askbacks`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM `job_postings`
    WHERE `id` = NEW.`job_posting_id` AND `user_id` = NEW.`user_id`
  )
  OR (NEW.`requirement_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `requirements`
    WHERE `id` = NEW.`requirement_id` AND `user_id` = NEW.`user_id`
  ))
  OR (NEW.`result_card_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `experience_cards`
    WHERE `id` = NEW.`result_card_id` AND `user_id` = NEW.`user_id`
  ))
BEGIN SELECT RAISE(ABORT, 'askbacks.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `askbacks_user_id_update_guard`
BEFORE UPDATE ON `askbacks`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` <> OLD.`user_id`)
  OR NOT EXISTS (
    SELECT 1 FROM `job_postings`
    WHERE `id` = NEW.`job_posting_id` AND `user_id` = NEW.`user_id`
  )
  OR (NEW.`requirement_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `requirements`
    WHERE `id` = NEW.`requirement_id` AND `user_id` = NEW.`user_id`
  ))
  OR (NEW.`result_card_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `experience_cards`
    WHERE `id` = NEW.`result_card_id` AND `user_id` = NEW.`user_id`
  ))
BEGIN SELECT RAISE(ABORT, 'askbacks.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `draft_sentence_sources_user_id_insert_guard`
BEFORE INSERT ON `draft_sentence_sources`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM `draft_sentences`
    WHERE `id` = NEW.`sentence_id` AND `user_id` = NEW.`user_id`
  )
  OR NOT EXISTS (
    SELECT 1 FROM `experience_cards`
    WHERE `id` = NEW.`card_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'draft_sentence_sources.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `draft_sentence_sources_user_id_update_guard`
BEFORE UPDATE ON `draft_sentence_sources`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` <> OLD.`user_id`)
  OR NOT EXISTS (
    SELECT 1 FROM `draft_sentences`
    WHERE `id` = NEW.`sentence_id` AND `user_id` = NEW.`user_id`
  )
  OR NOT EXISTS (
    SELECT 1 FROM `experience_cards`
    WHERE `id` = NEW.`card_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'draft_sentence_sources.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `draft_sentences_user_id_insert_guard`
BEFORE INSERT ON `draft_sentences`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM `drafts`
    WHERE `id` = NEW.`draft_id` AND `user_id` = NEW.`user_id`
  )
  OR (NEW.`primary_source_card_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `experience_cards`
    WHERE `id` = NEW.`primary_source_card_id` AND `user_id` = NEW.`user_id`
  ))
  OR (NEW.`askback_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `askbacks`
    WHERE `id` = NEW.`askback_id` AND `user_id` = NEW.`user_id`
  ))
BEGIN SELECT RAISE(ABORT, 'draft_sentences.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `draft_sentences_user_id_update_guard`
BEFORE UPDATE ON `draft_sentences`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` <> OLD.`user_id`)
  OR NOT EXISTS (
    SELECT 1 FROM `drafts`
    WHERE `id` = NEW.`draft_id` AND `user_id` = NEW.`user_id`
  )
  OR (NEW.`primary_source_card_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `experience_cards`
    WHERE `id` = NEW.`primary_source_card_id` AND `user_id` = NEW.`user_id`
  ))
  OR (NEW.`askback_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `askbacks`
    WHERE `id` = NEW.`askback_id` AND `user_id` = NEW.`user_id`
  ))
BEGIN SELECT RAISE(ABORT, 'draft_sentences.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `drafts_user_id_insert_guard`
BEFORE INSERT ON `drafts`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM `job_postings`
    WHERE `id` = NEW.`job_posting_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'drafts.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `drafts_user_id_update_guard`
BEFORE UPDATE ON `drafts`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` <> OLD.`user_id`)
  OR NOT EXISTS (
    SELECT 1 FROM `job_postings`
    WHERE `id` = NEW.`job_posting_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'drafts.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `experience_cards_user_id_insert_guard`
BEFORE INSERT ON `experience_cards`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
BEGIN SELECT RAISE(ABORT, 'experience_cards.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `experience_cards_user_id_update_guard`
BEFORE UPDATE ON `experience_cards`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` <> OLD.`user_id`)
BEGIN SELECT RAISE(ABORT, 'experience_cards.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `interview_answer_points_user_id_insert_guard`
BEFORE INSERT ON `interview_answer_points`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM `interview_questions`
    WHERE `id` = NEW.`question_id` AND `user_id` = NEW.`user_id`
  )
  OR (NEW.`primary_source_card_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `experience_cards`
    WHERE `id` = NEW.`primary_source_card_id` AND `user_id` = NEW.`user_id`
  ))
BEGIN SELECT RAISE(ABORT, 'interview_answer_points.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `interview_answer_points_user_id_update_guard`
BEFORE UPDATE ON `interview_answer_points`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` <> OLD.`user_id`)
  OR NOT EXISTS (
    SELECT 1 FROM `interview_questions`
    WHERE `id` = NEW.`question_id` AND `user_id` = NEW.`user_id`
  )
  OR (NEW.`primary_source_card_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `experience_cards`
    WHERE `id` = NEW.`primary_source_card_id` AND `user_id` = NEW.`user_id`
  ))
BEGIN SELECT RAISE(ABORT, 'interview_answer_points.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `interview_questions_user_id_insert_guard`
BEFORE INSERT ON `interview_questions`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM `job_postings`
    WHERE `id` = NEW.`job_posting_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'interview_questions.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `interview_questions_user_id_update_guard`
BEFORE UPDATE ON `interview_questions`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` <> OLD.`user_id`)
  OR NOT EXISTS (
    SELECT 1 FROM `job_postings`
    WHERE `id` = NEW.`job_posting_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'interview_questions.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `job_postings_user_id_insert_guard`
BEFORE INSERT ON `job_postings`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
BEGIN SELECT RAISE(ABORT, 'job_postings.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `job_postings_user_id_update_guard`
BEFORE UPDATE ON `job_postings`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` <> OLD.`user_id`)
BEGIN SELECT RAISE(ABORT, 'job_postings.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `matches_user_id_insert_guard`
BEFORE INSERT ON `matches`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM `requirements`
    WHERE `id` = NEW.`requirement_id` AND `user_id` = NEW.`user_id`
  )
  OR NOT EXISTS (
    SELECT 1 FROM `experience_cards`
    WHERE `id` = NEW.`card_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'matches.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `matches_user_id_update_guard`
BEFORE UPDATE ON `matches`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` <> OLD.`user_id`)
  OR NOT EXISTS (
    SELECT 1 FROM `requirements`
    WHERE `id` = NEW.`requirement_id` AND `user_id` = NEW.`user_id`
  )
  OR NOT EXISTS (
    SELECT 1 FROM `experience_cards`
    WHERE `id` = NEW.`card_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'matches.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `requirements_user_id_insert_guard`
BEFORE INSERT ON `requirements`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM `job_postings`
    WHERE `id` = NEW.`job_posting_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'requirements.user_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `requirements_user_id_update_guard`
BEFORE UPDATE ON `requirements`
FOR EACH ROW WHEN NEW.`user_id` IS NULL
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` <> OLD.`user_id`)
  OR NOT EXISTS (
    SELECT 1 FROM `job_postings`
    WHERE `id` = NEW.`job_posting_id` AND `user_id` = NEW.`user_id`
  )
BEGIN SELECT RAISE(ABORT, 'requirements.user_id is required'); END;
