/* eslint-env node */
import express from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// optionally sync to Google Sheets
import { GoogleSpreadsheet } from 'google-spreadsheet';
import fs from 'fs';
const DATA_FILE = new URL('../../data/carListings.json', import.meta.url).pathname;
let carListings = [];
let sheetDoc;
let sheet;
async function initSheet() {
  if (!process.env.GOOGLE_SHEETS_ID) return;
  sheetDoc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);
  await sheetDoc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  });
  await sheetDoc.loadInfo();
  sheet = sheetDoc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  carListings = rows.map((r, i) => ({
    id: +r.id || i + 1,
    brand: r.brand,
    model: r.model,
    variant: r.variant,
    state: r.state,
    mileage: r.mileage,
    colour: r.colour,
    condition: r.condition,
    registrationDate: r.registrationDate,
    specs: r.specs,
    options: r.options,
    features: r.features,
    basePrice: r.basePrice,
    sellingPrice: r.sellingPrice,
    images: r.images ? r.images.split(',') : [],
  }));
}
// kick off initialization (fire-and-forget)
initSheet().catch(console.error);

// load existing persisted store (if any)
try {
  const raw = fs.readFileSync(DATA_FILE);
  carListings = JSON.parse(raw);
} catch (e) {
  carListings = carListings || [];
}

// static brand/model map
const brands = {
  Toyota: ['Camry', 'Corolla', 'Hilux'],
  Honda: ['Civic', 'Accord', 'CR-V'],
  BMW: ['3 Series', '5 Series', 'X3'],
};

// middleware to verify token
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Missing token' });
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return res.status(401).json({ message: 'Invalid token' });
  const token = parts[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

router.get('/brands', (req, res) => {
  res.json(Object.keys(brands));
});

router.get('/models', (req, res) => {
  const { brand } = req.query;
  if (!brand || !brands[brand]) return res.json([]);
  res.json(brands[brand]);
});

// public endpoint for listing cars
router.get('/', async (req, res) => {
  if (sheet) {
    try {
      const rows = await sheet.getRows();
      carListings = rows.map((r, i) => ({
        id: +r.id || i + 1,
        brand: r.brand,
        model: r.model,
        variant: r.variant,
        state: r.state,
        mileage: r.mileage,
        colour: r.colour,
        condition: r.condition,
        registrationDate: r.registrationDate,
        specs: r.specs,
        options: r.options,
        features: r.features,
        basePrice: r.basePrice,
        sellingPrice: r.sellingPrice,
        images: r.images ? r.images.split(',') : [],
      }));
    } catch (err) {
      console.error('Failed to read from Google Sheet', err);
    }
  }
  res.json(carListings);
});

router.post('/', authenticate, async (req, res) => {
  const listing = req.body;
  listing.id = carListings.length + 1;
  carListings.push(listing);
  // persist
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(carListings, null, 2));
  } catch (err) {
    console.error('Failed to save listings', err);
  }

  // sheet sync if configured
  if (sheet) {
    try {
      await sheet.addRow({
        id: listing.id,
        brand: listing.brand,
        model: listing.model,
        variant: listing.variant,
        state: listing.state,
        mileage: listing.mileage,
        colour: listing.colour,
        condition: listing.condition,
        registrationDate: listing.registrationDate,
        specs: listing.specs,
        options: listing.options,
        features: listing.features,
        basePrice: listing.basePrice,
        sellingPrice: listing.sellingPrice,
        images: listing.images.join(','),
      });
    } catch (err) {
      console.error('Failed to write to Google Sheet', err);
    }
  }

  // send notification if email configured
  if (process.env.NOTIFY_EMAIL && process.env.NOTIFY_USER && process.env.NOTIFY_PASS) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.NOTIFY_USER,
        pass: process.env.NOTIFY_PASS,
      },
    });
    const mailOptions = {
      from: process.env.NOTIFY_USER,
      to: process.env.NOTIFY_EMAIL,
      subject: 'New car listing added',
      text: `A new listing was added:\n${JSON.stringify(listing, null, 2)}`,
    };
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error('Failed to send notification email', err);
    });
  }

  res.status(201).json(listing);
});

export default router;
