import express from 'express';
import { getSalesReport, downloadReport } from '../controllers/reportController.js';
import {  authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';

const router = express.Router();

router.get('/sales',authenticate, authorizeAdmin, getSalesReport);
router.get('/download/:format', authenticate, authorizeAdmin, downloadReport);

export default router;