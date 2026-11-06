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
  emission    INT          DEFAULT 0,
  description TEXT,
  emoji       VARCHAR(50)  DEFAULT 'factory',
  owner_name  VARCHAR(190) DEFAULT '',
  owner_email VARCHAR(190) DEFAULT '',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

CREATE TABLE IF NOT EXISTS messages (
  id               VARCHAR(64) PRIMARY KEY,
  to_company_id    VARCHAR(64) NOT NULL,
  from_company_id  VARCHAR(64) DEFAULT NULL,
  from_user_id     VARCHAR(64) DEFAULT NULL,
  from_name        VARCHAR(190) DEFAULT '',
  from_email       VARCHAR(190) DEFAULT '',
  to_user_id       VARCHAR(64) DEFAULT NULL,
  to_email         VARCHAR(190) DEFAULT NULL,
  to_name          VARCHAR(190) DEFAULT NULL,
  body             TEXT NOT NULL,
  is_read          TINYINT(1) DEFAULT 0,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_to_company (to_company_id),
  INDEX idx_from_user (from_user_id),
  INDEX idx_to_user (to_user_id)
) ENGINE=InnoDB;
