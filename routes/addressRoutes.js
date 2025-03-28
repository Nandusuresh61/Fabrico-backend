import express from "express";
import { 
  addAddress, 
  editAddress, 
  deleteAddress, 
  getAllAddresses,
  setDefaultAddress 
} from "../controllers/addressController.js";
import { authenticate } from "../middlewares/authMiddleWare.js";

const router = express.Router();

router.use(authenticate); // All routes require authentication

router.route('/')
  .get(getAllAddresses)
  .post(addAddress);

router.route('/:id')
  .put(editAddress)
  .delete(deleteAddress);

router.put('/:id/default', setDefaultAddress);

export default router;
