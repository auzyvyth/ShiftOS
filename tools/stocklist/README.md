# stocklist.py - weekly dealer stock PDF -> Drevo

Photos come from private Google Drive folders, so this runs on YOUR laptop with YOUR Google login.
Nothing is stored except two small login files in `~/.drevo_stock/` (outside the repo, never commit them).
No Supabase service-role key is used: it signs in as your dealer account, so the database rules apply.

## One-time setup (Chromebook / Linux container, about 150 MB free is enough)
1. Install (no cache, to save disk):
   `python3 -m venv ~/stockenv && ~/stockenv/bin/pip install --no-cache-dir -r requirements.txt`
2. Google Drive access (read only). console.cloud.google.com:
   new project, enable "Google Drive API", OAuth consent screen: External, add yourself as a test user,
   then PUBLISH it ("In production", an unverified-app warning is fine for your own use; in testing mode
   the login expires every 7 days). Credentials: OAuth client ID, type Desktop app, download the JSON to
   `~/.drevo_stock/client_secret.json`.
3. `export SUPABASE_ANON_KEY=<the public anon key, same as VITE_SUPABASE_ANON_KEY in Vercel>`
4. `~/stockenv/bin/python stocklist.py google` (follow the prompts)
5. `~/stockenv/bin/python stocklist.py login` (follow the prompts)

## Every week
0. `python stocklist.py explain STOCK.pdf` (read only, needs no login): shows what is taken from the PDF, where each
   thing goes, and how every kind of car is split into model / variant / engine / body. A wrong split is fixed
   once in `model_map.csv` (next to the script), never in the code.
1. `python stocklist.py parse STOCK.pdf` : checks the PDF, writes a clean CSV of cars still for sale.
   If it prints rows that "did not look right", fix them by hand first (e.g. a typo in a chassis number).
2. Import the CSV with the app's own importer (Dashboard > Import stock). New cars get their listing and
   stock record there, the same as always. It has no photos yet.
3. `python stocklist.py status STOCK.pdf` : what is new, what lacks photos, what is SOLD but still live.
4. `python stocklist.py photos STOCK.pdf --dry-run`, then `--limit 5` (check them on screen), then
   without `--limit`. A folder with fewer than 10 usable photos is NOT taken (nothing downloaded) and is listed at the end. Only cars with no photos yet are touched.
5. `python stocklist.py tidy STOCK.pdf` : cars ALREADY in the app get the same clean model / variant / engine / body
   (dry run shows before -> after; `--yes` applies). Only those five fields, only cars found in the PDF by chassis.
6. `python stocklist.py unpublish STOCK.pdf` : cars the PDF marks SOLD and that are still live -> unpublished.

## Rules it follows
- Match key is the chassis number (`car_listings.vin`); the PDF has no plates.
- Names after "SOLD" and the BASE column are never read out of the PDF.
- Photos: one at a time in memory, longest side 1600 px, WebP, ALL photos in the folder (up to 60), and the folder must have at least 10 usable ones. Never written to disk.
  HEIC files are skipped (counted in the report); browsers cannot show them.
- Every database write checks that a row really changed (the database refuses silently otherwise).
- Cars with no ARR "Y" (not arrived) are exported with an `arrival` column: decide how to label them
  before they go live.

## Not covered
- It does not create listings (the app's importer does, so costs and stock records stay in one place).
- Whether "ARR" means arrived, and what BASE means, are guesses from the layout. Confirm with the dealer.
