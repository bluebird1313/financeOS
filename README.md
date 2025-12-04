# Life Financial Operating System

A comprehensive personal and business financial management desktop application built with Electron, React, TypeScript, and Supabase.

## Features

### Core Modules

- **Dashboard** - Real-time overview of your financial health, net worth tracking, and recent activity
- **Account Hub** - Connect unlimited bank accounts via Plaid or add manual accounts
- **Transaction Engine** - AI-powered categorization, search, filtering, and bulk editing
- **Check Register** - Track checks with auto-matching and OCR support for payee extraction
- **Bills & Subscriptions** - Automatic detection, due date tracking, and payment reminders
- **Cash Flow Command Center** - Visualizations, AI-powered forecasting, and low balance alerts
- **Multi-Business Management** - Separate P&L per business with tax-ready categorization
- **Alert System** - Configurable notifications for balance, spending, and anomalies
- **AI Financial Assistant** - Chat interface for natural language queries about your finances
- **Reports & Analytics** - Spending breakdowns, income vs expenses, and custom exports

### Key Highlights

- **Smart Check Tracking** - Record checks as you write them, auto-match when they clear
- **AI Categorization** - Machine learning categorizes transactions and learns from corrections
- **Multi-Business Support** - Track personal and multiple businesses separately
- **Real-time Sync** - Plaid integration for automatic bank account syncing
- **Desktop Notifications** - Never miss a bill or important financial alert

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Desktop**: Electron
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Bank Integration**: Plaid API
- **AI**: OpenAI API
- **Charts**: Recharts
- **State Management**: Zustand
- **Data Fetching**: TanStack Query

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Plaid account (for bank connections)
- OpenAI API key (for AI features)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd life-financial-os
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
- `VITE_PLAID_CLIENT_ID` - Your Plaid client ID
- `VITE_PLAID_SECRET` - Your Plaid secret
- `VITE_OPENAI_API_KEY` - Your OpenAI API key

4. Set up the database:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy the contents of `supabase/schema.sql` and execute it

5. Run the development server:
```bash
npm run electron:dev
```

### Building for Production

```bash
npm run electron:build
```

This will create distributable files in the `release` folder.

## Project Structure

```
├── electron/              # Electron main process
│   ├── main.ts           # Main process entry
│   └── preload.ts        # Preload script
├── src/
│   ├── components/       # React components
│   │   ├── layout/       # Layout components
│   │   └── ui/           # UI primitives (shadcn)
│   ├── lib/              # Utility functions
│   │   ├── openai.ts     # OpenAI integration
│   │   ├── supabase.ts   # Supabase client
│   │   └── utils.ts      # Helper functions
│   ├── pages/            # Page components
│   ├── stores/           # Zustand stores
│   │   ├── authStore.ts  # Authentication state
│   │   └── financialStore.ts  # Financial data
│   ├── types/            # TypeScript types
│   ├── App.tsx           # Root component
│   ├── main.tsx          # React entry point
│   └── index.css         # Global styles
├── supabase/
│   └── schema.sql        # Database schema
└── package.json
```

## Database Schema

The app uses the following main tables:

- `users` - User profiles
- `businesses` - Business entities
- `accounts` - Bank accounts (Plaid or manual)
- `transactions` - Financial transactions
- `checks` - Check register
- `bills` - Bill tracking
- `recurring_transactions` - Detected recurring payments
- `alerts` - User notifications
- `categories` - Transaction categories
- `user_preferences` - User settings

All tables have Row Level Security (RLS) enabled.

## Check Register Feature

The check register is designed to solve a common pain point: knowing who checks were written to after they clear.

### How it works:

1. **Record checks as you write them** - Enter check number, payee, amount, and memo
2. **Auto-matching** - When the check clears your bank, it's automatically matched
3. **OCR support** - Upload check images to extract payee via OCR
4. **AI suggestions** - Based on patterns, the AI suggests likely payees
5. **Reconciliation view** - Dashboard shows unmatched checks needing attention

## AI Features

The app integrates OpenAI for several features:

- **Transaction Categorization** - Automatically categorizes transactions
- **Financial Insights** - Generates personalized observations
- **Chat Assistant** - Answer questions about your finances
- **Check Payee Suggestions** - Suggests payees based on patterns

## Security

- All API keys are stored securely
- Supabase RLS ensures users only see their own data
- Plaid tokens are encrypted
- Desktop app runs locally with your data

## License

MIT License




