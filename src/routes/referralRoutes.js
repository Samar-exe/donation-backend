import express from 'express';
import { 
  getReferralInfo, 
  applyReferralCode, 
  shareReferralLink, 
  getSawabPoints 
} from '../controllers/referralController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected and require authentication
router.get('/', protect, getReferralInfo);
router.post('/apply', protect, applyReferralCode);
router.post('/share', protect, shareReferralLink);
router.get('/points', protect, getSawabPoints);

export default router; 