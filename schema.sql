-- GreenLoop veritabanı şeması
-- Kullanım: phpMyAdmin'de "greenloop" adında bir veritabanı oluştur,
-- sonra bu dosyayı SQL sekmesinden çalıştır (ya da: mysql -u root greenloop < schema.sql)

CREATE DATABASE IF NOT EXISTS greenloop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE greenloop;

CREATE TABLE IF NOT EXISTS users (
  id         VARCHAR(64) PRIMARY KEY,
  ad         VARCHAR(100) NOT NULL,
  soyad      VARCHAR(100) NOT NULL,
  email      VARCHAR(190) NOT NULL UNIQUE,
  tel        VARCHAR(30)  DEFAULT '',
  password   VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS companies (
  id          VARCHAR(64) PRIMARY KEY,
  user_id     VARCHAR(64) NOT NULL,
  name        VARCHAR(190) NOT NULL,
  sector      VARCHAR(100) DEFAULT '',
  il          VARCHAR(100) DEFAULT '',
  ilce        VARCHAR(100) DEFAULT '',
  size        VARCHAR(50)  DEFAULT '',
  email       VARCHAR(190) DEFAULT '',
  tel         VARCHAR(30)  DEFAULT '',
  web         VARCHAR(190) DEFAULT '',
  emission    INT          NOT NULL DEFAULT 0,
  description TEXT,
  icon        VARCHAR(50)  DEFAULT 'factory',
  owner_name  VARCHAR(190) DEFAULT '',
  owner_email VARCHAR(190) DEFAULT '',
  is_demo     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_companies_emission CHECK (emission BETWEEN 0 AND 100),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS company_tags (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  tag        VARCHAR(190) NOT NULL,
  type       ENUM('input','output') NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_company (company_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conversations (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id     VARCHAR(64) NOT NULL,
  user_id        VARCHAR(64) DEFAULT NULL,
  guest_email    VARCHAR(190) COLLATE utf8mb4_bin DEFAULT NULL,
  guest_name     VARCHAR(190) DEFAULT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  hidden_by_company TINYINT(1) NOT NULL DEFAULT 0,
  hidden_by_sender  TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_conversation_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_conversation_user (company_id, user_id),
  UNIQUE KEY uq_conversation_guest (company_id, guest_email),
  INDEX idx_conversation_user_visible (user_id, hidden_by_sender)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rate_limits (
  `key` VARCHAR(128) PRIMARY KEY,
  window_start BIGINT NOT NULL,
  hits INT UNSIGNED NOT NULL,
  INDEX idx_rate_window (window_start)
) ENGINE=InnoDB;

-- The API locks this row until commit so a poll cannot skip an earlier, uncommitted cursor.
CREATE TABLE IF NOT EXISTS message_write_lock (
  id TINYINT UNSIGNED PRIMARY KEY
) ENGINE=InnoDB;
INSERT INTO message_write_lock (id) VALUES (1) ON DUPLICATE KEY UPDATE id = 1;

-- For upgrades, back up the DB and stop application writes while this file runs.
-- The original table is kept as messages_legacy for review/recovery; it is never queried by the API.
DROP PROCEDURE IF EXISTS greenloop_upgrade_messages;
DELIMITER $$
CREATE PROCEDURE greenloop_upgrade_messages()
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    DROP TEMPORARY TABLE IF EXISTS gl_legacy_participants;
    RESIGNAL;
  END;

  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'emoji') THEN
    ALTER TABLE companies CHANGE COLUMN emoji icon VARCHAR(50) DEFAULT 'factory';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'is_demo') THEN
    ALTER TABLE companies ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER owner_email;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies'
                   AND CONSTRAINT_NAME = 'chk_companies_emission' AND CONSTRAINT_TYPE = 'CHECK') THEN
    UPDATE companies SET emission = LEAST(100, GREATEST(0, COALESCE(emission, 0)))
    WHERE emission IS NULL OR emission NOT BETWEEN 0 AND 100;
    ALTER TABLE companies MODIFY COLUMN emission INT NOT NULL DEFAULT 0,
      ADD CONSTRAINT chk_companies_emission CHECK (emission BETWEEN 0 AND 100);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages')
     AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'conversation_id') THEN
    RENAME TABLE messages TO messages_legacy_pending;
  END IF;

  CREATE TABLE IF NOT EXISTS messages (
    cursor_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id              VARCHAR(64) NOT NULL,
    conversation_id INT UNSIGNED NOT NULL,
    to_company_id   VARCHAR(64) NOT NULL,
    from_side       ENUM('user','company') NOT NULL,
    from_name       VARCHAR(201) DEFAULT '',
    from_email      VARCHAR(190) DEFAULT '',
    to_email        VARCHAR(190) DEFAULT NULL,
    to_name         VARCHAR(201) DEFAULT NULL,
    body            TEXT NOT NULL,
    is_read         TINYINT(1) NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_company FOREIGN KEY (to_company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_message_id (id),
    INDEX idx_message_thread (conversation_id, cursor_id),
    INDEX idx_message_created_at (created_at)
  ) ENGINE=InnoDB;

  IF EXISTS (SELECT 1 FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages_legacy_pending') THEN
    CREATE TEMPORARY TABLE gl_legacy_participants (
      message_id VARCHAR(64) PRIMARY KEY,
      company_id VARCHAR(64) NOT NULL,
      user_id    VARCHAR(64) DEFAULT NULL,
      guest_email VARCHAR(190) COLLATE utf8mb4_bin DEFAULT NULL
    ) ENGINE=InnoDB;

    START TRANSACTION;
    -- Use the sender for inbound rows and the recorded recipient for replies. Do not
    -- infer a recipient from another thread or turn a deleted account into a guest.
    INSERT INTO gl_legacy_participants (message_id, company_id, user_id, guest_email)
    SELECT old.id, c.id, u.id,
           CASE WHEN u.id IS NULL THEN COALESCE(LOWER(TRIM(old.guest_email)), '') END
    FROM (
      SELECT id, to_company_id, from_company_id,
             CASE WHEN from_company_id IS NULL THEN from_user_id ELSE to_user_id END AS participant_id,
             CASE WHEN from_company_id IS NULL THEN from_email ELSE to_email END AS guest_email
      FROM messages_legacy_pending
    ) old
    JOIN companies c ON c.id = old.to_company_id
    LEFT JOIN users u ON u.id = old.participant_id
    WHERE (old.from_company_id IS NULL OR old.from_company_id = c.id)
      AND (old.participant_id IS NULL OR u.id IS NOT NULL);

    INSERT INTO conversations (company_id, user_id, guest_email, guest_name, created_at)
    SELECT p.company_id, p.user_id, p.guest_email,
           IF(p.user_id IS NULL, LEFT(MAX(IF(old.from_company_id IS NULL, old.from_name, old.to_name)), 190), NULL),
           COALESCE(MIN(old.created_at), CURRENT_TIMESTAMP)
    FROM gl_legacy_participants p
    JOIN messages_legacy_pending old ON old.id = p.message_id
    GROUP BY p.company_id, p.user_id, p.guest_email
    ON DUPLICATE KEY UPDATE id = conversations.id;

    INSERT INTO messages (id, conversation_id, to_company_id, from_side, from_name, from_email, to_email, to_name, body, is_read, created_at)
    SELECT old.id, cv.id, cv.company_id, IF(old.from_company_id IS NULL, 'user', 'company'), old.from_name,
           old.from_email, old.to_email, old.to_name, old.body, COALESCE(old.is_read, 0), old.created_at
    FROM messages_legacy_pending old
    JOIN gl_legacy_participants p ON p.message_id = old.id
    JOIN conversations cv ON cv.company_id = p.company_id AND cv.user_id <=> p.user_id AND cv.guest_email <=> p.guest_email
    LEFT JOIN messages migrated ON migrated.id = old.id
    WHERE migrated.id IS NULL
    ORDER BY old.created_at, old.id;

    COMMIT;
    DROP TEMPORARY TABLE gl_legacy_participants;
    RENAME TABLE messages_legacy_pending TO messages_legacy;
  END IF;
END$$
DELIMITER ;
CALL greenloop_upgrade_messages();
DROP PROCEDURE greenloop_upgrade_messages;
