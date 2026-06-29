-- Optional demo data, so a fresh dashboard isn't empty while you try things out.
-- Run it only if you want sample joiners. Delete these rows anytime from the app.
-- (These dates are illustrative; adjust freely.)

INSERT OR IGNORE INTO joiners (id, name, role, department, joiner_type, joining_date, stage_index, blocked, created_at) VALUES
  ('demo-1', 'Aarav Sharma',  'Backend Engineer', 'Engineering',     'non_immediate', '2026-07-15', 3, NULL,                              '2026-06-20T09:00:00Z'),
  ('demo-2', 'Priya Menon',   'Product Designer',  'Design',          'non_immediate', '2026-07-06', 6, NULL,                              '2026-06-18T09:00:00Z'),
  ('demo-3', 'Rahul Verma',   'Sales Executive',   'Sales',           'immediate',     '2026-06-30', 7, 'Laptop not yet allocated by IT', '2026-06-15T09:00:00Z'),
  ('demo-4', 'Sneha Iyer',    'HR Associate',      'Human Resources', 'non_immediate', '2026-06-22', 9, NULL,                              '2026-06-01T09:00:00Z'),
  ('demo-5', 'Mohit Gupta',   'Data Analyst',      'Analytics',       'non_immediate', '2026-08-01', 1, NULL,                              '2026-06-25T09:00:00Z');
