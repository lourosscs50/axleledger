# Axleledger

Axleledger is a mobile-first web application for owner-operators and lease-purchase truck drivers who need a clear view of loads, expenses, and operating performance.

The goal is simple: record the numbers that matter, understand weekly and monthly profitability, and make better business decisions on the road.

## Live App

- Production: https://www.axleledger.com
- Vercel fallback: https://axleledger.vercel.app

## Current Status

Axleledger is in active development.

The current version includes:

- Email-based authentication with Supabase
- Protected application routes
- Load creation, listing, and deletion
- Expense creation, listing, and deletion
- Dashboard summaries using live Supabase data
- Recent activity tracking
- Reporting-period controls
- Responsive mobile and desktop navigation
- Production deployment through Vercel
- Custom domain configuration for `axleledger.com`

## Core Features

### Authentication

- Email magic-link authentication
- Supabase server-side session handling
- Protected routes
- Authentication callback flow
- Check-email confirmation page
- Local and production redirect support

### Load Tracking

Users can record and manage load information such as:

- Load number
- Origin
- Destination
- Pickup date
- Delivery date
- Loaded miles
- Deadhead miles
- Gross revenue
- Load status

### Expense Tracking

Users can record operating expenses such as:

- Fuel
- Truck payment
- Insurance
- Maintenance
- Repairs
- Tolls
- Parking
- Scales
- Permits
- Meals
- Other business expenses

### Dashboard

The dashboard combines load and expense data to provide a quick operating overview.

Current dashboard capabilities include:

- Load totals
- Revenue totals
- Expense totals
- Profit visibility
- Recent activity
- Quick actions
- Reporting-period selection
- Performance status indicators

Status colors follow a consistent meaning:

- Green: healthy performance
- Yellow: needs attention
- Red: poor performance or immediate concern

## Technology Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- PostgreSQL
- Vercel
- ESLint
- Git and GitHub

## Project Structure

```text
axleledger/
├── src/
│   ├── app/
│   │   ├── auth/
│   │   │   ├── callback/
│   │   │   └── check-email/
│   │   ├── expenses/
│   │   ├── loads/
│   │   ├── login/
│   │   └── page.tsx
│   └── lib/
├── supabase/
│   └── migrations/
├── public/
├── package.json
└── README.md
```

## Local Development

### Prerequisites

Install the following before running the project:

- Node.js
- npm
- Git
- A Supabase project

### Clone the Repository

```bash
git clone <repository-url>
cd axleledger
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do not commit `.env.local` to source control.

### Run the Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Supabase Configuration

### Authentication URL Configuration

For local development, allow:

```text
http://localhost:3000/auth/callback
```

For production, allow:

```text
https://www.axleledger.com/auth/callback
https://axleledger.com/auth/callback
https://axleledger.vercel.app/auth/callback
```

The production Site URL should point to the active primary domain.

### Database Migrations

Current migrations include:

```text
supabase/migrations/20260711010000_create_loads.sql
supabase/migrations/20260712010000_create_expenses.sql
```

These migrations create the initial `loads` and `expenses` tables.

## Available Scripts

Run the development server:

```bash
npm run dev
```

Run linting:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

Start the production server locally:

```bash
npm run start
```

## Validation Workflow

Before committing changes, run:

```bash
npm run lint
npm run build
```

Only commit and push when both commands complete successfully.

## Deployment

Axleledger is deployed with Vercel.

The production deployment uses environment variables configured in the Vercel project settings.

DNS is managed through Namecheap and points the custom domain to Vercel.

Current production domains:

```text
https://axleledger.com
https://www.axleledger.com
```

## Roadmap

Planned improvements include:

- Load editing
- Expense editing
- Expense categories and filters
- Weekly and monthly reports
- Profit per mile
- Revenue per loaded mile
- Revenue per total mile
- Fuel cost per mile
- Break-even analysis
- Settlement tracking
- Receipt uploads
- CSV export
- Tax-ready expense summaries
- Maintenance reminders
- Budget targets
- Better dashboard charts
- Custom SMTP for production authentication emails
- Expanded mobile usability
- User settings and preferences

## Product Direction

Axleledger is being built around the real operating needs of lease-purchase and owner-operator drivers.

The application is intended to help answer practical questions such as:

- Am I profitable this week?
- What is my true cost per mile?
- Which expenses are hurting my margin?
- How much revenue am I generating per load?
- Am I covering my fixed costs?
- What do I need to earn before accepting the next load?

## Security Notes

- Supabase handles authentication and database access.
- Environment variables are stored outside source control.
- Sensitive keys should never be committed.
- Database access should remain protected with Row Level Security policies.
- Production authentication should use a configured SMTP provider rather than relying on testing-only email delivery.


PROPRIETARY SOFTWARE LICENSE

Copyright (c) 2026 Lou Carron. All rights reserved.

Axleledger and its source code, documentation, designs, branding, and related
materials are proprietary and confidential unless explicitly stated otherwise
in writing by the copyright owner.

No permission is granted to use, copy, modify, merge, publish, distribute,
sublicense, sell, reverse engineer, or create derivative works from this
software or any substantial portion of it.

Access to this repository or possession of a copy of the software does not
grant any ownership interest or license rights.

The name "Axleledger," its branding, logos, and associated product identity may
not be used without prior written permission from the copyright owner.

THE SOFTWARE IS PROVIDED "AS IS," WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE COPYRIGHT
OWNER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING FROM, OUT OF,
OR IN CONNECTION WITH THE SOFTWARE OR ITS USE.

For licensing, partnership, or commercial-use inquiries, contact the copyright
owner.
