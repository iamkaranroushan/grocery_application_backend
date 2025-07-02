import express from 'express';
import authController from '../controllers/authController.js';

const router = express.Router();

router.post('/verify-otp', authController.verifyOtp);
router.post('/logout', authController.logoutUser);

export default router;