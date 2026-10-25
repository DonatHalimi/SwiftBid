# Architecture Overview

## Runtime topology

```text
Browser (React / Vite :3000)
  | REST + HttpOnly cookies                  | Socket.IO
  v                                          v
Express API (:5000) ----------------------- Socket.IO rooms
  | controllers -> services -> Prisma           product:<id>
  |                                               admins
  v
PostgreSQL
  | users / refresh tokens / products / images / bids / offers
  | transactions / listing reports / audit logs
  v
Local upload directory (MVP only)
```

Root npm workspaces orchestrate the frontend and backend with `concurrently`. The frontend uses TanStack Query for remote state. The backend is split into routes, controllers, services, validation schemas, middleware, Prisma access, and utilities.

## Auction lifecycle

1. A seller creates an `ACTIVE` product with a future `auctionEndsAt` and optional hidden reserve.
2. A bid is validated against the current highest bid and starting price, then conditionally updates `Product.currentHighestBid` and inserts `Bid` in a serializable transaction. The product-room `bid:new` event is emitted only after commit.
3. A worker scans ended active auctions every five seconds. If a positive highest bid meets the reserve (or no reserve exists), it changes the listing to `SOLD` and creates a single `PENDING_PAYMENT` transaction for the highest bidder. Otherwise, it marks the listing `EXPIRED`.
4. Ordinary bids never terminate an auction early.

## Instant-offer lifecycle

1. The frontend submits an amount to `/api/products/:id/offers`.
2. The service checks ownership, eligibility, auction state, starting price, current highest bid, and the hidden reserve.
3. Within a serializable transaction it conditionally changes the listing from `ACTIVE` to `SOLD`, records the `ACCEPTED` offer, and inserts the unique transaction row.
4. After commit, `offer:accepted` and `auction:sold` events are broadcast to the product room. Concurrent bids/offers that lose the state race receive a conflict response rather than a second order.

## Session model

- Access token: short-lived JWT in an HttpOnly cookie.
- Refresh token: cryptographically random opaque value; only SHA-256 hash is stored. Rotation marks the old record revoked before issuing its replacement.
- Middleware verifies the JWT and loads the user record on each authenticated request, so role changes and suspensions apply immediately.
- User account role starts as `BUYER`; becoming a seller is a one-way self-service upgrade. `ADMIN` role can only be granted via the bootstrap script or admin-only management endpoint.

## Data integrity decisions

Currency-bearing fields use PostgreSQL `Decimal(12,2)` even though the supplied draft described `Float`. The schema also adds refresh-token persistence, reports, audit logs, indexes, timestamps, and a unique transaction-to-product relation. These additions support the specified session rotation, moderation, audit history, and single-settlement constraints.

## Future seams (not implemented)

- Payment/escrow adapter and provider webhooks; transition transaction status only from trusted provider signals.
- Proxy-bid service and auction extension policy.
- FX quote provider interface, currency storage, and localized display formatting.
- Notification dispatcher with durable queue, retry policy, and idempotency key.
- External object storage with signed uploads and CDN.
