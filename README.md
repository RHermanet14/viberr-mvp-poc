# Viberr POC - AI-Driven UI Personalization

This MVP demonstrates per-user AI-driven UI personalization where different users can see the same data but with personalized designs that they can modify using natural language prompts.

## Features

- **Per-User Personalization**: Each user has their own independent design schema
- **AI-Powered Design Changes**: Natural language prompts modify the UI in real-time
- **Real-Time Updates**: UI updates instantly without page reload
- **Persistent Designs**: User designs are saved and persist across sessions
- **Multiple Component Types**: Tables, charts, KPIs, and text components

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript**
- **NextAuth** for authentication
- **Prisma** with PostgreSQL for data persistence
- **Groq API** for AI-powered design generation
- **Recharts** for data visualization
- **Tailwind CSS** for styling

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   See [SETUP.md](./SETUP.md) for detailed instructions on getting all environment variable values.
   
   Create a `.env` file with:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/viberr_poc"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here"
   GROQ_API_KEY="your-groq-api-key"
   ```

3. **Set up the database**:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Documentation

- **[SETUP.md](./SETUP.md)** - Detailed guide for local development setup and getting environment variable values
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete guide for deploying to production (Vercel, Railway, etc.)

## Usage

1. **Sign In**: Use any email address (MVP demo mode)
2. **View Default Dashboard**: See the default table and chart layout
3. **Customize with AI**: Type natural language prompts like:
   - "Make it dark mode"
   - "Show top 10 by price"
   - "Add a bar chart by month"
   - "Two-column layout"
   - "Bigger font size"
4. **See Changes Instantly**: The UI updates in real-time
5. **Persistent Design**: Refresh the page - your design is saved!

## API Endpoints

- `GET /api/data` - Returns product data
- `GET /api/data/summary` - Returns aggregated summary data
- `GET /api/schema` - Loads user's design schema
- `POST /api/schema` - Saves user's design schema
- `POST /api/ai` - Processes AI prompts and returns design operations

## Architecture

- **Schema System**: JSON-based design schema stored per user
- **Operation System**: AI generates operations (set_style, add_component, etc.)
- **Component Registry**: Supports table, chart, KPI, and text components
- **Guardrails**: JSON validation, component limits (30 max), operation whitelist

## Demo Flow

1. User A signs in → sees default dashboard
2. User A types: "Dark mode, bigger text, top 10 by revenue"
3. AI processes → generates operations → UI updates
4. User B signs in (different browser/session) → sees default dashboard
5. User B types: "Light mode, two columns, pie chart"
6. Both users see different designs of the same data

## Notes

- This is an MVP/POC - production would need additional security, error handling, and features
- Authentication is simplified for demo purposes
- Data source is currently mocked - can be replaced with real APIs
- AI operations are validated but user has significant freedom to customize
