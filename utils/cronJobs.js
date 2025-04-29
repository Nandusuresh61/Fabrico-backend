import cron from 'node-cron';
import Offer from '../models/offerModel.js';
import Coupon from '../models/couponModel.js';
import { applyOfferDiscount } from '../controllers/OfferController.js';


export const initCronJobs = () => {
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    

    try {

      const offersToActivate = await Offer.find({
        isActive: false,
        startDate: { $lte: now },
        endDate: { $gt: now }
      });


      for (const offer of offersToActivate) {
        offer.isActive = true;
        await offer.save();
        await applyOfferDiscount(offer);
      }

      const expiredOffers = await Offer.find({
        isActive: true,
        endDate: { $lte: now }
      });

      for (const offer of expiredOffers) {
        offer.isActive = false;
        await offer.save();
      }
    } catch (error) {
      console.error('Error in offer cron job:', error);
    }

    try {

      await Coupon.updateMany(
        {
          isExpired: false,
          endDate: { $lte: now }
        },
        {
          $set: { isExpired: true }
        }
      );

 
      await Coupon.updateMany(
        {
          isExpired: true,
          startDate: { $lte: now },
          endDate: { $gt: now }
        },
        {
          $set: { isExpired: false }
        }
      );
    } catch (error) {
      console.error('Error in coupon cron job:', error);
    }
  });
};