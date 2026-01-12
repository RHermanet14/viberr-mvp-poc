# Deployment Guide - Viberr POC

This guide covers deploying your Next.js application to production.

## Recommended Platforms

### Option 1: Vercel (Recommended for Next.js)
**Best for:** Next.js apps, easiest setup, free tier available
**Pros:** 
- Built by Next.js creators, zero-config deployment
- Automatic HTTPS, CDN, and edge functions
- Free tier with generous limits
- Easy environment variable management
- Automatic deployments from Git

**Cons:**
- Database needs to be hosted separately (but easy to connect)

### Option 2: Railway
**Best for:** Full-stack apps with database
**Pros:**
- Can host both app and PostgreSQL database
- Simple pricing, pay-as-you-go
- Easy database setup
- Good for MVP/production

**Cons:**
- Slightly more complex than Vercel

### Option 3: Render
**Best for:** Simple deployments with database
**Pros:**
- Free tier available
- Can host database
- Simple interface

**Cons:**
- Free tier spins down after inactivity

---

## Deployment Steps

### Method 1: Deploy to Vercel (Recommended)

#### Step 1: Prepare Your Code
1. **Push to GitHub/GitLab/Bitbucket:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/viberr-poc.git
   git push -u origin main
   ```

2. **Update .env.example** (for reference, don't commit .env):
   ```env
   DATABASE_URL="postgresql://..."
   NEXTAUTH_URL="https://your-app.vercel.app"
   NEXTAUTH_SECRET="your-secret"
   GROQ_API_KEY="your-groq-api-key"
   ```

#### Step 2: Set Up Production Database
Choose one:

**A. Supabase (Recommended - Free tier)**
1. Go to https://supabase.com
2. Create new project
3. Go to Settings → Database
4. Copy the connection string (use "Connection pooling" for production)
5. Format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?pgbouncer=true`

**B. Neon (Free tier)**
1. Go to https://neon.tech
2. Create project
3. Copy connection string from dashboard

**C. Railway PostgreSQL**
1. Go to https://railway.app
2. New Project → Add PostgreSQL
3. Copy connection string

#### Step 3: Deploy to Vercel
1. Go to https://vercel.com
2. Sign up/login with GitHub
3. Click "Add New Project"
4. Import your repository
5. Configure:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)

6. **Add Environment Variables:**
   - `DATABASE_URL` - Your production database connection string
   - `NEXTAUTH_URL` - Your Vercel app URL (e.g., `https://your-app.vercel.app`)
   - `NEXTAUTH_SECRET` - Use the same secret or generate a new one (generate with: `openssl rand -base64 32`)
   - `GROQ_API_KEY` - Your Groq API key (get from https://console.groq.com)

7. Click "Deploy"

#### Step 4: Run Database Migrations
After deployment, run migrations on production database:

**Option A: Using Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel link
npx prisma migrate deploy
```

**Option B: Direct connection**
```bash
# Set production DATABASE_URL temporarily
export DATABASE_URL="your-production-db-url"
npx prisma migrate deploy
```

**Option C: Use Prisma Studio (for manual setup)**
```bash
DATABASE_URL="your-production-db-url" npx prisma studio
```

#### Step 5: Update NEXTAUTH_URL
After first deployment, Vercel will give you a URL. Update the `NEXTAUTH_URL` environment variable in Vercel dashboard to match your actual URL.

---

### Method 2: Deploy to Railway (All-in-One)

#### Step 1: Prepare Repository
Same as Vercel - push to Git.

#### Step 2: Deploy App
1. Go to https://railway.app
2. Sign up/login
3. "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway auto-detects Next.js

#### Step 3: Add PostgreSQL Database
1. In your project, click "+ New"
2. Select "Database" → "Add PostgreSQL"
3. Railway creates database automatically

#### Step 4: Configure Environment Variables
1. Go to your app service → Variables
2. Add:
   - `DATABASE_URL` - Copy from PostgreSQL service → Variables → `DATABASE_URL`
   - `NEXTAUTH_URL` - Your Railway app URL (e.g., `https://your-app.up.railway.app`)
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
   - `GROQ_API_KEY` - Your Groq API key

#### Step 5: Run Migrations
Railway provides a web terminal or you can use Railway CLI:
```bash
railway login
railway link
railway run npx prisma migrate deploy
```

---

## Production Checklist

### Before Deploying

- [ ] **Environment Variables:**
  - [ ] All variables set in hosting platform
  - [ ] `NEXTAUTH_URL` matches your production domain
  - [ ] `DATABASE_URL` points to production database
  - [ ] `NEXTAUTH_SECRET` is a strong random string
  - [ ] `GROQ_API_KEY` is valid

- [ ] **Database:**
  - [ ] Production database created
  - [ ] Migrations run (`npx prisma migrate deploy`)
  - [ ] Connection string tested

- [ ] **Code:**
  - [ ] `.env` is in `.gitignore` (never commit secrets!)
  - [ ] All sensitive data removed from code
  - [ ] Error handling in place
  - [ ] Build succeeds locally (`npm run build`)

- [ ] **Security:**
  - [ ] API routes protected (authentication checks)
  - [ ] Rate limiting considered (for `/api/ai`)
  - [ ] CORS configured if needed
  - [ ] Input validation on API endpoints

### After Deploying

- [ ] **Testing:**
  - [ ] Sign in works
  - [ ] Dashboard loads
  - [ ] AI prompts work
  - [ ] Schema persists after refresh
  - [ ] Multiple users can have different designs

- [ ] **Monitoring:**
  - [ ] Check application logs
  - [ ] Monitor database connections
  - [ ] Set up error tracking (Sentry, etc.)
  - [ ] Monitor API usage (Groq costs)

---

## Custom Domain Setup

### Vercel
1. Go to Project Settings → Domains
2. Add your domain
3. Follow DNS configuration instructions
4. Update `NEXTAUTH_URL` to your custom domain

### Railway
1. Go to your service → Settings → Networking
2. Generate domain or add custom domain
3. Update `NEXTAUTH_URL` environment variable

---

## Production Optimizations

### 1. Database Connection Pooling
For production, use connection pooling:
- **Supabase:** Use connection pooling URL (includes `?pgbouncer=true`)
- **Neon:** Connection pooling included
- **Railway:** Configure in database settings

### 2. Environment-Specific Config
Consider using different configs:
```typescript
// lib/config.ts
export const config = {
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl: process.env.DATABASE_URL!,
  nextAuthUrl: process.env.NEXTAUTH_URL!,
}
```

### 3. Error Tracking
Add error tracking:
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### 4. Rate Limiting
Add rate limiting for `/api/ai`:
```bash
npm install @upstash/ratelimit @upstash/redis
```

### 5. Caching
Consider caching for `/api/data` endpoints:
```typescript
export const revalidate = 60 // Revalidate every 60 seconds
```

---

## Cost Estimates

### Free Tier Options:
- **Vercel:** Free (hobby plan) - 100GB bandwidth/month
- **Supabase:** Free - 500MB database, 2GB bandwidth
- **Neon:** Free - 0.5GB storage
- **Railway:** $5/month free credit

### Paid (if needed):
- **Vercel Pro:** $20/month
- **Supabase Pro:** $25/month
- **Groq API:** Pay-per-use (very competitive pricing, check current rates)

---

## Troubleshooting

### Database Connection Issues
- Verify connection string format
- Check if database allows connections from your hosting IP
- Use connection pooling for better performance
- Check database logs

### NextAuth Issues
- Verify `NEXTAUTH_URL` matches your actual domain
- Check `NEXTAUTH_SECRET` is set
- Clear cookies and try again
- Check server logs for errors

### Build Failures
- Check environment variables are set
- Verify all dependencies are in `package.json`
- Check build logs for specific errors
- Test build locally first: `npm run build`

### Groq API Issues
- Verify API key is correct
- Check you have credits/quota
- Add error handling for API failures
- Consider adding retry logic

---

## Quick Deploy Commands

### Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Railway CLI
```bash
npm i -g @railway/cli
railway login
railway up
```

### Manual Build Test
```bash
npm run build
npm start
```

---

## Recommended Stack for Production

1. **Hosting:** Vercel (Next.js optimized)
2. **Database:** Supabase or Neon (managed PostgreSQL)
3. **Domain:** Your custom domain (optional)
4. **Monitoring:** Vercel Analytics (built-in) or Sentry
5. **Error Tracking:** Sentry (free tier available)

This setup gives you:
- ✅ Zero-config deployment
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Easy scaling
- ✅ Free tier to start
