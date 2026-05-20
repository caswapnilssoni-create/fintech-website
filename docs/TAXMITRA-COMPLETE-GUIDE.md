# TaxMitra — Complete Project Guide

**Your reference manual for everything we built together.**

This document is written for non-technical readers. Every concept is explained in plain English with real-world analogies. By the end you'll understand:

- What you have running
- How it all fits together
- Which tool does what
- How to make changes safely
- What to do if something breaks

If a term sounds unfamiliar, jump to the **Glossary** at the bottom.

---

## Table of Contents

1. [The Big Picture — What You Own Now](#1-the-big-picture)
2. [The Tools We Use](#2-the-tools-we-use)
3. [Marketing Website — taxmitrafinance.com](#3-marketing-website)
4. [The 14 Calculators](#4-the-14-calculators)
5. [The Blog System](#5-the-blog-system)
6. [SEO — Why Your Site Can Be Found on Google](#6-seo-work)
7. [Client Portal — app.taxmitrafinance.com](#7-client-portal)
8. [Portal Build, Session by Session](#8-portal-build-sessions)
9. [PWA — Install as Mobile App](#9-pwa)
10. [How You (Admin) Use the System Daily](#10-admin-daily-workflows)
11. [How Your Clients Use It](#11-client-experience)
12. [Maintenance & Things to Watch](#12-maintenance)
13. [What to Do If Something Breaks](#13-troubleshooting)
14. [Future Improvements](#14-future-improvements)
15. [Glossary of Terms](#15-glossary)

---

## 1. The Big Picture

You now own **three connected systems**:

### A. Marketing Website
**Address:** `taxmitrafinance.com`
**Purpose:** Attracts new clients. Shows your services, calculators, blog articles.
**Who sees it:** The general public + anyone Googling tax topics.
**Think of it like:** Your shop window on the main road.

### B. Client Portal
**Address:** `app.taxmitrafinance.com`
**Purpose:** Where existing clients log in to upload documents and track their tax filings. Where you (admin) manage everything.
**Who sees it:** Only logged-in users.
**Think of it like:** The back office where actual work happens.

### C. Blog
**Address:** `blog.taxmitrafinance.com`
**Purpose:** Where you write articles using Hashnode (a free blogging platform).
**Who sees it:** Public, but most readers will see your articles on `taxmitrafinance.com` (we copy them there for SEO).
**Think of it like:** Your writing journal that automatically gets republished on your main site.

**Visual map:**

```
       Public visitors                  Existing clients
              │                                 │
              ▼                                 ▼
   taxmitrafinance.com               app.taxmitrafinance.com
   (marketing + calculators)            (login + documents)
              │                                 │
              │                                 │
              └─────── connected by ───────────┘
                "Client Login" button
                  in the top nav
```

---

## 2. The Tools We Use

Each of these is a separate service. Think of them like the contractors building your house — each does one specific job.

### 2.1 GitHub
**What it is:** A website that stores your code/files in the cloud. Free.
**Why:** So your files exist somewhere other than just your laptop. If your laptop dies, nothing is lost.
**Account:** `caswapnilssoni-create`
**You own two repos (folders) on GitHub:**
- `fintech-website` — the marketing site
- `taxmitra-portal` — the client portal

**Analogy:** It's like Google Drive, but specifically for code, with extra features like change history.

### 2.2 GitHub Desktop
**What it is:** An app on your computer that talks to GitHub.
**Why:** It lets you "save" your file changes from your laptop to GitHub with a button click. You don't have to use command-line tools.
**Where on your PC:** Installed via `desktop.github.com`.

**Analogy:** It's the courier that takes your work from your desk and delivers it to the warehouse (GitHub).

### 2.3 GitHub Pages
**What it is:** A free hosting service from GitHub that turns any HTML files in your repo into a live website.
**Why:** We use it for the marketing site. Anytime you push changes to the `fintech-website` repo, the new version goes live at `taxmitrafinance.com` in about 30 seconds.
**Cost:** Free, forever.

**Analogy:** GitHub stores your files, GitHub Pages turns them into a public webpage anyone can visit.

### 2.4 Vercel
**What it is:** A hosting service for modern web apps. Free for hobby use.
**Why:** We use it for the client portal. The portal isn't simple HTML — it's a Next.js app that needs special server features (login, etc.). Vercel handles all that.
**Cost:** Free until you have thousands of users or high traffic.
**Connected to:** Your GitHub. When you push to `taxmitra-portal`, Vercel rebuilds and redeploys automatically.

**Analogy:** GitHub Pages is great for a static shop window. Vercel is needed for a real working office.

### 2.5 Supabase
**What it is:** A database + login system + file storage, all in one. Free tier covers small businesses.
**Why:** The portal needs to remember who's logged in, store client documents, track filing statuses. Supabase is the brain that remembers everything.
**Region:** Mumbai (so it's fast for Indian users).
**Cost:** Free until ~500 active clients.

**What's inside Supabase:**
- **Auth** — stores who has signed up (emails + passwords)
- **Database** — tables for clients, filings, documents, notifications, admins
- **Storage** — keeps the actual document files (PDFs, JPGs) uploaded by clients

**Analogy:** A combined filing cabinet (database) + receptionist (auth) + secure storage room (storage).

### 2.6 Resend
**What it is:** A service that sends emails on behalf of your portal.
**Why:** When a client's filing status changes (e.g., "Filed"), Resend automatically sends them an email.
**Cost:** Free for 3,000 emails per month — plenty for hundreds of clients.

**Analogy:** A virtual postman who sends letters when instructed by your portal.

### 2.7 Hashnode
**What it is:** A free blogging platform. You write blog posts there in a nice editor.
**Why:** Easier than writing HTML by hand. You write in Hashnode, then we copy the content to your main site for SEO benefits.
**Address:** `blog.taxmitrafinance.com`

**Analogy:** Your typewriter. The blog posts you create here can be reused on your main site.

### 2.8 Namecheap
**What it is:** Where you bought the domain `taxmitrafinance.com`.
**Why:** They control which servers your domain points to (DNS).
**Cost:** ~₹1,000/year for the domain.

**Analogy:** Like the post office assigning a postal address to a building. They tell the internet where to find your sites.

### 2.9 Google Search Console
**What it is:** A free tool from Google.
**Why:** Tells you how Google sees your site, what people search for to find you, and lets you submit your sitemap so Google indexes faster.
**Address:** `search.google.com/search-console`

**Analogy:** Your SEO dashboard. Like having a window into how Google views your site.

### 2.10 Cowork (Claude)
**What it is:** The AI assistant (me) you've been working with.
**Why:** I help write code, plan features, fix bugs, and explain things.

---

## 3. Marketing Website

### What it is
A traditional website at `taxmitrafinance.com`. It's a single HTML file with multiple "pages" inside (called Single Page Application or SPA). Plus 18 separate sub-pages for calculators, blog articles, FAQ, etc.

### What pages it has

**Main pages (inside the SPA `/`):**
- Home — hero, services overview, testimonials, blog preview
- Services — full list of services offered
- About — company info
- Blog — list of all blog articles
- Due Dates — tax compliance calendar
- Calculators — grid of all 14 calculators
- Investments — wealth services
- Contact — appointment booking form

**Standalone sub-pages (each its own URL for SEO):**
- `/income-tax-calculator/`
- `/gst-calculator/`
- `/emi-calculator/`
- `/sip-calculator/`
- `/ppf-calculator/`
- `/hra-calculator/`
- `/nps-calculator/`
- `/fd-calculator/`
- `/salary-calculator/`
- `/epf-calculator/`
- `/home-loan-emi-calculator/`
- `/compound-interest-calculator/`
- `/capital-gains-calculator/` (you added later)
- `/tds-property-calculator/` (you added later)
- `/calculators/` — hub showing all calculators
- `/blog/{article-slug}.html` — each blog post
- `/checklists/` — compliance checklists
- `/faq/` — frequently asked questions

### How it's built

Everything is **plain HTML + CSS + JavaScript** in one big folder (`fintech-website` repo). No fancy frameworks. The advantage: it's fast, simple, and runs anywhere.

### How changes happen

1. You (or I) edit a file on your laptop (e.g., `index.html`).
2. You open GitHub Desktop → you see the file is changed.
3. You write a short message describing what changed (called a "commit message").
4. Click **Commit to main** → click **Push origin**.
5. GitHub Pages detects the change and re-publishes the site in ~30 seconds.

**This means:** Every time you commit + push, your changes are live on the internet within a minute.

### Important features we built

| Feature | What it does |
|---|---|
| Hash routing | URL changes when you click nav items (e.g., `#calculators`). Lets users share direct links to a section. |
| Sticky banner | The ITR Filing reminder banner at the top |
| Mobile menu | Hamburger menu on phones |
| Newsletter signup | Form connected to Formspree (handles emails) |
| Animated counters | Numbers that count up when you scroll into view |
| Reveal animations | Cards fade in as you scroll |
| Live chatbot | Simple Q&A bot |
| ITR popup | The "File Your ITR" banner that pops up |
| Client Login button | 4 places: top nav, mobile menu, footer Quick Links, Contact page |

---

## 4. The 14 Calculators

Each calculator is a standalone page at its own URL. Why? **SEO.** When someone Googles "income tax calculator FY 2025-26", Google can only rank a page that exists at its own URL.

### The 14 calculators

| # | URL | What it computes |
|---|---|---|
| 1 | `/income-tax-calculator/` | Old vs New regime tax for FY 2025-26 |
| 2 | `/gst-calculator/` | Add or extract GST (5/12/18/28%) |
| 3 | `/emi-calculator/` | Generic EMI for any loan |
| 4 | `/home-loan-emi-calculator/` | EMI + tax benefit under 80C and Section 24(b) |
| 5 | `/sip-calculator/` | Mutual fund SIP returns |
| 6 | `/ppf-calculator/` | Public Provident Fund maturity |
| 7 | `/hra-calculator/` | House Rent Allowance exemption |
| 8 | `/nps-calculator/` | National Pension System corpus + monthly pension |
| 9 | `/fd-calculator/` | Fixed Deposit maturity |
| 10 | `/epf-calculator/` | EPF retirement corpus |
| 11 | `/salary-calculator/` | CTC → in-hand salary |
| 12 | `/compound-interest-calculator/` | Generic compound interest |
| 13 | `/capital-gains-calculator/` | Capital gains tax (you added) |
| 14 | `/tds-property-calculator/` | TDS on property purchase (you added) |

Plus a **hub page** at `/calculators/` showing all of them in a nice card grid.

### What's in each calculator page

Every standalone calculator page has:
- A unique SEO-optimized **title** (e.g., "Income Tax Calculator India FY 2025-26 — Old vs New Regime")
- A **meta description** (the text Google shows in search results)
- **Structured data** (JSON-LD with WebApplication, BreadcrumbList, FAQPage schemas — helps Google understand and display rich results)
- **The calculator UI** (input fields, calculate button, results)
- **Educational content** (how it works, examples, tax rules)
- **6-8 FAQs** (helps with long-tail SEO and rich snippets)
- **Cross-links to other calculators**
- **A call-to-action** (Book a CA, View related blog article)
- **Breadcrumb navigation** (Home › Calculators › Income Tax Calculator)
- **Nav with 🔐 Login link** to the portal

### How the math works

All calculations happen **in your browser** (using JavaScript). Nothing is sent to any server. This means:
- Lightning fast (no waiting for a server response)
- Private (you don't see what people calculate)
- Works offline once visited (thanks to the PWA service worker)

The shared calculator logic lives in `/assets/calc.js`.

---

## 5. The Blog System

### How it works (step by step)

**Old way:** You'd write a blog on Hashnode. To show it on your main site, you'd manually copy the HTML — slow and error-prone.

**Our way:**
1. You write a blog post in **Hashnode** (e.g., "TDS on House Purchase").
2. In Hashnode, click **"..." menu → Export as Markdown**. A `.md` file downloads.
3. Open the `.md` file. Edit the first few lines (called "frontmatter") to add the title, date, category, etc.
4. Drop the file into the `content/blog/` folder of `fintech-website` on your computer.
5. Commit + Push via GitHub Desktop.
6. A **GitHub Action** (an automated robot) runs the `build-blog.mjs` script.
7. The script reads all `.md` files, converts them to HTML, and creates a page at `/blog/<slug>.html`.
8. It also updates `data/blogs.json` (the list shown on the homepage and blog page).
9. It also updates `sitemap.xml` (so Google knows about the new article).

**Total time from writing → live:** ~2 minutes.

### Current blog posts

| Article | URL slug |
|---|---|
| New Tax Regime vs Old Tax Regime (FY 2025-26) | `new-tax-regime-vs-old-tax-regime-which-is-better-in-fy-2025-26` |
| Private Limited vs LLP for Startups | `private-limited-vs-llp-which-business-structure-is-right-for-your-startup-in-india` |
| TDS on House Purchase (Section 194-IA) | `tds-on-house-purchase-in-india-complete-guide` |
| Income Tax Slab Rates FY 2025-26 | `income-tax-slab-rates-fy-2025-26` |

### What each blog page automatically has

- SEO-optimized title and description
- **BlogPosting** schema (for Google rich results)
- **BreadcrumbList** schema (shows nav path in search results)
- **FAQPage** schema (if the article has Q&A — like the TDS article)
- Visual breadcrumb at top (`Home › Blog › Income Tax › Article Title`)
- "Related Articles" section at the bottom (2-3 similar articles)
- "Book Free Consultation" CTA box
- "Originally published on blog.taxmitrafinance.com" link (for canonical SEO)
- Mobile-friendly responsive design

### How to write a new blog post

1. Go to Hashnode (`hashnode.com`) → log in.
2. Click **"Write"** button. Write your article normally.
3. Set the cover image, title, slug, tags.
4. Click **Publish**.
5. Click the "..." menu on the published post → **Export as Markdown**. A `.md` file downloads.
6. Open the `.md` file in Notepad or VS Code.
7. The top of the file has a section that starts and ends with `---`. Make sure these fields are filled:
   ```
   ---
   title: "Your Article Title"
   slug: your-article-slug-from-hashnode
   date: 2026-MM-DD
   excerpt: Short summary shown on the blog list.
   category: Income Tax  (or GST, Startup & Company Law, etc.)
   icon: 📰  (or any emoji that fits)
   readTime: 6  (estimated minutes)
   hashnodeUrl: https://blog.taxmitrafinance.com/your-slug
   tags: [tag1, tag2]
   ---
   ```
8. Save the file.
9. Open Windows Explorer → go to `C:\Users\USER\Documents\GitHub\fintech-website\content\blog\`
10. Drop the `.md` file there.
11. Open GitHub Desktop → you'll see the file as a change.
12. Summary: `blog: <short title>`
13. Click **Commit to main** → **Push origin**.
14. Wait ~60 seconds. Your article is live at `taxmitrafinance.com/blog/your-slug.html`.

---

## 6. SEO Work

SEO = Search Engine Optimization. It's how Google decides which sites to show on top when someone searches.

### What we did for your site

**1. Sitemap (`sitemap.xml`)**
A list of every page on your site, given to Google. Auto-updates when you publish a new blog or we add a new calculator. Submitted via Google Search Console.

**2. Robots.txt**
Tells Google "yes, please index everything". Lives at `taxmitrafinance.com/robots.txt`.

**3. Meta tags on every page**
- `<title>` — what shows on the browser tab and in Google results
- `<meta description>` — the short text in Google results
- Open Graph tags (`og:title`, `og:image`) — for nice previews when shared on WhatsApp/LinkedIn
- Twitter Card tags — for previews on Twitter

**4. Structured data (JSON-LD)**
Hidden JSON code on each page that tells Google extra info. We use:
- **AccountingService** — tells Google you're a CA firm in India
- **WebApplication** — tells Google each calculator is a tool
- **BreadcrumbList** — shows navigation path in search results
- **FAQPage** — makes FAQ accordion show in Google results
- **BlogPosting** — for blog articles

**5. Internal linking**
Every calculator links to other calculators. Every blog links to related blogs. This helps Google understand topic clusters.

**6. Canonical URLs**
Each page declares its "official" URL so Google doesn't get confused by duplicates.

**7. Mobile responsive**
Google ranks mobile-friendly sites higher. Everything we built works perfectly on phones.

**8. Fast loading**
Static HTML + minimal JS = pages load in under 1 second.

**9. HTTPS**
All sites served over secure HTTPS (automatic from GitHub Pages and Vercel).

### What you should do (off-page SEO)

Google doesn't only look at your site — it also looks at *other* sites that link to yours. This is called "backlinks". Right now you have ~0. Some ways to get them:

- **Answer 5 questions on Quora** per week about tax topics. End each answer with a link to your calculator.
- **Google Business Profile** — claim your business listing. Adds you to Google Maps and local search.
- **List on directories** — Justdial, Sulekha, IndiaMART (free).
- **Reddit** (r/IndiaTax, r/personalfinanceindia) — answer questions, link when helpful.
- **Guest blog** — write for other finance blogs in exchange for a backlink.

---

## 7. Client Portal

### What it is

A separate web application at `app.taxmitrafinance.com`. It looks different from the marketing site because it's built with **Next.js** (a React framework). It's hosted on **Vercel** and uses **Supabase** for data.

### Why a separate site?

- **Different purpose:** Marketing site is for the public to discover you. Portal is for paying clients to manage their work.
- **Different technology:** Portal needs login, database, secure file storage. Marketing site doesn't.
- **Different hosting:** Marketing site is free static hosting (GitHub Pages). Portal needs a server-capable host (Vercel).
- **Cleaner experience:** Clients see a focused dashboard, not your marketing pages.

### Tech stack (so you know what each piece does)

| Layer | Tool | What it does |
|---|---|---|
| Frontend | **Next.js 14 (React)** | Makes the screens |
| Styling | **Tailwind CSS** | Pre-made styling shortcuts |
| Hosting | **Vercel** | Runs the app on the internet |
| Database | **Supabase Postgres** | Stores clients, filings, documents metadata |
| Authentication | **Supabase Auth** | Handles signup, login, password reset |
| File storage | **Supabase Storage** | Stores uploaded PDFs/images |
| Email | **Resend** | Sends notification emails |
| Code repo | **GitHub** (`taxmitra-portal`) | Stores all the code |

### The database tables (the brain)

| Table | What it stores |
|---|---|
| `clients` | Each client's name, phone, PAN, GST, address |
| `admins` | Who has admin access (you) |
| `filings` | Each filing engagement (ITR/GST/etc.) per client per year, with current status |
| `documents` | List of uploaded files (Form 16, Form 26AS, etc.) |
| `status_history` | Audit log: every time a filing status changed, when, by whom |
| `notifications` | In-portal notifications shown via the 🔔 bell |

### How data is protected

Supabase has a feature called **Row-Level Security (RLS)**. Even though all client data is in one big database, RLS rules ensure:
- Clients can only see their own data
- Even if a bug exists, Supabase refuses to leak one client's data to another
- Admins can see all data (because we marked you as `super_admin`)

This is enforced at the database level, not just in our code, so it's super secure.

### File storage

When a client uploads a Form 16:
1. The file is saved at `documents/{client-id}/{random-uuid}.pdf` in Supabase Storage.
2. Each client has their own private "folder".
3. Files can only be downloaded via "signed URLs" that expire after 1 hour.
4. Even if someone guesses another client's file path, Supabase rejects the request.

---

## 8. Portal Build Sessions

We built the portal across 6 sessions. Each session added one major capability. Here's what each one did and the files involved.

### Session 1 — Setup
**What it did:** Created the empty shell. The portal landing page existed but had no real features.
**Key files:**
- `package.json` — list of dependencies
- `next.config.js`, `tsconfig.json`, `tailwind.config.ts` — project configuration
- `src/lib/supabase/client.ts`, `server.ts` — helpers to talk to Supabase
- `supabase/migrations/001_init_schema.sql` — created all 6 database tables with RLS policies
- `src/app/layout.tsx`, `globals.css` — base layout & styles
- `src/app/page.tsx` — landing page with "Login" and "Create Account" buttons
- `src/app/health/page.tsx` — page that says "everything works" or "something broken"

**What you did:** Created Supabase + Vercel accounts. Ran the SQL in Supabase. Set up DNS subdomain in Namecheap. Connected the GitHub repo to Vercel.

### Session 2 — Real Authentication
**What it added:** Working signup, login, password reset, route protection.
**Key files:**
- `src/middleware.ts` — runs on every request, protects `/dashboard` and `/admin` from unauthorized users
- `src/app/signup/page.tsx` — signup form (email + password + name)
- `src/app/login/page.tsx` — login form
- `src/app/forgot-password/page.tsx` — request reset email
- `src/app/reset-password/page.tsx` — set new password from email link
- `src/app/auth/callback/route.ts` — handles email verification clicks
- `src/app/auth/signout/route.ts` — logout
- `src/app/dashboard/layout.tsx` — dashboard wrapper with top nav
- `src/app/dashboard/page.tsx` — dashboard home
- `src/app/dashboard/profile/page.tsx`, `profile-form.tsx` — profile editor

**What you did:** Set Site URL in Supabase. Signed up your first account. Made yourself admin via SQL.

### Session 3 — Document Upload
**What it added:** Drag-and-drop document upload with 10 categories, download via signed URLs, delete.
**Key files:**
- `src/app/dashboard/documents/page.tsx` — documents page
- `src/app/dashboard/documents/upload-zone.tsx` — drag-drop UI + upload logic
- `src/app/dashboard/documents/documents-list.tsx` — list with download/delete

### Session 4 — Admin Panel
**What it added:** Your CA workspace — manage all clients, create filings, advance status, send docs back to clients.
**Key files:**
- `src/app/admin/layout.tsx` — admin layout (dark navy header, admin-only)
- `src/app/admin/page.tsx` — overview with stats
- `src/app/admin/clients/page.tsx` — searchable clients list
- `src/app/admin/clients/[id]/page.tsx` — client detail page
- `src/app/admin/clients/[id]/client-actions.tsx` — Filings/Documents/Notes tabs

**Issue we fixed:** RLS infinite recursion. The `admins` table policy was calling itself. Fixed by simplifying the policy.

### Session 5 — Email Notifications
**What it added:** Automatic emails when filing status changes or you upload a doc to a client. Plus a 🔔 notification bell.
**Key files:**
- `src/lib/email/resend.ts` — Resend client wrapper
- `src/lib/email/templates.ts` — beautiful HTML email templates
- `src/app/api/notify/route.ts` — server endpoint that sends emails
- `src/app/dashboard/notification-bell.tsx` — 🔔 bell with unread badge

**What you did:** Signed up for Resend, got API key, added it to Vercel env vars.

### Session 6 — PWA (Install as App)
**What it added:** Both the marketing site and portal can be installed to phone home screen.
**Key files (portal):**
- `public/manifest.json` — app metadata
- `public/icon.svg` — app icon (TM monogram)
- `public/sw.js` — service worker (enables install + offline)
- `public/offline.html` — offline fallback page
- `src/app/pwa-init.tsx` — registers service worker + shows install banner
- `src/app/layout.tsx` — added manifest link + iOS meta tags

**Marketing site got similar treatment** (same 5 files in `fintech-website/`).

---

## 9. PWA

**PWA = Progressive Web App.** It's a normal website that browsers can install like a native app.

### What clients see

**Android (Chrome):**
1. Visit `app.taxmitrafinance.com`.
2. After 5-10 seconds, a banner pops up at the bottom: "📲 Install TaxMitra Portal".
3. Tap **Install**.
4. App icon appears on home screen.
5. Tap icon → app opens full-screen, no browser bar.

**iPhone (Safari):**
1. Visit `app.taxmitrafinance.com`.
2. Tap **Share** button → **Add to Home Screen**.
3. App icon appears on home screen.
4. Tap icon → full-screen app.

**Desktop (Chrome/Edge):**
1. Visit the site.
2. Small "install" icon in the URL bar → click it.
3. Or wait for the banner.
4. App opens in its own window.

### What apps users get on their phone

| Icon | What it is | Where it opens |
|---|---|---|
| "TaxMitra" | Marketing site app | Calculators + blog + services |
| "TaxMitra Portal" | Client portal app | Login + documents + filings |

These are **two separate apps** because they're on different subdomains. Users can install both.

### App shortcuts (Android)

Long-press the **TaxMitra** marketing app icon → see shortcut menu:
- Income Tax Calculator
- GST Calculator
- EMI Calculator
- Client Login

---

## 10. Admin Daily Workflows

### Onboarding a new client (5 minutes)

**Option A — client signs up themselves:**
1. Tell them: "Go to `app.taxmitrafinance.com/signup`. Use your real email. Pick a password."
2. They sign up → get verification email → click link.
3. They log in. They see "Welcome to your portal" with no filings yet.
4. **You** go to `/admin/clients` → find them in the list (newest first) → click **Open**.
5. **Filings tab** → Create filing for the service they're paying for (e.g., "ITR Filing FY 2025-26").
6. They'll get an email saying their filing has been created.

**Option B — you create the account for them** (advanced — Supabase Dashboard → Authentication → Users → Add user, then email them the password).

### Advancing a filing through the year

Let's say a client signed up for ITR filing.

| Time | Action | What client sees |
|---|---|---|
| Day 1 | You create filing | Status: "Documents Requested" |
| Day 2 | Client uploads Form 16 + Form 26AS | (You see them in admin → Documents tab) |
| Day 3 | You click "→ Documents Received" | Email: "Documents Received ✓" |
| Day 5 | You click "→ Under Review" | Email: "Our team is reviewing your documents" |
| Day 7 | You click "→ Computing Tax" | Email: "Computing your tax" |
| Day 8 | You file the actual ITR on incometax.gov.in | (External to portal) |
| Day 8 | You upload the ITR acknowledgement to portal via Documents tab → Send to client | Email: "Your CA shared a document" + "Filed Successfully" status |
| Day 8 | You click "→ Ack Sent" | Email: "Acknowledgement available" |
| Day 30+ | When refund processed by IT Dept | Click "→ Refund Pending" + set refund amount |
| Day X | Refund credited to their bank | Click "→ Refund Credited" → Email: "Refund Credited 💰" |

Total emails sent during one ITR cycle: ~5. Client always knows where they stand. No "where's my ITR?" WhatsApp messages.

### Sending a document to a client

1. Admin → Clients → Open client → **Documents tab**.
2. Choose category (ITR Acknowledgement, Tax Computation, etc.).
3. Pick the file from your computer.
4. Click **Send to client**.
5. Client gets an email + in-portal notification with a download link.

### Internal notes about a client

Admin → Clients → Open client → **Notes tab**.
Write whatever you want. Only admins see this. Examples:
- "Prefers WhatsApp over phone"
- "Has 2 home loans"
- "Reminded about 80C investments — promised to invest by Feb"

---

## 11. Client Experience

### A typical client's journey

**1. Discovery (before they're a client)**
- They Google "income tax calculator FY 2025-26" → land on `taxmitrafinance.com/income-tax-calculator/`.
- They use the calculator. See the "Book Free Consultation" button.
- They click it → go to the Contact page → fill the form.

**2. First meeting**
- You consult with them. Onboard them as a paying client.

**3. Signup**
- You send them: "Go to `app.taxmitrafinance.com/signup`. Use your email. Pick a password. After signing up, I'll set up your filing."
- They sign up → verify email → log in.

**4. First filing**
- They see "Welcome" but no filings yet.
- You create their filing in admin.
- Now they see "Documents Requested" status.

**5. Upload documents**
- They click **Documents** → drag-drop their Form 16.
- They upload Form 26AS, bank statement, etc.
- Each upload shows in their list with category labels.

**6. Track progress**
- They get emails as you advance status.
- They can also open the app anytime → see the timeline.
- They get the 🔔 bell with unread notification count.

**7. Filed**
- You upload the ITR acknowledgement via admin.
- They get an email "Filed Successfully" + "Your CA shared a document".
- They download the acknowledgement from their portal.

**8. Refund tracking**
- You update status to "Refund Pending" with the expected amount.
- When refund hits their bank, you mark "Refund Credited".
- Done!

### What they can also do anytime

- Update their profile (PAN, GST number, address).
- Reset their password if they forget it.
- Download any document you've ever shared with them.
- See past filings (FY 2024-25, FY 2025-26, etc.).
- Install the app to their phone (PWA).

---

## 12. Maintenance

### What runs without your attention

| Service | What it does automatically |
|---|---|
| GitHub Pages | Auto-deploys marketing site on every push |
| Vercel | Auto-deploys portal on every push |
| Build blog GitHub Action | Auto-rebuilds blog HTML when you push a new `.md` file |
| Supabase backups | Free tier keeps 7 days of daily backups |
| Resend deliverability | Handles SPF/DKIM automatically |
| Vercel HTTPS | Auto-renews SSL certificates |

You don't need to do anything for the above to keep working.

### Things to check periodically

**Weekly (5 min):**
- Open Vercel → check that recent deploys are green ✅
- Open Resend dashboard → confirm emails are being delivered (not bouncing)

**Monthly (15 min):**
- Open Google Search Console → check what queries are bringing traffic, fix any errors
- Update blog with 1-2 new articles
- Check Supabase usage (Settings → Usage) → should be well under free-tier limits

**Quarterly (1 hour):**
- Review all tax slabs in calculators — if government changes anything, update
- Review status of all client filings — close out completed ones

### Costs to expect

| Service | Free until | Then |
|---|---|---|
| GitHub | Always free | — |
| GitHub Pages | Always free | — |
| Vercel | 100GB bandwidth/month | $20/month |
| Supabase | 500 MB DB, 1 GB storage, 50K users | $25/month |
| Resend | 3,000 emails/month | $20/month |
| Namecheap domain | ₹1,000/year | Same |
| **Total annual** | **₹1,000** (just the domain) | ₹50K+/year only if you hit serious scale |

You'll likely stay free for years. By the time you outgrow free, you'll have hundreds of clients paying you, so the $25/month is trivial.

---

## 13. Troubleshooting

### "Site is down" / "Vercel deploy failed"

1. Open Vercel → your project → **Deployments**.
2. Find the most recent deploy with a red ❌.
3. Click it → see the build log → look for "Error:" lines.
4. Common fixes:
   - Forgot to commit a file
   - Syntax error in code
   - Missing environment variable
5. Share the error with me — I'll patch it.

### "Emails aren't being sent"

1. Resend dashboard → **Emails** tab → see if attempts are listed.
2. If listed but "Bounced" → recipient email is invalid.
3. If not listed at all → check Vercel env var `RESEND_API_KEY` is set.
4. Check Vercel function logs for `[email]` errors.

### "I can't log in to the portal"

- Try **Forgot Password** → check your inbox (and spam) for the reset email.
- If the reset email doesn't come, check Supabase Dashboard → Authentication → Users → confirm your account exists.
- If your account doesn't exist, sign up fresh.

### "Client says they can't see Admin link"

- They shouldn't see Admin link — only you do. (Working as designed.)

### "I made changes but the site doesn't show them"

- Check GitHub Desktop — did you click both **Commit to main** AND **Push origin**?
- Hard-refresh your browser (Ctrl+Shift+R) to bypass cache.
- Wait 2 minutes — GitHub Pages can take time to redeploy.

### "A calculator is showing wrong numbers"

- The calculator math is in `assets/calc.js`.
- Send me the specific inputs + expected output vs actual output.

### "Sitemap not being updated for new blog posts"

- Check the GitHub Action for `Build blog from Markdown`. It should run automatically when you push a `.md` file.
- Vercel → Actions → look at the latest run → check logs.

---

## 14. Future Improvements

These aren't built yet but possible whenever you want:

### Easy wins (1-2 sessions each)
- **Verify Resend domain** → emails come from `noreply@taxmitrafinance.com` instead of `onboarding@resend.dev`.
- **Welcome email** on signup (currently Supabase just sends the verification email; add a personal welcome).
- **WhatsApp Click-to-Chat** button on every page.
- **Google Reviews widget** showing live reviews.
- **More calculators**: HSN code finder, Rent Receipt generator, IFSC search.

### Medium effort (3-5 sessions)
- **Appointment booking** in portal (instead of just a contact form).
- **Razorpay payment integration** for invoices.
- **WhatsApp notifications** (Gupshup or Twilio — paid).
- **Multi-staff support**: if you hire associates, give them limited admin access.
- **Bulk client import** from Excel/CSV.

### Big projects (1-2 weeks)
- **Native mobile apps** (iOS + Android) via Capacitor or React Native, wrapping the existing portal.
- **E-signature** on engagement letters (DocuSign or open-source alternative).
- **Integration with Tally / Zoho Books** for accounting sync.
- **AI-powered tax planning suggestions** (analyze a client's last 3 years of returns + suggest optimizations).

---

## 15. Glossary

| Term | Plain English |
|---|---|
| **API** | A way for two computer programs to talk to each other. Like a waiter who takes your order to the kitchen. |
| **API Key** | A password that lets one program access another. Like a key card for a building. Never share it publicly. |
| **Auth / Authentication** | The process of verifying who someone is (usually email + password). |
| **Backend** | The server-side parts of an app — database, logic. The kitchen, not the dining room. |
| **Browser cache** | When your browser saves a copy of a page for speed. Sometimes this means you see an old version even after we update the site. Press Ctrl+Shift+R to force-refresh. |
| **CSS** | The styling language for websites. Controls colors, fonts, spacing. |
| **Cookie** | A small file your browser stores. Used to remember you're logged in. |
| **CTC** | Cost to Company — total annual cost the employer bears for an employee. |
| **Database** | A structured storage system for data — like a giant spreadsheet but more powerful. |
| **Deployment** | The act of pushing your code to a server so it goes live. |
| **DNS** | Domain Name System — translates `taxmitrafinance.com` to an IP address. The internet's phone book. |
| **Domain** | The address users type to reach your site (e.g., `taxmitrafinance.com`). |
| **Email verification** | A common signup step: user gets an email, clicks a link to confirm the email is real. |
| **Environment variable** | A secret value (like an API key) that lives on the server, not in your code. Set in Vercel's "Environment Variables" page. |
| **Form 16** | TDS certificate from your employer. Shows salary + tax deducted. |
| **Frontend** | The user-facing parts of an app — what users see and click. |
| **Frontmatter** | The metadata block at the top of a Markdown file (between `---` lines). Contains title, date, etc. |
| **GitHub Action** | A robot script that runs automatically when something happens (like pushing code). |
| **HTML** | The structural language for websites. Defines what content is on the page. |
| **HTTPS** | The secure version of HTTP (the web protocol). Encrypts data between your browser and the server. |
| **Incognito mode** | A browser mode that doesn't save cookies/cache. Useful for testing as a fresh visitor. |
| **JavaScript** | The programming language that runs in browsers. Makes pages interactive. |
| **JSON** | A simple text format for storing data. Looks like `{"name": "TaxMitra", "year": 2026}`. |
| **JSON-LD** | A way to add structured data to a webpage so Google understands it better. |
| **Markdown** | A simple text format with light formatting (e.g., `# Heading`, `**bold**`). Easier than HTML. |
| **Manifest (PWA)** | A JSON file describing an installable web app. |
| **Meta tags** | Hidden HTML tags that describe the page (title, description). Used by Google and social media for previews. |
| **Middleware** | Code that runs before each request reaches the page. Used for things like checking login status. |
| **Next.js** | A React framework. We use it for the portal. |
| **Push** | The act of sending your local commits to GitHub. |
| **PWA** | Progressive Web App. A website that can be installed like a regular app. |
| **React** | A JavaScript library for building user interfaces. Used by Next.js. |
| **Repo / Repository** | A folder of code stored on GitHub. We have two: `fintech-website` and `taxmitra-portal`. |
| **RLS** | Row-Level Security. A database feature that controls which rows each user can see. |
| **Schema** | The structure of data — what tables exist, what columns each has. Or, in SEO context, structured data telling Google about page content. |
| **Service worker** | A small script that runs in the background of the browser. Enables PWA installability and offline mode. |
| **Session** | The period between a user logging in and logging out. Tracked via cookies. |
| **Sitemap** | A list of all pages on your site, given to Google. |
| **SPA** | Single Page Application. A website that loads one HTML file and uses JavaScript to swap content. Our marketing site's homepage is an SPA. |
| **SQL** | The language used to query databases. We use it to talk to Supabase. |
| **SSL Certificate** | The security thing behind HTTPS. Auto-managed by Vercel and GitHub Pages. |
| **Supabase** | An all-in-one backend service. Postgres database + Auth + Storage. |
| **Tailwind** | A CSS framework with pre-made utility classes. We use it in the portal. |
| **Tab** / **Window** | Self-explanatory but important: opening links in a new tab means users keep your site open. |
| **TypeScript** | A version of JavaScript with type checking. We use it in the portal for fewer bugs. |
| **UUID** | A long random ID like `8826b8fe-3953-4753-a754-fef1543c3db1`. Used to uniquely identify users, documents, etc. |
| **Vercel** | A hosting service for modern web apps. Hosts our portal. |
| **Webhook** | A way for one service to notify another when something happens. |

---

## Need help?

If anything breaks, doesn't make sense, or you want to add a feature — just message me. Bring:
- A description of what you're trying to do
- A screenshot if it's a visual issue
- The error message if there is one

I have full memory of what we built and can fix things quickly.

---

**End of guide.**
*Last updated: May 2026 · Prepared for CA Swapnil Soni, TaxMitra · Reach out anytime.*
