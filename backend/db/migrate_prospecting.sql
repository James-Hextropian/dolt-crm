-- Outbound prospecting tables

CREATE TABLE IF NOT EXISTS prospects (
  id                   INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  first_name           VARCHAR(100),
  last_name            VARCHAR(100),
  title                VARCHAR(150),
  company              VARCHAR(150),
  email                VARCHAR(150),
  linkedin_url         VARCHAR(255),
  segment              VARCHAR(100),
  sequence_id          INT NULL,
  sequence_stage       VARCHAR(50) NOT NULL DEFAULT 'Not Started',
  sequence_step        INT NOT NULL DEFAULT 0,
  last_contact_date    DATE NULL,
  next_action          VARCHAR(100),
  next_action_date     DATE NULL,
  status               VARCHAR(50) NOT NULL DEFAULT 'Active',
  notes                TEXT,
  assigned_to          INT NULL,
  converted_account_id INT NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS email_sequences (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  segment     VARCHAR(100),
  description TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sequence_id INT NOT NULL,
  step_number INT NOT NULL,
  channel     VARCHAR(50) NOT NULL DEFAULT 'Email',
  day_offset  INT NOT NULL DEFAULT 0,
  subject     VARCHAR(255),
  body        TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sequence_id) REFERENCES email_sequences(id) ON DELETE CASCADE
);

-- ── Seed email sequences ──────────────────────────────────────────────────────

INSERT INTO email_sequences (name, segment, description) VALUES
  ('Coding Agents ICP', 'Coding Agents', 'Outbound sequence for teams building coding agents and multi-agent systems'),
  ('FSI / Banks ICP',   'FSI / Banks',   'Compliance-led sequence for financial institutions and banks'),
  ('App Builders ICP',  'App Builders',  'Product-led sequence for companies building data-driven applications');

-- Sequence 1: Coding Agents ICP steps
INSERT INTO sequence_steps (sequence_id, step_number, channel, day_offset, subject, body) VALUES
  (1, 1, 'Email', 1,
   'version control for your agent''s memory',
   'Hi {{first_name}},

Your agents probably write and read from a database — but when you scale from 4 to 600 parallel agents (like GasTown did), that shared mutable state becomes your biggest bottleneck.

Dolt gives every agent branch-and-merge semantics for their data. No more conflicts. Full rollback. Complete audit trail of what every agent touched.

Worth a 20-minute conversation?

— James
DoltHub'),

  (1, 2, 'LinkedIn', 3,
   NULL,
   'Hi {{first_name}} — reaching out because {{company}}''s work on agents caught my attention. I''d love to connect and share how teams like GasTown are using Dolt to version control their agent''s data layer.'),

  (1, 3, 'Email', 5,
   'the branch/merge problem in multi-agent systems',
   'Hi {{first_name}},

Quick technical question: when your agents concurrently write to shared state, how do you handle conflicts?

Most teams either serialize everything (slow) or accept dirty reads (dangerous for AI outputs).

Dolt''s Prolly Tree data structure gives you Git-style branching at the database level — agents can work on isolated branches and merge when done. It''s how MySQL should have been built.

Happy to share our benchmark data on concurrent agent workloads.

— James'),

  (1, 4, 'Email', 10,
   'quick question about {{company}}''s agent architecture',
   'Hi {{first_name}},

One question: do your agents share a single database, or does each agent have isolated state?

If it''s shared, I''d love to show you how {{company}} could use Dolt''s time-travel queries to debug "why did agent #347 make that decision 3 days ago?"

15 minutes?

— James'),

  (1, 5, 'Email', 14,
   'closing the loop',
   'Hi {{first_name}},

I''ve reached out a few times without a response — totally fine, I know timing matters.

I''ll leave you with this: if you''re ever debugging a multi-agent data issue and wishing you could time-travel to see what your agents wrote 3 days ago, that''s what Dolt does.

Feel free to reach out when the time is right.

— James');

-- Sequence 2: FSI / Banks ICP steps
INSERT INTO sequence_steps (sequence_id, step_number, channel, day_offset, subject, body) VALUES
  (2, 1, 'Email', 1,
   'auditability for AI decisions at {{company}}',
   'Hi {{first_name}},

Under the EU AI Act and emerging US guidance, financial institutions using AI for decisions need a complete audit trail: what data did the model see, at what point in time, and what version of the model made the decision?

Dolt is the only database that lets you time-travel to the exact state of your data at any point in the past — without extra infrastructure.

Would love to show you how two of our bank customers handle this. 20 minutes?

— James
DoltHub'),

  (2, 2, 'LinkedIn', 3,
   NULL,
   'Hi {{first_name}} — following up on my email about AI auditability at {{company}}. Dolt gives financial teams a complete version-controlled audit trail for their data — similar to what Git does for code. Happy to connect.'),

  (2, 3, 'Email', 7,
   'how banks use Dolt for model versioning',
   'Hi {{first_name}},

A quick use case: one of our bank customers uses Dolt to version control their ML training data alongside their model versions. When regulators ask "why did the model make this decision in March?", they can replay the exact training data from that date.

Your compliance and model risk teams will love this — no more "we think it was this version of the data."

Happy to share the full case study.

— James'),

  (2, 4, 'Email', 14,
   'ROI on data auditability',
   'Hi {{first_name}},

One regulatory finding related to data lineage can cost more than our entire annual contract.

Most teams spend weeks piecing together what data their models saw at a decision point. Dolt makes that a single SQL query: SELECT * FROM training_data AS OF ''2024-03-15''.

Worth 15 minutes to see if we''re a fit?

— James'),

  (2, 5, 'Email', 21,
   'last note from DoltHub',
   'Hi {{first_name}},

I''ll stop reaching out after this. If {{company}} ever needs to answer the question "what did our data look like when we made this decision?" — Dolt is the answer.

Reach out any time.

— James');

-- Sequence 3: App Builders ICP steps
INSERT INTO sequence_steps (sequence_id, step_number, channel, day_offset, subject, body) VALUES
  (3, 1, 'Email', 1,
   'your customers want data rollback — here''s how',
   'Hi {{first_name}},

If {{company}}''s customers ever lose data — bad import, bad migration, accidental delete — how do you restore it?

Most app builders have to restore from backup (slow, loses hours of data) or say sorry. Dolt gives your customers a rollback button in SQL. Undo any change, branch for testing, merge when ready.

It''s like giving your app Git superpowers for its data layer.

Worth a quick chat?

— James
DoltHub'),

  (3, 2, 'LinkedIn', 3,
   NULL,
   'Hi {{first_name}} — I''d love to connect. I help app-building teams like {{company}} add data versioning and rollback to their stack using Dolt. Flock Safety uses us for ML training data versioning. Happy to share what that looks like.'),

  (3, 3, 'Email', 8,
   'Flock Safety uses Dolt for ML training data versioning',
   'Hi {{first_name}},

Flock Safety (video security platform) uses Dolt to version control the training data for their ML models. When a model degrades, they can instantly identify which data change caused it and roll back — without affecting production data.

For {{company}}, this could mean: your data scientists branch the dataset, run experiments, and merge only the version that improves the model.

Quick demo?

— James'),

  (3, 4, 'Email', 15,
   'last email from DoltHub',
   'Hi {{first_name}},

I''ll leave you with a simple offer: if {{company}} ever has a customer who accidentally deletes important data, or a data migration that goes wrong — Dolt''s time-travel SQL lets you undo it in seconds.

SELECT * FROM your_table AS OF ''2024-01-15''

Reach out when it''s relevant.

— James');
