import { google } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

export const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    'postmessage',
    {
        timeout: 10000, // 10 seconds timeout
        retry: true, // Enable retries
        maxRetries: 3
    }
)
