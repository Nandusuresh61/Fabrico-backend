import mongoose from "mongoose";
import dotenv from 'dotenv'

dotenv.config()

const connectDB = async ()=>{
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log('successfully conncted to DataBase');
        
    } catch (error) {
        console.error(`ERROR: ${error.message}`)
        process.exit(1)
    }
}

export default connectDB