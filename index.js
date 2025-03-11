
import express from 'express'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'
import userRoutes from './routes/userRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
dotenv.config()


import connectDB from './config/db.js'
connectDB();
const port = process.env.PORT || 5000;




const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

app.use('/api/users',userRoutes)
app.use('/api/admin',adminRoutes)



app.listen(port,(console.log(`server is running on port ${port}`)))