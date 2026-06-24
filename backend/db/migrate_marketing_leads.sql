ALTER TABLE prospects ADD COLUMN `source` VARCHAR(50) DEFAULT 'Sales' AFTER `segment`;
ALTER TABLE prospects ADD COLUMN `priority` VARCHAR(20) DEFAULT 'Medium' AFTER `source`;
ALTER TABLE prospects ADD COLUMN added_by VARCHAR(100) AFTER `priority`;

CREATE TABLE IF NOT EXISTS marketing_leads (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  title VARCHAR(150),
  company VARCHAR(150),
  email VARCHAR(150),
  linkedin_url VARCHAR(255),
  segment VARCHAR(100),
  `priority` VARCHAR(20) DEFAULT 'Medium',
  `source` VARCHAR(100),
  notes TEXT,
  status VARCHAR(50) DEFAULT 'New',
  assigned_to INT,
  imported_by VARCHAR(100),
  import_batch VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  converted_to_prospect_id INT
);
