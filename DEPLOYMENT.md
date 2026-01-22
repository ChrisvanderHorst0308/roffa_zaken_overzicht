# Deployment Guide - Orderli take over

## Optie 1: Vercel (Aanbevolen - Gratis)

**Voordelen:**
- Geen Node.js installatie nodig
- Automatische SSL certificaten
- Gratis tier beschikbaar
- Automatische deployments vanuit GitHub

**Stappen:**

1. **Push code naar GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <jouw-github-repo-url>
   git push -u origin main
   ```

2. **Ga naar [vercel.com](https://vercel.com)**
   - Log in met GitHub
   - Klik "New Project"
   - Selecteer je repository

3. **Configureer:**
   - Framework Preset: Next.js (automatisch gedetecteerd)
   - Root Directory: `./` (laat leeg)
   - Build Command: `npm run build` (automatisch)
   - Output Directory: `.next` (automatisch)

4. **Environment Variables toevoegen:**
   - `NEXT_PUBLIC_SUPABASE_URL` = je Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = je Supabase anon key

5. **Deploy:**
   - Klik "Deploy"
   - Wacht 2-3 minuten
   - Je krijgt een URL zoals: `https://jouw-app.vercel.app`

**Klaar!** Je app is live.

---

## Optie 2: Self-Hosting met Node.js

**Vereisten:**
- Server met Node.js 18+ geïnstalleerd
- PM2 of systemd voor process management
- Nginx of Apache als reverse proxy (optioneel)

**Stappen:**

### 1. Build de applicatie lokaal:

```bash
npm install
npm run build
```

### 2. Upload naar server:

Upload deze bestanden/mappen naar je server:
- `.next/` (build output)
- `public/` (als je die hebt)
- `package.json`
- `package-lock.json`
- `node_modules/` (of run `npm install --production` op server)
- `.env.production` (met je environment variables)

**OF** gebruik een deployment tool zoals:
- `rsync`
- `scp`
- FTP/SFTP naar je filemanager

### 3. Op de server:

```bash
# Installeer Node.js (als nog niet geïnstalleerd)
# Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Of download van nodejs.org

# Installeer dependencies
npm install --production

# Start de app met PM2 (aanbevolen)
npm install -g pm2
pm2 start npm --name "orderli-takeover" -- start
pm2 save
pm2 startup  # Volg instructies voor auto-start

# OF start handmatig:
npm start
```

### 4. Environment Variables:

Maak `.env.production` op de server:
```env
NEXT_PUBLIC_SUPABASE_URL=https://jouw-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=jouw-anon-key
NODE_ENV=production
```

### 5. Reverse Proxy (Nginx):

Als je Nginx gebruikt, voeg toe aan `/etc/nginx/sites-available/default`:

```nginx
server {
    listen 80;
    server_name jouw-domein.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Dan: `sudo nginx -t` en `sudo systemctl reload nginx`

---

## Optie 3: Static Export (Beperkt)

**Let op:** Dit werkt NIET volledig omdat:
- Geen server-side rendering
- Geen API routes
- Supabase client-side calls werken wel, maar minder optimaal

Als je toch static export wilt:

1. Update `next.config.js`:
```js
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
}
```

2. Build:
```bash
npm run build
```

3. Upload `out/` folder naar je webhosting (via filemanager)

**Maar:** Dit wordt NIET aanbevolen voor deze app omdat je Supabase gebruikt en server-side features nodig hebt.

---

## Aanbeveling

**Gebruik Vercel** - het is:
- ✅ Gratis
- ✅ Makkelijk (5 minuten setup)
- ✅ Automatische deployments
- ✅ SSL certificaten
- ✅ Geen server management nodig
- ✅ Perfect voor Next.js apps

Je hoeft alleen:
1. Code naar GitHub te pushen
2. Vercel account aan te maken
3. Repository te importeren
4. Environment variables toe te voegen
5. Te deployen

**Klaar!**

---

## Environment Variables Checklist

Zorg dat je deze hebt ingesteld (in Vercel of op je server):

- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**NIET** committen naar GitHub! Gebruik environment variables in je hosting platform.
