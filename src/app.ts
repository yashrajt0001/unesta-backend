import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRateLimiter } from './common/middleware/rate-limiter.js';
import { errorHandler, notFoundHandler } from './common/middleware/error-handler.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import listingsRoutes from './modules/listings/listings.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import bookingsRoutes from './modules/bookings/bookings.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import messagesRoutes from './modules/messages/messages.routes.js';
import reviewsRoutes from './modules/reviews/reviews.routes.js';
import hostRoutes from './modules/host/host.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import wishlistsRoutes from './modules/wishlists/wishlists.routes.js';

const app = express();

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use('/api', apiRateLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Unesta API is running',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/host', hostRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/wishlists', wishlistsRoutes);
// Mounted at /api (no sub-prefix) — must come after all specific /api/* routes
// to prevent their router.use(authenticateUser) from intercepting unrelated paths
app.use('/api', paymentsRoutes);
app.use('/api', messagesRoutes);
app.use('/api', reviewsRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
