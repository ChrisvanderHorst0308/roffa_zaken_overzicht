/* Demo data script - Run this AFTER you have created a user and set them as admin */

/* First, get your user ID - replace 'your_email@example.com' with your actual email */
/* Then uncomment and run this section to get your user ID:
SELECT id, email FROM auth.users WHERE email = 'your_email@example.com';
*/

/* 
IMPORTANT: Replace 'YOUR_USER_ID_HERE' with your actual user ID from the query above
You can find your user ID by running:
SELECT id FROM auth.users WHERE email = 'your_email@example.com';
*/

/* Create demo projects */
INSERT INTO projects (name, active) VALUES
  ('Project Alpha', true),
  ('Project Beta', true),
  ('Project Gamma', true)
ON CONFLICT DO NOTHING;

/* Create demo locations */
INSERT INTO locations (name, city, address, website, pos_system) VALUES
  ('Café Central', 'Amsterdam', 'Damrak 1', 'https://cafecentral.nl', 'Lightspeed'),
  ('Restaurant De Gouden Leeuw', 'Rotterdam', 'Witte de Withstraat 45', 'https://degoudenleeuw.nl', 'TouchBistro'),
  ('Bar Bistro', 'Utrecht', 'Oudegracht 12', NULL, 'Square'),
  ('Pizzeria Bella', 'Amsterdam', 'Leidseplein 8', 'https://pizzeriabella.nl', 'Lightspeed'),
  ('Sushi Palace', 'Den Haag', 'Spui 20', NULL, 'TouchBistro')
ON CONFLICT DO NOTHING;

/* 
Assign your user to projects (replace YOUR_USER_ID_HERE with your actual user ID)
First, get your user ID:
SELECT id FROM auth.users WHERE email = 'your_email@example.com';
*/
/*
INSERT INTO recruiter_projects (recruiter_id, project_id)
SELECT 
  'YOUR_USER_ID_HERE'::uuid,
  id
FROM projects
WHERE name IN ('Project Alpha', 'Project Beta')
ON CONFLICT DO NOTHING;
*/

/* 
Create demo visits (replace YOUR_USER_ID_HERE with your actual user ID)
Make sure to run the recruiter_projects insert above first!
*/
/*
INSERT INTO visits (recruiter_id, project_id, location_id, pos_system, spoken_to, takeaway, delivery, status, visit_date, notes)
SELECT 
  'YOUR_USER_ID_HERE'::uuid,
  (SELECT id FROM projects WHERE name = 'Project Alpha' LIMIT 1),
  (SELECT id FROM locations WHERE name = 'Café Central' LIMIT 1),
  'Lightspeed',
  'Manager Jan',
  true,
  false,
  'interested',
  CURRENT_DATE - INTERVAL '5 days',
  'Great location, interested in demo'
ON CONFLICT DO NOTHING;
*/

/* Verification - Check what was created */
SELECT 'Projects created:' as info, COUNT(*) as count FROM projects;
SELECT 'Locations created:' as info, COUNT(*) as count FROM locations;
