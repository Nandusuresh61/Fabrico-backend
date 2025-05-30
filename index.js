import cors from 'cors'
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import productRoutes from './routes/productRoutes.js'
import addressRoutes from './routes/addressRoutes.js'
import wishlistRoutes from './routes/wishlistRoutes.js'
import cartRoutes from './routes/cartRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import walletRoutes from './routes/walletRoutes.js'
import csrfProtection from './middlewares/csrfMiddleware.js';
import offerRoutes from './routes/offerRoutes.js'
import couponRoutes from './routes/couponRoutes.js';
import morgan from 'morgan';
import helmet from 'helmet';
import paymentRoutes from './routes/paymentRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { initCronJobs } from './utils/cronJobs.js';
dotenv.config();
import connectDB from './config/db.js';

connectDB();
initCronJobs();
const port = process.env.PORT || 5000;




const app = express();
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_BASE_URL,
  credentials: true,
}));
app.use(helmet());

app.use((req, res, next) => {
  res.removeHeader("Cross-Origin-Opener-Policy");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// app.get('/api/csrf-token', csrfProtection, (req, res) => {
//   res.json({ csrfToken: req.csrfToken() });
// });


// app.use('/api', csrfProtection);

app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);

app.use('/api/products', productRoutes);

app.use('/api/addresses', addressRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/cart', cartRoutes);

app.use('/api/orders', orderRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.listen(port, (console.log(`server is running on port ${port}`)))