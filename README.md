# Web App with Admin Dashboard

This project is a React/Vite frontend with a minimal Express backend for managing car listings.  The dashboard is protected by email/password authentication (JWT).  Users can add listings with multiple images and select brands/models from dropdowns.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start backend server**
   ```bash
   npm run start-server
   ```
   The API listens on `http://localhost:4000` and exposes `/auth` and `/cars` endpoints.

3. **Start frontend dev server**
   ```bash
   npm run dev
   ```
   Vite proxy rules forward requests to the backend.

## Authentication

- A demo user is hardcoded in `server/routes/auth.js`:
  - **email**: `admin@example.com`
  - **password**: `password123`

- JWT tokens are stored in `localStorage` under `authToken`.
- The header displays a "Dashboard" link when authenticated and a Logout button.

## Dashboard

Accessible at `/dashboard` after logging in.  The admin UI now uses a purple/white theme and presents listings in a table for easier scanning.

You can:

- Add a new car listing using the form.  Fields include:
  - brand, model, variant, state, mileage, colour, condition
  - registration date, specs text, options text, features text
  - base price and selling price
  - multiple images (15‑30 files at once)
- Listings appear immediately in a responsive table showing all of the above columns.
- Images are not actually uploaded; file names are stored for demo.
- Brands/models come from the backend.  Selecting a brand filters the model dropdown.

## Backend details

- Simple Express server in `server/` with JWT auth and in-memory store persisted to `data/carListings.json`.
- API endpoints:
  - `POST /auth/login` – accept email/password, return JWT (hard‑coded user only).
  - `GET /cars` – **public** list of current car listings.
  - `POST /cars` – add new listing, requires Bearer token.
  - `GET /cars/brands` and `GET /cars/models?brand=…` – helpers for brand/model dropdowns.
- `POST /cars` will optionally send a notification email when a new listing is added.  To enable this set the following environment variables:
  - `NOTIFY_EMAIL` – destination address (e.g. your own email)
  - `NOTIFY_USER` – SMTP user (Gmail address if using Gmail)
  - `NOTIFY_PASS` – SMTP password or app-specific password

  **Do not commit your real password into version control.**

- The same endpoint can also sync with a Google Sheet in real time.  To enable it set:
  - `GOOGLE_SHEETS_ID` – the ID of the sheet (from its URL)
  - `GOOGLE_SHEETS_CLIENT_EMAIL` – service account email
  - `GOOGLE_SHEETS_PRIVATE_KEY` – private key (escape newlines as `\n`)
  When the sheet is configured the server will read it on every `GET /cars`, so any edits you make directly in the sheet are reflected immediately in the dashboard without restarting the server.
### Environment variables

Create a `.env` file in the project root (Vite will load `VITE_` variables automatically):

```
# backend email notification
NOTIFY_EMAIL=you@example.com
NOTIFY_USER=you@gmail.com
NOTIFY_PASS=app-specific-password

# google sheets sync
GOOGLE_SHEETS_ID=sheet-id-here
GOOGLE_SHEETS_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# (optional) supabase credentials if you integrate later
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...
```

- `NOTIFY_*` are used by the Express server when a new listing is created.
- Replace `you@gmail.com` and password with your own account/app password.
- `GOOGLE_SHEETS_*` are required if you want your listings immediately written to a sheet.  Share the sheet with the service account in the Google Cloud console.

- `cors` is enabled; Vite proxy forwards API calls from the front end.

## Extending

- Replace in-memory user storage with a real database.
- Implement actual image uploads (e.g. to S3) and return URLs.
- Add more admin features (listing management, user accounts).
- Add environment variables for secrets and ports.

---

Feel free to modify components in `src/pages/` and server logic in `server/routes/` as needed.# ShiftOS
