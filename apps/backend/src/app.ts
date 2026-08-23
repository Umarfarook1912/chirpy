import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ALLOWED_ORIGINS_LIST } from './config/env';
import { errorHandler } from './api/middlewares/errorHandler';
import authRoutes from './api/routes/auth.routes';
import meetingRoutes from './api/routes/meeting.routes';
import organizationRoutes from './api/routes/organization.routes';
import sessionRoutes from './api/routes/session.routes';
import reportRoutes from './api/routes/report.routes';

const app: Express = express();

app.use(helmet());

app.use(
  cors({
    origin: ALLOWED_ORIGINS_LIST,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/reports', reportRoutes);

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.use(errorHandler);

export default app;
