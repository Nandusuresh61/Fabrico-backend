import cors from 'cors'
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import productRoutes from './routes/productRoutes.js'



dotenv.config();
import connectDB from './config/db.js';

connectDB();
const port = process.env.PORT || 5000;




const app = express();
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use((req, res, next) => {
  res.removeHeader("Cross-Origin-Opener-Policy"); // Remove COOP
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups"); // Allow popups
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);

app.use('/api/products', productRoutes)



app.listen(port, (console.log(`server is running on port ${port}`)))