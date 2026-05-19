# TaxMitra Client Portal — MVP Plan

A secure web portal where TaxMitra clients can log in, upload their tax documents, and track their ITR/GST filing status. With an admin panel for CA Swapnil Soni (and team) to manage everything.

**Scope of this document:** the MVP only — Login + Document Upload + Status Tracker + Admin Panel. Appointments, payments, and WhatsApp notifications are NOT in scope and will be planned separately later.

---

## 1. Executive Summary

| Item | Detail |
|---|---|
| What we're building | A web app at `app.taxmitrafinance.com` for client login + documents + status tracking |
| Tech stack | Next.js (React) frontend + Supabase (DB, auth, file storage) + Vercel (hosting) |
| Monthly cost | **₹0** until you exceed free-tier limits (~500 active clients) |
| Build time | ~4–5 focused sessions to MVP launch |
| Maintenance | Mostly hands-off — Vercel auto-deploys, Supabase manages DB backups |
| Risk if abandoned mid-build | Low — none of this changes the existing `taxmitrafinance.com` marketing site |

---

## 2. Architecture

```
                    User's Browser
                          │
                          ▼
            app.taxmitrafinance.com
              (Next.js app on Vercel)
                          │
                          ▼
                     Supabase
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
    PostgreSQL          Auth          Storage (S3-compatible)
    (clients,          (signup,        (uploaded documents
     filings,           login,          per client, private)
     statuses,          password
     uploads             reset)
     metadata)
```

**Why this stack:**

- **Next.js** — most popular React framework, great Vercel integration, free deploy from GitHub.
- **Supabase** — open-source Firebase alternative. PostgreSQL (not weird NoSQL). Built-in auth + RLS (Row-Level Security) means clients can ONLY see their own data — enforced at the database, not just app code. Critical for a CA portal.
- **Vercel** — zero-config deploys from GitHub. Custom domain support free.

**Why not WordPress / no-code:** WordPress requires hosting + maintenance + plugins (paid eventually). No-code tools (Bubble, Softr) have monthly fees that add up; harder to customize; vendor lock-in. Custom build is the cheapest long-term.

---

## 3. User Roles

| Role | Who | Can do |
|---|---|---|
| **Client** | Your customers (salaried, businesses, etc.) | Sign up, log in, upload documents, view their own filing status, download their filed ITR/acknowledgements |
| **Admin** | CA Swapnil Soni (you) | View all clients, view their documents, update filing status, mark documents as received, upload return acknowledgements back to client |
| **Staff** *(future)* | Associates / juniors you hire | Limited admin — assigned clients only |

For MVP: just **Client** and **Admin**. Staff role can be added later.

---

## 4. Database Schema (Supabase / PostgreSQL)

Six tables. All have `created_at` and `updated_at` timestamps automatically.

### `clients` (extends Supabase's `auth.users`)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Same as `auth.users.id` |
| `full_name` | text | "Rahul Sharma" |
| `phone` | text | +91 98… |
| `pan` | text | Optional; encrypted column |
| `gst_number` | text | Optional |
| `client_type` | enum | `salaried` / `business` / `professional` / `nri` |
| `notes` | text | Admin notes (not visible to client) |

### `filings`

Each row = one ITR or GST filing engagement for one client per FY.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `client_id` | uuid (FK → clients.id) | |
| `service_type` | enum | `itr_filing` / `gst_filing` / `company_registration` / `other` |
| `financial_year` | text | "2025-26" |
| `status` | enum | See section 5 |
| `tracker_data` | jsonb | Stage timestamps (when status changed) |
| `assigned_to` | uuid | Future: which staff member |

### `documents`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `filing_id` | uuid (FK → filings.id) | |
| `client_id` | uuid (FK → clients.id) | denormalized for fast RLS |
| `category` | enum | `form_16` / `form_26as` / `bank_statement` / `salary_slip` / `investment_proof` / `pan_card` / `aadhaar` / `business_invoice` / `gst_return` / `itr_ack` / `other` |
| `file_path` | text | Supabase Storage path |
| `original_filename` | text | "Form16_FY2025-26.pdf" |
| `file_size_bytes` | bigint | |
| `mime_type` | text | application/pdf, image/jpeg etc. |
| `uploaded_by` | uuid | client or admin |
| `is_admin_upload` | boolean | True when admin uploads (e.g. ITR acknowledgement back to client) |

### `status_history`

Append-only log of every status change for audit purposes.

| Column | Type |
|---|---|
| `filing_id` | uuid (FK) |
| `from_status` | enum |
| `to_status` | enum |
| `changed_by` | uuid |
| `note` | text |

### `notifications` *(simple inbox)*

| Column | Type |
|---|---|
| `client_id` | uuid (FK) |
| `title` | text |
| `body` | text |
| `read` | boolean |
| `link` | text (optional) |

### `admins`

| Column | Type |
|---|---|
| `user_id` | uuid (PK, FK to auth.users) |
| `name` | text |
| `role` | enum (`super_admin` / `staff`) |

**Row-Level Security (RLS) — critical:**

- Clients can `SELECT/UPDATE` only rows where `client_id = auth.uid()`.
- Admins can `SELECT/UPDATE` all rows.
- File storage paths follow the pattern `documents/{client_id}/{uuid}.pdf` — Supabase's storage policies restrict reads to matching `auth.uid()` or admin role.

This means: even if a client guesses another client's document URL, Supabase refuses access at the storage layer. No app-level bug can leak data.

---

## 5. Filing Status Stages (the tracker)

Visual timeline shown on client dashboard:

```
[1] Documents Requested   →  [2] Documents Received  →  [3] Under Review
                                                              ↓
[6] Acknowledgement Sent  ←  [5] Filed Successfully   ←  [4] Computing Tax
       ↓
[7] Refund Pending  →  [8] Refund Credited        (if applicable)
```

| Status | What client sees | What admin does to advance |
|---|---|---|
| `documents_requested` | "Please upload your Form 16, Form 26AS, bank statements" | Auto-set when filing is created |
| `documents_received` | "We've received your documents — beginning review" | Click "Mark received" after verifying upload |
| `under_review` | "Our CA team is reviewing your tax documents" | Click "Start review" |
| `computing_tax` | "Computing your tax liability — Old vs New regime" | Click "Computing" |
| `filed` | "Your ITR has been filed. ITR-V/Acknowledgement attached." | Upload acknowledgement, click "Mark filed" |
| `ack_sent` | "Acknowledgement sent to your registered email" | Email auto-sent |
| `refund_pending` | "Refund of ₹X expected. We're tracking with the IT Department." | Set refund amount |
| `refund_credited` | "Refund of ₹X has been credited to your bank account" | Final stage |

Each stage transition writes to `status_history` for audit. Each transition can be optionally emailed to the client.

---

## 6. Screens to Build

### Public (no login)

1. **Sign Up** — email, password, full name, phone, "I agree to terms". Captcha (free hCaptcha).
2. **Login** — email/password. "Forgot password" → email reset link.
3. **Forgot password** — enter email → Supabase sends reset link.

### Client (after login)

4. **Dashboard home** — overview cards:
   - Current filing status (with the timeline visualization)
   - Quick "Upload documents" button
   - Recent documents (last 3)
   - Pending action items ("Please upload Form 16")
5. **Documents page** — categorized list of uploaded docs (Form 16 / Form 26AS / Bank Statements / etc.). Upload zone (drag-drop or click to upload). View / download / delete each doc.
6. **Filings page** — list of all your filings (current year + past years). Click into one for full timeline + documents specific to it.
7. **Profile page** — edit name, phone, PAN, GST number. Change password.
8. **Notifications** — bell icon, shows status update messages.

### Admin (after admin login)

9. **Admin dashboard** — total clients, filings in each status, recent activity.
10. **Clients list** — search + filter + click into a client.
11. **Client detail** — see their profile, all filings, all documents, status history. Buttons to advance status, upload acknowledgement, add internal note.
12. **All documents** — global view, useful for "did we get Form 16 from all clients?"

That's **12 screens** for the MVP. Most are simple list + form pages.

---

## 7. Build Phases (sessions)

| Session | Deliverable | What you do | What I do |
|---|---|---|---|
| **1** | Accounts set up + project skeleton | Create free Supabase + Vercel accounts. Add DNS record `app.taxmitrafinance.com`. | Initialize Next.js repo. Configure Supabase env vars. Confirm deploy pipeline. |
| **2** | Auth flow + DB schema | Approve schema. Verify your Supabase project URL. | Create all 6 tables with RLS policies. Build sign-up / login / forgot-password screens. Test with a fake client account. |
| **3** | Client dashboard + document upload | Test upload of a sample Form 16. Confirm document categorization is what you want. | Build dashboard home, documents page, file upload UI, profile page. Wire Supabase Storage with private buckets. |
| **4** | Filing status tracker + admin panel | Tell me what status names YOU use in your practice (we can rename). | Build the status timeline visualization. Build admin dashboard, clients list, status-update buttons. |
| **5** | Email notifications + polish | Sign up for free Resend account, give me API key. | Wire status-change emails via Resend. Add empty-states, loading states, error handling, mobile-responsive tweaks. |
| **6** | Soft launch | Invite 2–3 friendly clients to sign up. Watch for issues. | Bug fixes, performance tuning, add "Client Login" button on `taxmitrafinance.com` main site. |

**Realistic total**: 4–6 sessions of focused work. Could be slower if you want lots of design iterations.

---

## 8. What You Need to Do Before Session 1

1. **Sign up for Supabase** — `supabase.com` → "Start your project" → use Google login. Create a new project named `taxmitra-portal`. Choose region: **Mumbai (ap-south-1)** for low latency. Save the database password somewhere safe.

2. **Sign up for Vercel** — `vercel.com` → "Sign up with GitHub" (use your existing GitHub account: `caswapnilssoni-create`).

3. **Sign up for Resend** — `resend.com` → free email API (3,000 emails/month). Verify your `taxmitrafinance.com` domain so emails come from `noreply@taxmitrafinance.com` instead of `onboarding@resend.dev`. (I'll guide DNS records when we get to Session 5.)

4. **DNS — add a subdomain record** — wherever you bought `taxmitrafinance.com` (GoDaddy / Namecheap / Cloudflare?). Add a CNAME record:
   - Name: `app`
   - Value: `cname.vercel-dns.com`
   - This makes `app.taxmitrafinance.com` resolve to your Vercel deploy.

5. **(Optional) Install Node.js on your PC** — only needed if you want to test changes locally before pushing. If you're happy pushing → seeing the deployed version, skip this.

**Estimated setup time on your end: 30–45 minutes total.**

---

## 9. Security Considerations

This is a CA portal — clients trust you with sensitive financial data (PAN, Form 16, bank statements). Security is non-negotiable.

- **Encryption at rest**: Supabase encrypts the entire database. Storage is private by default — no public URLs.
- **Encryption in transit**: HTTPS only (auto-managed by Vercel).
- **Row-Level Security (RLS)**: every table has explicit policies. A bug in app code can't leak data — the database itself refuses unauthorized reads.
- **Password hashing**: Supabase uses bcrypt — passwords are never stored in plaintext.
- **2-factor auth (optional, recommended for admin)**: Supabase supports TOTP 2FA. Definitely enable on your admin account.
- **File access**: documents stored at `documents/{client_id}/{uuid}.pdf`. Signed download URLs expire in 1 hour. Even if a URL leaks, it's useless after 1 hour.
- **Audit log**: every status change writes to `status_history` with timestamp + actor. You can prove "I marked this filing as filed on this date" if a client disputes.
- **Backups**: Supabase free tier includes 7 days of daily backups. Pro tier extends this.
- **Penetration testing**: at launch, I'll run automated scans (free tools like OWASP ZAP). I'm not a security firm — if you want a formal audit, that's a separate engagement.

---

## 10. Free Tier Limits & When You Pay

**Supabase Free:**
- 500 MB database — enough for ~50,000 client records with all related data. You'll outgrow this around year 3 of growth.
- 1 GB file storage — enough for ~1,000 Form 16s + ack files. Older docs can be archived to cheaper cold storage.
- 50,000 monthly active users — far beyond your need.
- 2 GB bandwidth — generous.

**Vercel Free:**
- 100 GB bandwidth/month — far beyond need.
- Unlimited deploys.
- Custom domain free.

**Resend Free:**
- 3,000 emails/month — fine if avg client gets 5 status-update emails per year, supports ~600 clients/month worth of activity.

**When you upgrade:** when Supabase storage approaches 1 GB OR you hit ~500 active clients. Supabase Pro is **$25/month** (~₹2,100). At that point, your practice is bringing in 5L+ from these clients — easy ROI.

---

## 11. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| Client uploads a virus | We could integrate a virus-scan API (ClamAV/VirusTotal) in Phase 2. For MVP, restrict uploads to PDF/JPG/PNG only — these can carry malware but rarely do, and you'll only open them in PDF viewers/image viewers, not execute. |
| Client uploads sensitive info to wrong category | Easy to recategorize in admin panel. Documents are private regardless. |
| Supabase outage | Supabase has 99.9% uptime SLA on Pro, ~99.5% on free. For mission-critical, plan to upgrade post-launch. |
| You forget admin password | Supabase password reset still works for you. Always have 2 admins to be safe. |
| Client's old `info@taxmitrafinance.com` email might still go to existing inbox | Resend can verify just `noreply@…` subdomain without breaking your main email. |

**Open questions for you to answer before Session 4:**

1. **What status names do you currently use** in your practice? (e.g. you might call "computing_tax" something different in client communication.)
2. **What document categories matter to you most?** Did I miss any?
3. **Do clients sign up themselves, or do you create their accounts and email them an invite?** (Both are possible. Self-signup is easier; admin-creates is more controlled.)
4. **Should clients see fee/invoice info in the portal, or is that out of scope for MVP?** (Out of scope per your "core" answer — confirming.)

---

## 12. What This MVP Will NOT Have (out of scope)

To be clear on what we're NOT building yet:

- ❌ Appointment booking *(can add in Phase 2)*
- ❌ WhatsApp notifications *(needs Gupshup/Twilio paid)*
- ❌ Payment / invoicing *(Razorpay integration — Phase 2)*
- ❌ E-signature on engagement letter *(future)*
- ❌ Multi-staff / role-based permissions *(future)*
- ❌ Mobile app *(the web app is mobile-responsive, which covers 95% of mobile use)*
- ❌ Bulk client import *(can do via SQL once at launch if needed)*
- ❌ Integration with Tally / Zoho Books *(future, much bigger scope)*

---

## 13. Next Step

When you're ready, do these in any order (~30–45 min total):

1. ☐ Create free Supabase account → make project `taxmitra-portal` (region: Mumbai)
2. ☐ Create free Vercel account (sign in with GitHub)
3. ☐ Add DNS record: `app.taxmitrafinance.com` CNAME `cname.vercel-dns.com`
4. ☐ Read this plan, jot down questions / changes you want
5. ☐ Tell me you're ready for **Session 1**

Then in our next session, I start building. You'll get a working login + dashboard URL by end of Session 3.

---

*Document version 1 · prepared by Claude for TaxMitra · Scope: MVP — Login, Documents, Status Tracker, Admin Panel.*
