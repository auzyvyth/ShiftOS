#!/usr/bin/env node

// Generates public/llms.txt — a curated, high-signal guide to XDrive for LLMs
// and AI search engines (ChatGPT, Perplexity, Claude, Gemini). This follows the
// llmstxt.org convention: an H1, a summary blockquote, then curated sections of
// links with real descriptions.
//
// NOTE: This is intentionally hand-curated, NOT auto-extracted from page source.
// The previous auto-extractor read <Helmet> titles, but most pages set their
// title from a JS variable ({SEO_TITLE}), which the extractor stripped — so every
// page collapsed to "Untitled Page / No description available" and the shipped
// llms.txt actively misrepresented the product. Curated copy keeps this accurate.
// When you add a public page or article, add a line to the relevant section below.

import fs from "fs";
import path from "path";

const SITE = "https://xdrive.my";

// Public, indexable articles (Malay SEO content). Keep in sync with src/App.jsx.
const ARTICLES = [
  ["/articles/app-terbaik-dealer-kereta-terpakai-malaysia", "App terbaik untuk dealer kereta terpakai Malaysia — how ShiftOS compares to Excel and manual record-keeping."],
  ["/articles/apa-itu-dms-dealer-kereta", "What a dealer DMS (Dealer Management System) is and why used car dealers need one."],
  ["/articles/cara-urus-stok-kereta-terpakai-sistem-digital", "How to manage used car stock with a digital system instead of spreadsheets."],
  ["/articles/cara-kira-komisen-salesman-kereta", "How car salesman commission is calculated in Malaysia (percent-of-gross, flat, and tiered)."],
  ["/articles/cara-buat-sales-agreement-kereta-terpakai", "How to write a used car sales agreement (Sales Agreement / Perjanjian Jual Beli) in Malaysia."],
  ["/articles/apa-itu-puspakom-b5-b7", "What Puspakom B5 and B7 inspections are, when each is required, and current fees."],
  ["/articles/cara-pindah-milik-kereta-mysikap", "How to transfer car ownership (pindah milik) via JPJ MySikap, step by step."],
  ["/articles/beza-kereta-recon-dan-terpakai", "The difference between recond (recon) and locally-used cars for Malaysian buyers."],
];

const CONTENT = `# XDrive

> XDrive is a Malaysian used-car platform with two sides: a public marketplace at
> xdrive.my where buyers browse verified used cars from local dealers, and ShiftOS,
> a used-car dealer management system (DMS) that dealers and salesmen use to run
> their inventory, leads CRM, sales records, salesman commission and profit analytics.

XDrive serves three audiences: car **buyers** (the marketplace), used-car **dealers**
(the ShiftOS software, sold on monthly plans), and individual **salesmen** (a free
and a low-cost paid tier to manage their own listings, leads and commission). The
software is purpose-built for Malaysian workflows: Puspakom B5/B7 inspections, JPJ
pindah milik (ownership transfer), hire-purchase (HP) financing and F&I add-ons.

## For car buyers
- [Marketplace](${SITE}/): Browse verified used cars for sale in Malaysia from trusted dealers.
- [Showroom / all listings](${SITE}/showroom): Full searchable inventory with filters for price, mileage, year, transmission, condition and location.
- [Compare cars](${SITE}/compare): Compare up to 4 used cars side by side on price, monthly instalment, mileage, running costs and an overall value score.
- [Loan calculator](${SITE}/calculator): Estimate monthly hire-purchase instalments for a used car (interest, tenure, down payment).

## For dealers — ShiftOS software
- [ShiftOS for dealers](${SITE}/shiftos): Used-car dealer software (DMS) for Malaysia — inventory management, leads CRM, sales records, salesman commission tracking, per-unit profit (P&L), F&I and the full Malaysian handover checklist. 14-day free trial, no card required.
- What it replaces: Excel stock sheets, WhatsApp lead chats, manual JPJ/Puspakom tracking, printed paperwork and scattered Telegram posts — in one platform.
- Key modules: real per-unit gross profit, auto customer records on a won deal, post-sale handover board (loan settlement, insurance, Puspakom B5/B7, JPJ pindah milik, road tax, geran, handover), road tax & insurance renewal reminders, and a public dealer storefront on a xdrive.my subdomain.

## For salesmen
- [ShiftOS for salesmen](${SITE}/for-salesmen): A free app for individual car salesmen to manage their own listings, leads and commission, share cars with tracked referral links, and see which channels drive their traffic.

## Guides & articles
- [Guides](${SITE}/guides): Practical guides for Malaysian used-car buyers and dealers.
- [All articles](${SITE}/articles): Index of dealer and buyer guides.
${ARTICLES.map(([url, desc]) => `- [${url.split("/").pop()}](${SITE}${url}): ${desc}`).join("\n")}

## Pricing (RM/month, prices in Malaysian Ringgit)
- Salesman Lite — RM0 (free): up to 10 listings, 1 seat.
- Salesman Premium — RM35/month: up to 30 listings, 1 seat, plus AI captions, financing tools and deal sheets.
- Dealer Starter — RM299/month: up to 30 listings, 4 seats. 14-day free trial.
- Dealer Growth — RM599/month: up to 80 listings, 8 seats.
- Dealer Pro — RM1,199/month: up to 150 listings, 15 seats.
- Dealer Group — RM2,999/month: unlimited listings and seats (multi-branch).

## About
- XDrive is based in Malaysia and built for the Malaysian used-car market.
- The marketplace lives at ${SITE}; each dealer also gets a storefront at <dealer>.xdrive.my.
- ShiftOS is the dealer/salesman software product; XDrive is the consumer marketplace brand.
`;

function main() {
  const outputPath = path.join(process.cwd(), "public", "llms.txt");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, CONTENT, "utf8");
  console.log(`Wrote ${outputPath} (${CONTENT.length} bytes)`);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) main();
