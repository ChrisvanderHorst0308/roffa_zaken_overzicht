# Demo Guide - Orderli take over Dashboard

## Stap 1: Zorg dat je ingelogd bent als Admin

1. Open http://localhost:3001 (of 3000 als dat je poort is)
2. Log in met je email en wachtwoord
3. Je zou naar `/dashboard` moeten worden doorgestuurd

## Stap 2: Voeg demo data toe

### Optie A: Via Supabase SQL Editor (Aanbevolen)

1. Ga naar Supabase Dashboard > SQL Editor
2. Open `supabase/migrations/004_demo_data.sql`
3. **Eerst: Vind je User ID**
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'jouw_email@example.com';
   ```
   Kopieer het `id` (UUID)

4. **Voeg demo projects en locations toe:**
   - Kopieer het eerste deel van `004_demo_data.sql` (tot aan de recruiter_projects sectie)
   - Voer dit uit

5. **Assign jezelf aan projects:**
   - Vervang `YOUR_USER_ID_HERE` in het script met je echte User ID
   - Voer de recruiter_projects INSERT uit

6. **Voeg demo visits toe (optioneel):**
   - Vervang `YOUR_USER_ID_HERE` met je User ID
   - Voer de visits INSERT uit

### Optie B: Via de App UI

1. **Maak een Project aan:**
   - Ga naar `/admin` (als je admin bent)
   - Klik op "Projects" of ga naar `/admin/projects`
   - Klik "New Project"
   - Voer naam in: "Project Alpha"
   - Klik "Create"

2. **Assign jezelf aan het project:**
   - In de projects tabel, klik op je naam onder "Assigned Recruiters" om jezelf toe te voegen

3. **Maak een Location aan:**
   - Ga naar `/locations`
   - Klik op "New Visit" (of ga naar `/visits/new`)
   - Bij Location, klik "Create new location"
   - Vul in:
     - Name: "Café Central"
     - City: "Amsterdam"
     - Address: "Damrak 1" (optioneel)
     - Website: "https://cafecentral.nl" (optioneel)
   - Selecteer je project
   - Vul de rest van het formulier in
   - Klik "Create Visit"

## Stap 3: Test de Functionaliteit

### Als Recruiter:

1. **Dashboard bekijken:**
   - Ga naar `/dashboard`
   - Je zou je visits moeten zien in een tabel
   - Test de filters (Project, Status, Search)

2. **Locations bekijken:**
   - Ga naar `/locations`
   - Zoek naar locaties
   - Je zou moeten zien welke locaties je al hebt bezocht

3. **Nieuwe Visit aanmaken:**
   - Klik "New Visit" op het dashboard
   - Test de location search
   - Test het aanmaken van een nieuwe location
   - Test de duplicate check (probeer dezelfde location binnen 60 dagen)
   - Test de overlap warning (als een andere recruiter recent heeft bezocht)

### Als Admin:

1. **Projects beheren:**
   - Ga naar `/admin/projects`
   - Maak een nieuw project aan
   - Assign recruiters aan projects
   - Bewerk project details

2. **Recruiters beheren:**
   - Ga naar `/admin/recruiters`
   - Verander rollen (recruiter ↔ admin)
   - Activeer/deactiveer recruiters

3. **Alle Visits bekijken:**
   - Ga naar `/admin/visits`
   - Gebruik filters om visits te zoeken
   - Bekijk visits van alle recruiters

## Test Scenario's

### Scenario 1: Duplicate Prevention
1. Maak een visit aan voor "Café Central" vandaag
2. Probeer opnieuw een visit aan te maken voor "Café Central" vandaag
3. Je zou een blocking modal moeten zien: "Already Visited"

### Scenario 2: Overlap Warning
1. Maak een visit aan voor een location
2. Wacht 1 dag (of pas de visit_date aan in de database)
3. Probeer een nieuwe visit aan te maken voor dezelfde location
4. Je zou een warning modal moeten zien: "Possible Overlap"

### Scenario 3: Location Search
1. Ga naar `/locations`
2. Zoek op "Café" of "Amsterdam"
3. Je zou gefilterde resultaten moeten zien

### Scenario 4: Project Filtering
1. Ga naar `/dashboard`
2. Selecteer een specifiek project in de filter
3. Je zou alleen visits voor dat project moeten zien

## Troubleshooting

**Geen data zichtbaar?**
- Check of je assigned bent aan een project (als recruiter)
- Check of je admin bent (voor admin pagina's)
- Check de browser console voor errors

**Kan geen visits aanmaken?**
- Zorg dat je assigned bent aan het project dat je selecteert
- Check of de location bestaat of maak een nieuwe aan

**RLS errors?**
- Zorg dat de migrations correct zijn uitgevoerd
- Check of je profile bestaat in de `profiles` tabel
- Check of je role correct is ingesteld

## Quick Test Checklist

- [ ] Kan inloggen
- [ ] Ziet dashboard na login
- [ ] Kan nieuwe visit aanmaken
- [ ] Kan nieuwe location aanmaken
- [ ] Duplicate check werkt (blocking modal)
- [ ] Overlap warning werkt (warning modal)
- [ ] Filters werken op dashboard
- [ ] Location search werkt
- [ ] Admin kan projects beheren
- [ ] Admin kan recruiters beheren
- [ ] Admin ziet alle visits
