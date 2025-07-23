const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const validator = require('validator');
const { Resend } = require('resend'); // Replace with your email provider if needed
const crypto = require('crypto');

const resend = new Resend(process.env.RESEND_API_KEY);

function generateOTP(length = 6) {
  // Generates a numeric OTP of desired length
  const max = Math.pow(10, length);
  return crypto.randomInt(0, max).toString().padStart(length, '0');
}

// --- Registration and OTP Verification ---

exports.register = async (req, res) => {
  let { name, email, password } = req.body;

  // Input validation and sanitization
  if (!validator.isEmail(email)) return res.status(400).json({ error: 'Invalid email.' });
  if (!validator.isAlphanumeric(name)) return res.status(400).json({ error: 'Invalid name.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  // Check for existing user
  if (await User.findOne({ email })) return res.status(400).json({ error: 'Email already registered.' });

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Generate cryptographically secure OTP
  const otp = generateOTP(6);
  const hashedOtp = await bcrypt.hash(otp, 12);
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const otpResendAfter = new Date(Date.now() + 30 * 1000); // 30 seconds cooldown

  // Create user
  const user = new User({
    name,
    email,
    password: hashedPassword,
    isVerified: false,
    otp: hashedOtp,
    otpExpiry,
    otpUsed: false, // Add this field to your schema
    otpResendAfter
  });
  await user.save();

  // Send OTP email using Resend (replace with your provider as needed)
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}\nThis code will expire in 10 minutes.`,
    });
  } catch (err) {
    // Rollback user creation if email fails
    await User.deleteOne({ email });
    return res.status(500).json({ error: 'Failed to send OTP email.' });
  }

  res.status(201).json({ message: 'Registration successful. Please verify the OTP sent to your email.' });
};

// --- OTP Verification ---
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });

  // Helper to send new OTP
  const sendNewOtp = async (user, res, errorMessage) => {
    const newOtp = generateOTP(6);
    user.otp = await bcrypt.hash(newOtp, 12);
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    user.otpUsed = false;
    user.otpResendAfter = new Date(Date.now() + 60 * 1000); // 1 min cooldown
    await user.save();
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM,
        to: email,
        subject: 'Your new OTP Code',
        text: `Your new OTP code is: ${newOtp}\nThis code will expire in 10 minutes.`,
      });
    } catch (err) {
      // Optionally log email sending error
    }
    return res.status(400).json({ error: errorMessage, newOtpSent: true });
  };

  if (!user)
    return res.status(400).json({ error: 'User not found.' });

  if (!user.otp || !user.otpExpiry || user.otpUsed)
    return await sendNewOtp(user, res, 'Invalid or already used OTP. A new OTP has been sent.');

  if (user.otpExpiry < new Date())
    return await sendNewOtp(user, res, 'OTP expired. A new OTP has been sent.');

  const valid = await bcrypt.compare(otp, user.otp);
  if (!valid)
    return await sendNewOtp(user, res, 'Invalid OTP. A new OTP has been sent.');

  // Success: verify user and clear OTP fields
  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.otpUsed = true;
  user.otpResendAfter = undefined;
  await user.save();

  const token = jwt.sign(
    { id: user._id, email: user.email, isAdmin: user.isAdmin, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ message: 'Account verified. You can now log in.', token });
};

// --- Login ---

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  // if (!user || !user.isVerified) return res.status(400).json({ error: 'Invalid credentials or account not verified.' });

  if (!user) return res.status(400).json({ error: 'User not found.' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Invalid credentials.' });

  const token = jwt.sign(
    { id: user._id, email: user.email, isVerified: user.isVerified, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { name: user.name, email: user.email, isVerified: user.isVerified } });
};

// --- Resend OTP ---

exports.resendOtp = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.isVerified) return res.status(400).json({ error: 'Invalid request.' });

  // Rate limiting: only allow resend after cooldown
  if (user.otpResendAfter && user.otpResendAfter > new Date()) {
    return res.status(429).json({ error: 'Please wait before requesting another OTP.' });
  }

  // Generate and save new OTP
  const otp = generateOTP(6);
  user.otp = await bcrypt.hash(otp, 12);
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  user.otpUsed = false;
  user.otpResendAfter = new Date(Date.now() + 60 * 1000);
  await user.save();

  // Send OTP
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: email,
      subject: 'Your OTP Code',
      text: `Your new OTP code is: ${otp}\nThis code will expire in 10 minutes.`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send OTP email.' });
  }

  res.json({ message: 'OTP resent. Please check your email.' });
};

// --- Forgot Password (not implemented, but can be added) ---
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: 'Valid email required.' });
  }
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: 'User not found.' });

  // Generate secure OTP for password reset
  const otp = generateOTP(6);
  user.resetOtp = await bcrypt.hash(otp, 12);
  user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  user.resetOtpUsed = false;
  await user.save();

  // Send OTP via email
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: email,
      subject: 'Reset your password',
      text: `Your password reset OTP is: ${otp}\nThis code will expire in 10 minutes.`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send password reset email.' });
  }

  res.json({ message: 'Password reset OTP sent to your email.' });
};

// --- Reset Password (not implemented, but can be added) ---
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  const user = await User.findOne({ email });
  if (!user || !user.resetOtp || !user.resetOtpExpiry || user.resetOtpUsed) {
    return res.status(400).json({ error: 'Invalid or already used OTP.' });
  }
  if (user.resetOtpExpiry < new Date()) {
    return res.status(400).json({ error: 'OTP expired.' });
  }
  const valid = await bcrypt.compare(otp, user.resetOtp);
  if (!valid) {
    return res.status(400).json({ error: 'Invalid OTP.' });
  }

  user.password = await bcrypt.hash(newPassword, 12);
  user.resetOtp = undefined;
  user.resetOtpExpiry = undefined;
  user.resetOtpUsed = true;
  await user.save();

  res.json({ message: 'Password has been reset successfully.' });
};


// --- Fetch User Details ---
exports.getUserByEmail = async (req, res) => {
  const email = req.query.email;
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: 'Valid email required.' });
  }
  const user = await User.findOne({ email }).select('-password -otp -otpExpiry -otpResendAfter');
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    apiKeys: user.apiKeys,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  });
};


// --- Update User Details (with email reverification if changed) ---
exports.updateUserDetails = async (req, res) => {
  try {
    const email = req.user?.email || req.body.email;
    const { name, newEmail, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and current password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Verify current password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    // Update name if provided
    if (name) {
      if (!/^[a-zA-Z0-9]+$/.test(name)) {
        return res.status(400).json({ error: 'Name must be alphanumeric.' });
      }
      user.name = name;
    }

    // If email is changed, require reverification
    if (newEmail && newEmail !== user.email) {
      if (!validator.isEmail(newEmail)) {
        return res.status(400).json({ error: 'Invalid new email.' });
      }
      const emailExists = await User.findOne({ email: newEmail });
      if (emailExists) {
        return res.status(400).json({ error: 'New email is already registered.' });
      }

      // Set new email, mark as unverified, generate OTP
      user.email = newEmail;
      user.isVerified = false;
      const otp = generateOTP(6);
      user.otp = await bcrypt.hash(otp, 12);
      user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      user.otpUsed = false;
      user.otpResendAfter = new Date(Date.now() + 60 * 1000);

      // Send OTP to new email
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM,
          to: newEmail,
          subject: 'Verify your new email address',
          text: `Your OTP code is: ${otp}\nThis code will expire in 10 minutes.`,
        });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to send verification email.' });
      }
    }

    await user.save();

    if (newEmail && newEmail !== email) {
      return res.json({
        success: true,
        message: 'Email updated. Please verify your new email address.',
        requireVerification: true,
        email: user.email
      });
    }

    res.json({ success: true, message: 'User details updated successfully.', user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user details.' });
  }
};

// --- Change Password by Email ---
exports.changePassword = async (req, res) => {
  try {
    const email = req.user?.email || req.body.email;
    const { oldPassword, newPassword } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Email, old password, and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Old password is incorrect.' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
};

// --- API Key Generation (only one at a time) ---
exports.generateApiKey = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const apiKey = crypto.randomBytes(32).toString('hex');
    // Replace any existing API key(s) with the new one
    user.apiKeys = [{ key: apiKey, createdAt: new Date() }];
    await user.save();

    res.json({ apiKey });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate API key.' });
  }
};

// --- API Key Revocation ---
exports.revokeApiKey = async (req, res) => {
  try {
    const { apiKey } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.apiKeys = user.apiKeys.filter(k => k.key !== apiKey);
    await user.save();

    res.json({ message: 'API key revoked.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke API key.' });
  }
};
