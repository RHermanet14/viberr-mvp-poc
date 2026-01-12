# Environment Variables Setup Guide

## Required Environment Variables

Your `.env` file needs these 4 variables. Here's how to get each one:

### 1. DATABASE_URL (PostgreSQL)

**Format:** `postgresql://username:password@host:port/database_name`

**How to get it:**
- **If you have PostgreSQL installed locally:**
  - Default username is usually `postgres` (or your system username)
  - Default port is `5432`
  - You'll need to create a database called `viberr_poc`
  
  **Steps:**
  1. Open PostgreSQL command line or pgAdmin
  2. Run: `CREATE DATABASE viberr_poc;`
  3. Your connection string will be:
     ```
     DATABASE_URL="postgresql://postgres:your_password@localhost:5432/viberr_poc"
     ```
     (Replace `your_password` with your PostgreSQL password)

- **If using a cloud service (Supabase, Neon, Railway, etc.):**
  - They provide the connection string in their dashboard
  - Copy it directly - it will look like:
     ```
     DATABASE_URL="postgresql://user:pass@host.region.provider.com:5432/dbname?sslmode=require"
     ```
  
  **For Supabase specifically:**
  
  The connection string is in **Project Settings**, not Database Settings:
  
  1. In your Supabase project dashboard, look at the **left sidebar**
  2. Click on the **gear icon** (⚙️) at the bottom - this is **Project Settings**
  3. In the Project Settings menu, click on **"API"** (not Database)
  4. Scroll down to find the **"Database"** section
  5. You'll see **"Connection string"** with different connection modes:
     - **URI** - Direct connection (for local development and migrations)
     - **Connection pooling** - Recommended for production (better performance)
  6. Click the **"Copy"** button next to the connection string you want
  7. For local development, use the **URI** connection string
  8. For production/Vercel, use the **Connection pooling** string (includes `?pgbouncer=true`)
  
  **Important:** You'll need to replace `[YOUR-PASSWORD]` in the connection string with your actual database password. To get/reset your password:
  - Go to **Settings** → **Database** (the page you were on)
  - Click **"Reset database password"**
  - Copy the new password immediately (you won't see it again)
  
  The connection string will look like:
  ```
  postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  ```
  
  Or for direct connection:
  ```
  postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
  ```

- **If you don't have PostgreSQL:**
  - **Option A:** Install PostgreSQL locally
    - Windows: Download from https://www.postgresql.org/download/windows/
    - Mac: `brew install postgresql@14`
    - Linux: `sudo apt-get install postgresql`
  
  - **Option B:** Use a free cloud database (recommended for MVP)
    - **Supabase** (free tier): https://supabase.com
      - Sign up → New Project → Copy connection string from Settings → Database
    - **Neon** (free tier): https://neon.tech
      - Sign up → Create Project → Copy connection string
    - **Railway** (free tier): https://railway.app
      - Sign up → New Project → Add PostgreSQL → Copy connection string

### 2. NEXTAUTH_SECRET

**What it is:** A random secret key used to encrypt JWT tokens

**How to generate it:**

**On Windows (Git Bash or PowerShell):**
```bash
openssl rand -base64 32
```

**On Mac/Linux:**
```bash
openssl rand -base64 32
```

**Or use an online generator:**
- Visit: https://generate-secret.vercel.app/32
- Copy the generated string

**Example:**
```
NEXTAUTH_SECRET="aBc123XyZ456DeF789GhI012JkL345MnO678PqR901StU234VwX567YzA890="
```

### 3. NEXTAUTH_URL

**What it is:** The base URL of your application

**For local development:**
```
NEXTAUTH_URL="http://localhost:3000"
```

**For production:**
```
NEXTAUTH_URL="https://yourdomain.com"
```

### 4. GROQ_API_KEY

**What it is:** Your Groq API key for AI-powered design generation

**How to get it:**
1. Go to https://console.groq.com
2. Sign up or log in
3. Navigate to API Keys section
4. Click "Create API Key"
5. Copy the key (it's a long alphanumeric string)
6. **Important:** Save it immediately - you can't view it again!

**Example:**
```
GROQ_API_KEY="gsk_abc123xyz456def789ghi012jkl345mno678pqr901stu234vwx567yza890"
```

**Note:** Groq offers fast inference with competitive pricing. For testing, you can:
- Use the free tier (generous limits available)
- Set up billing with a usage limit if needed
- For MVP demo, you might want to add error handling for when the key is missing

---

## Complete .env Example

Here's what a complete `.env` file should look like:

```env
# PostgreSQL Database
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/viberr_poc"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="aBc123XyZ456DeF789GhI012JkL345MnO678PqR901StU234VwX567YzA890="

# Groq API (for AI design features)
GROQ_API_KEY="gsk_abc123xyz456def789ghi012jkl345mno678pqr901stu234vwx567yza890"
```

---

## Next Steps After Setting Up .env

1. **Verify your .env file is in the project root** (same folder as `package.json`)

2. **Test database connection:**
   ```bash
   npx prisma migrate dev --name init
   ```
   This will create the database tables.

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to http://localhost:3000

---

## Troubleshooting

**Database connection errors:**
- Make sure PostgreSQL is running
- Verify username/password are correct
- Check that the database exists
- Try using `localhost` instead of `127.0.0.1`

**NextAuth errors:**
- Make sure `NEXTAUTH_SECRET` is set and is a long random string
- Verify `NEXTAUTH_URL` matches your actual URL

**Groq API errors:**
- Check that your API key is valid
- Verify you have credits/quota available
- The app will still work without it, but AI features won't function
