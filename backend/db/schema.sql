-- DoltHub CRM schema (MySQL / Dolt syntax)

CREATE TABLE IF NOT EXISTS users (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'sales_rep',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT (NOW())
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (NOW()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT (NOW()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS accounts (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_name      VARCHAR(255) NOT NULL,
  website           VARCHAR(500),
  segment           VARCHAR(100),
  owner_id          INT NULL,
  last_contact_date DATE NULL,
  created_at        DATETIME NOT NULL DEFAULT (NOW()),
  updated_at        DATETIME NOT NULL DEFAULT (NOW()),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  name       VARCHAR(255) NOT NULL,
  title      VARCHAR(255),
  email      VARCHAR(255),
  phone      VARCHAR(100),
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (NOW()),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deals (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  deal_name       VARCHAR(255) NOT NULL,
  account_id      INT NOT NULL,
  stage           VARCHAR(100) NOT NULL DEFAULT 'Prospecting',
  deal_value      DECIMAL(14,2) NULL,
  close_date      DATE NULL,
  probability     INT NOT NULL DEFAULT 10,
  owner_id        INT NULL,
  win_loss_reason VARCHAR(500) NULL,
  stage_entered_at DATETIME NOT NULL DEFAULT (NOW()),
  created_at      DATETIME NOT NULL DEFAULT (NOW()),
  updated_at      DATETIME NOT NULL DEFAULT (NOW()),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id)   REFERENCES users(id)    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS deal_stage_history (
  id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  deal_id    INT NOT NULL,
  stage      VARCHAR(100) NOT NULL,
  entered_at DATETIME NOT NULL DEFAULT (NOW()),
  exited_at  DATETIME NULL,
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  content    TEXT NOT NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT (NOW()),
  updated_at DATETIME NOT NULL DEFAULT (NOW()),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id  INT NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  file_size   INT NULL,
  mime_type   VARCHAR(255) NULL,
  uploaded_by INT NULL,
  created_at  DATETIME NOT NULL DEFAULT (NOW()),
  FOREIGN KEY (account_id)  REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT (NOW())
);
