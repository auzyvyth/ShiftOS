import 'dotenv/config';

/* eslint-env node */
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import authRoutes from './routes/auth.js';
import carRoutes from './routes/cars.js';
import invitesRoutes from './routes/invites.js';
import createSalesmanRoute from './routes/createSalesman.js';
import generateCaptionsRoute from './routes/generateCaptions.js';
import anthropicRoute from './routes/anthropic.js';

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://drevo.my',
    'https://www.drevo.my',
  ],
  credentials: true,
}));
app.use(bodyParser.json());

app.use('/auth', authRoutes);
app.use('/cars', carRoutes);
app.use('/invites', invitesRoutes);
app.use('/create-salesman', createSalesmanRoute);
app.use('/generate-captions', generateCaptionsRoute);
app.use('/ai', anthropicRoute);

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on port ${PORT}`);
});