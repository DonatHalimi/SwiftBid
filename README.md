# Ankand Marketplace

A JavaScript-only monorepo for a real-time auction marketplace with instant-offer purchases, account sessions, seller listings, moderator workflows, and an admin dashboard.

## What's included

- **Frontend:** React 18, Vite, React Router, Tailwind CSS 3, TanStack Query, React Hook Form + Zod, Lucide icons, and Socket.IO client. JSX only; no TypeScript.
- **Backend:** Node.js ESM, Express 5, Prisma ORM, PostgreSQL, Socket.IO, Zod, bcrypt-compatible password hashing via `bcryptjs`, access JWTs in HttpOnly cookies, rotating refresh sessions, CORS, Helmet, and rate limits.
- **Auctions:** Atomic compare-and-set bid updates, live product-room events, scheduled end-of-auction settlement, reserve-price handling, and one-order-per-listing protection.
- **Instant offers:** Offer confirmation and product sale happen inside one database transaction; the offer becomes `ACCEPTED`, the listing becomes `SOLD`, and an order is created. Offers cannot undercut the current leading bid or hidden reserve.
- **Admin:** Metrics, searchable users, role updates/suspension, listing cancellation, report review, media removal, transaction status oversight, and an audit log that refreshes every five seconds.
- **Validation and security:** Zod request schemas, server-side authorization, 12-round bcrypt hashing, single-use rotating refresh tokens, session revocation on suspension, request limits, upload limits, and an Origin check for state-changing requests.
- **Email verification:** New registrations receive a single-use, 24-hour email link; successful verification starts the user's authenticated session. SMTP is required for registration email delivery.

## Requirements

- Node.js **20.11 or newer** and npm 10 or newer.
- PostgreSQL 14 or newer (a supported recent PostgreSQL release is recommended).
- A modern browser.

## Setup (Windows PowerShell or macOS/Linux)

1. **Create the environment files.** From the repository root:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   Copy-Item frontend/.env.example frontend/.env
   ```

   On macOS/Linux, use `cp backend/.env.example backend/.env` and `cp frontend/.env.example frontend/.env`.

2. **Configure PostgreSQL.** Create a database named `ankand` (or adjust `DATABASE_URL` in `backend/.env`). Set the real database username and password in the connection string. The database role must be allowed to create tables and enum types for the initial migration.

3. **Set strong secrets.** Replace `JWT_SECRET` and `COOKIE_SECRET` with different random values, each at least 32 characters long. One way to generate a secret with Node is:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

   Run it twice and place each output into a separate secret variable. Never commit `.env` files.

4. **Configure outbound email.** Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM` in `backend/.env` for an SMTP account. Authenticated SMTP is recommended. Registration returns an explicit delivery error if SMTP is unavailable; users can retry delivery from the verification prompt.

5. **Install packages and generate the Prisma client.**

   ```bash
   npm install
   npm run db:generate
   ```

6. **Apply database migrations.** For a local development database, run:

   ```bash
   npm run db:deploy
   ```

   `npm run db:migrate` is also available for authoring a new development migration. Do not use `migrate dev` against production.

7. **Create an admin account.** Public registration can only create `BUYER` accounts. To securely bootstrap the first admin, configure `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, and `BOOTSTRAP_ADMIN_NAME` temporarily in `backend/.env`, then run:

   ```bash
   npm run admin:bootstrap --workspace backend
   ```

   The script creates the account or upgrades the exact matching email to `ADMIN`. Remove the bootstrap password from `.env` immediately after running it. Do not enable this script as an automatic deployment hook.

8. **Start both applications.** From the repository root:

   ```bash
   npm run dev
   ```

   Frontend: `http://localhost:3000`  
   API: `http://localhost:5000`  
   Health check: `http://localhost:5000/health`

The frontend uses `VITE_API_URL` for API requests and `VITE_API_ORIGIN` for uploaded-image URLs. The backend's `FRONTEND_URL` must exactly match the browser origin, including scheme and port. In production, serve the frontend and API behind HTTPS and preferably the same site/reverse proxy so the `SameSite=Lax` cookie policy behaves predictably.

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start frontend and backend concurrently |
| `npm run build` | Build the frontend for deployment |
| `npm run start` | Start the API in production mode (after setting `NODE_ENV=production`) |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:studio` | Open Prisma Studio |
| `npm test` | Run backend unit tests |
| `npm run check` | Check backend/config JavaScript syntax |
| `npm run package:zip` | Create a clean source ZIP in the parent directory |

## Main routes

| Route | Purpose | Access |
|---|---|---|
| `POST /api/auth/register` | Create an unverified buyer account and send verification email | Public, rate limited |
| `POST /api/auth/verify-email` | Verify a single-use token and establish a session | Public, rate limited |
| `POST /api/auth/resend-verification` | Request another verification email (60-second per-account cooldown) | Public, rate limited |
| `POST /api/auth/login` | Start session | Public, rate limited |
| `POST /api/auth/refresh` | Rotate refresh session | Refresh cookie |
| `POST /api/auth/logout` | Revoke refresh session and clear cookies | Public endpoint, uses refresh cookie |
| `GET /api/auth/me` | Return current user | Authenticated |
| `POST /api/auth/become-seller` | Enable seller tools | Authenticated |
| `GET /api/products` | Search/paginate listings | Public |
| `GET /api/products/:id` | Listing details + latest bids | Public; reserve price excluded |
| `POST /api/products` | Create listing and upload images | Seller/Admin |
| `POST /api/products/:id/bids` | Place atomic bid | Buyer/Seller |
| `POST /api/products/:id/offers` | Confirm instant offer | Buyer/Seller |
| `POST /api/products/:id/report` | Report a listing | Authenticated |
| `GET /api/dashboard/me` | User's bids, offers, listings, purchases, sales | Authenticated |
| `PATCH /api/transactions/:id/status` | Advance an allowed fulfillment state | Party to order/Admin |
| `GET /api/admin/metrics` | Platform totals | Admin |
| `/api/admin/users`, `/listings`, `/reports`, `/transactions`, `/audit-logs` | Admin management and oversight | Admin |

Socket.IO clients join public listing rooms using `product:join` with a product ID. Events include `bid:new`, `auction:sold`, `auction:expired`, `offer:accepted`, and `listing:cancelled`. Admin audit rows are fetched over the authenticated REST API and refreshed at five-second intervals.

## Auction and offer rules

- Bids must be greater than both the current highest bid and the starting price. A database compare-and-set plus a serializable transaction prevents stale concurrent requests from overwriting the leading bid.
- A regular bid does not end an auction. The worker checks expired listings every five seconds and settles the winner when the reserve is met; otherwise the listing expires without a sale.
- The first accepted bid is above the starting price. The winning transaction starts at `PENDING_PAYMENT`.
- An instant offer is a **direct purchase**, not a seller-negotiated offer. Confirming one immediately marks it accepted, marks the listing sold, and creates an order. The offer must meet the starting price, any hidden reserve, and exceed an existing leading bid by at least one cent.
- `Transaction.productId` is unique, and product state changes are guarded inside database transactions to prevent two independent sale records for one listing.
- Amount fields use PostgreSQL `Decimal(12,2)` rather than `Float`. This is a deliberate correctness improvement over the original draft schema because binary floating point is unsuitable for currency calculations.

## Deliberate MVP boundaries

The following capabilities are architectural roadmap items only and have **not** been implemented as working payment or delivery integrations: Stripe Connect/escrow and payouts, proxy/max bidding, anti-sniping soft closes, FX conversions and currency selection, Albanian/English localization, outbound SMS, and real OAuth providers. The `/auth/oauth/:provider` route reports `501` until a provider is configured. There is no in-app payment processor; administrators should only mark a transaction `PAID` after verifying payment externally.

Image uploads are stored on the backend filesystem for local development. Use a durable object store (such as S3-compatible storage), malware scanning, image transcoding, and CDN delivery for a horizontally scaled production deployment. This MVP also requires production deployment review for jurisdiction-specific marketplace, privacy, consumer, tax, KYC, and payment rules before taking real money.

## Tests and known follow-up work

- `npm test` covers money normalization and reserve-price settlement rules.
- Run a real integration test suite against PostgreSQL before production: concurrent bids, bid-vs-settlement races, simultaneous instant offers, refresh-token reuse, role/suspension revocation, and transaction state transitions are the highest-priority scenarios.
- Add password recovery, request correlation IDs, monitoring, backups, and a deployment-specific CSRF/session review before public launch.
