# Orderli take over Dashboard

A production-ready MVP web dashboard for recruiters to manage visits to hospitality locations, with duplicate prevention and overlap warnings.

## Tech Stack

- Next.js 14 (App Router) with TypeScript
- TailwindCSS for styling
- Supabase for authentication and PostgreSQL database
- Row Level Security (RLS) for data access control
- Mobile-first responsive design

## Features

- Authentication with email/password via Supabase Auth
- Role-based access (Admin and Recruiter)
- Visit management with duplicate prevention (60 days) and overlap warnings (30 days)
- Location search and management
- Project assignment system
- Admin dashboard for managing users, projects, and viewing all visits

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project

### 1. Clone and Install

```bash
git clone <repository-url>
cd roffa_zaken_overzicht
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your Project URL and anon/public key

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Google Maps API Key (Optional)

To enable the map view of locations:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Maps JavaScript API" and "Places API"
4. Create an API key under "Credentials"
5. Add the API key to your `.env.local` file

### 4. Run Database Migrations

1. In your Supabase dashboard, go to SQL Editor
2. Run the migrations in order:
   - Copy and execute the contents of `supabase/migrations/001_initial_schema.sql`
   - Copy and execute the contents of `supabase/migrations/002_create_profile_trigger.sql`

Alternatively, if you have the Supabase CLI installed:

```bash
supabase db push
```

### 5. Create an Admin User

After running migrations, you need to create an admin user:

1. Sign up a new user through the app's login page (or via Supabase Auth)
2. Go to Supabase Dashboard > Table Editor > `profiles`
3. Find your user's profile and update the `role` field to `'admin'`

Or run this SQL in the Supabase SQL Editor (replace `user_email@example.com` with your email):

```sql
UPDATE profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'user_email@example.com'
);
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin pages
│   ├── dashboard/          # Recruiter dashboard
│   ├── locations/         # Locations listing
│   ├── login/             # Authentication
│   └── visits/            # Visit management
├── components/             # Reusable React components
├── lib/                    # Utilities and Supabase client
├── supabase/
│   └── migrations/        # SQL migration files
├── types/                  # TypeScript type definitions
└── README.md
```

## Database Schema

### Tables

- `profiles`: User profiles with roles (admin/recruiter)
- `projects`: Projects that recruiters can be assigned to
- `recruiter_projects`: Many-to-many relationship between recruiters and projects
- `locations`: Hospitality locations
- `visits`: Visit records with all details

### Row Level Security (RLS)

RLS policies enforce:
- Recruiters can only see/edit their own visits
- Recruiters can only see projects they're assigned to
- Admins have full access to all data
- Locations are readable by all, but only admins can edit

## Deployment

Zie [DEPLOYMENT.md](./DEPLOYMENT.md) voor uitgebreide deployment instructies.

### Quick Start: Vercel (Aanbevolen)

1. Push code naar GitHub
2. Ga naar [vercel.com](https://vercel.com) en log in met GitHub
3. Klik "New Project" en selecteer je repository
4. Voeg environment variables toe:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Klik "Deploy"

Je app is live binnen 2-3 minuten!

### Self-Hosting

Voor self-hosting heb je Node.js nodig op je server. Zie [DEPLOYMENT.md](./DEPLOYMENT.md) voor volledige instructies.

## Usage

### For Recruiters

1. Log in with your email and password
2. View your visits on the Dashboard
3. Search locations on the Locations page
4. Create new visits via "New Visit" button
5. The system will warn you about:
   - Duplicate visits (same location within 60 days) - blocking
   - Overlapping visits (other recruiters visited within 30 days) - warning

### For Admins

1. Access the Admin section from the navigation
2. Manage Projects: Create, edit, and assign recruiters to projects
3. Manage Recruiters: View all users, change roles, activate/deactivate
4. View All Visits: See all visits across all recruiters with filters

## Security Notes

- All database access is protected by Row Level Security (RLS)
- Environment variables should never be committed to version control
- Use Supabase's built-in authentication features
- Regularly review and update RLS policies as needed

## Troubleshooting

### "Missing Supabase environment variables" error

Make sure your `.env.local` file exists and contains both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### RLS policies blocking access

Verify that:
1. Migrations have been run successfully
2. User profiles exist in the `profiles` table
3. For recruiters, they are assigned to projects via `recruiter_projects`

### Cannot create admin user

Make sure you've run the migration that creates the `profiles` table, then manually update the role in the Supabase dashboard or via SQL.

## License

Private project - All rights reserved
