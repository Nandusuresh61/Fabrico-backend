import  cors from 'cors'
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
    origin: 'http://localhost:5173', // Allow requests from this origin
    credentials: true, // Allow cookies and headers
  }));

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

app.use('/api/users',userRoutes);
app.use('/api/admin',adminRoutes);
app.use('/api/categories',categoryRoutes);
app.use('/api/brands',brandRoutes);

app.use('/api/products',productRoutes)



app.listen(port,(console.log(`server is running on port ${port}`)))