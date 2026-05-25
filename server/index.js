import 'dotenv/config';

/* eslint-env node */
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import anthropicRoute from './routes/anthropic.js';

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://xdrive.my',
    'https://www.xdrive.my',
    'https://drevo.my',
    'https://www.drevo.my',
    /^https:\/\/[a-z0-9-]+\.xdrive\.my$/,
  ],
  credentials: true,
}));
app.use(bodyParser.json({ limit: '10mb' }));

app.use('/ai', anthropicRoute);

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on port ${PORT}`);
});
