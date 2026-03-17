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

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/auth', authRoutes);
app.use('/cars', carRoutes);
app.use('/invites', invitesRoutes);
app.use('/create-salesman', createSalesmanRoute);
app.use('/generate-captions', generateCaptionsRoute);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});