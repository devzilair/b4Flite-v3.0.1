# b4Flite Crew Portal

**Version:** 55.15.0
**Last Updated:** February 2026

b4Flite is a comprehensive, enterprise-grade aviation crew management platform. It provides a centralized ecosystem for rostering, flight & duty tracking (FTL), leave management, training/exams, and operational communication.

## 🚀 Technology Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) (Class-based Dark Mode)
- **State & Cache:** [TanStack Query v5](https://tanstack.com/query/latest)
- **Backend-as-a-Service:** [Supabase](https://supabase.com/) (PostgreSQL 15+)
- **Testing:** [Vitest](https://vitest.dev/) (Unit), [Playwright](https://playwright.dev/) (E2E)
- **Monitoring:** [Sentry](https://sentry.io/) (Full-stack Error Tracking)
- **AI Integration:** Google Gemini (via AI SDK)

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- Node.js (v18+)
- NPM
- A Supabase Project

### 2. Environment Variables
Create a `.env` file in the project root with the following keys:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (optional for build)

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Sentry
SENTRY_AUTH_TOKEN=your_sentry_token
```

### 3. Installation
```bash
npm install
```

### 4. Running the App
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## 🧪 Testing

### Unit Tests
Run unit tests with Vitest:
```bash
npm run test
```

### E2E Tests
Run end-to-end tests with Playwright:
```bash
npx playwright test
```

---

## 📦 Backend Setup (Supabase)

This application relies on a specific PostgreSQL schema, Storage buckets, and Edge Functions.

### A. Database Initialization
👉 **[Go to DATABASE_SETUP.md](./DATABASE_SETUP.md)** to copy the Master SQL script.

### B. Storage Setup
👉 **[Go to storage_setup.md](./storage_setup.md)** to enable file uploads for documents and logos.

### C. Edge Functions
Deploy the required server-side functions for user invitation and setup.

```bash
# 1. Login to CLI
supabase login

# 2. Deploy Functions
supabase functions deploy portal-setup --no-verify-jwt
supabase functions deploy send-invitation --no-verify-jwt
```
