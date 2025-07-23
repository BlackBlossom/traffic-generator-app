// routes/auth.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // Allows access to params like :email
const authController = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const userRoutes = require('./userRoutes');

// Registration and login
router.post('/register', authController.register);
router.post('/verify', authController.verifyOtp);
router.post('/login', authController.login);
router.post('/resend-otp', authController.resendOtp);

// Forgot/reset password
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// User profile (JWT-protected)
router.get('/user-by-email', auth, authController.getUserByEmail);
router.post('/update-user', auth, authController.updateUserDetails);
router.post('/change-password', auth, authController.changePassword);

// API key management (JWT-protected)
router.post('/generate-apikey', auth, authController.generateApiKey);
router.post('/revoke-apikey', auth, authController.revokeApiKey);


// All routes below are protected by API key middleware
// router.use(apiKeyAuth);

router.use('/users', userRoutes);

module.exports = router;

// Routes
// /api/auth/register
// /api/auth/verify
// /api/auth/login
// /api/auth/resend-otp
// /api/auth/forgot-password
// /api/auth/reset-password
// /api/auth/user-by-email
// /api/auth/update-user
// /api/auth/change-password
// /api/auth/generate-apikey
// /api/auth/revoke-apikey
