import express from "express";
import {
  createOffer,
  getAllOffers,
  updateOffer,
  toggleOfferStatus,
} from "../controllers/offerController.js";
import { authenticate, authorizeAdmin } from '../middlewares/authMiddleWare.js';
const router = express.Router();

router.use(authenticate, authorizeAdmin);

router.route("/")
    .post(createOffer)
    .get(getAllOffers);

router.put("/:offerId", updateOffer);

router.put("/:offerId/toggle-status", toggleOfferStatus);

export default router;
