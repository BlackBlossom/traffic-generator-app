import React, { useState, useEffect, use } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, KeyRound, CheckCircle, AlertTriangle, Eye, EyeOff } from "lucide-react";
// Import your API functions
import { register, login, verify, resendOtp, forgotPassword, resetPassword } from "../api/auth";

const variants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { type: "spring", damping: 18, stiffness: 120 } },
  exit: { opacity: 0, y: 32, transition: { duration: 0.2 } },
};

// Card.js
function Card({ children, className = "" }) {
  return (
    <div className={`bg-white dark:bg-[#1c1b2f]/70 border-0 border-[#598185]/40 dark:border-[#86cb92]/40
                          rounded-2xl shadow-lg dark:text-white ${className}`}>
      {children}
    </div>
  );
}

// CardHeader.js
function CardHeader({ title, subtitle }) {
  return (
    <div className="p-8 pb-4 border-b border-zinc-100 dark:border-zinc-700">
      <h2 className="text-2xl font-bold text-[#260f26] dark:text-[#86cb92] tracking-tight mb-1">{title}</h2>
      {subtitle && <p className="text-zinc-500 dark:text-zinc-400 text-sm">{subtitle}</p>}
    </div>
  );
}

// Input.js
const Input = React.forwardRef(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full px-3 py-1 pl-10 h-10 mb-1.5 border border-[#598185] dark:border-[#86cb92] rounded-lg bg-white/60 dark:bg-[#1c1b2f]/60
                focus:outline-none focus:ring-1 focus:ring-[#86cb92] transition ${className}`}
    {...props}
  />
));

// Button.js
function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium bg-purple-600 dark:bg-[#86cb92] text-white dark:text-[#232336] hover:bg-purple-500 dark:hover:bg-[#71b48d] focus:ring-2 focus:ring-purple-400 transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Alert.js
function Alert({ type = "info", children }) {
  const colors = {
    info: "bg-blue-50 dark:bg-[#1c1b2f]/40 text-blue-700",
    success: "bg-green-50 dark:bg-[#1c2b1c] text-green-700",
    error: "bg-red-50 dark:bg-[#2b1c1c] text-red-600",
    warning: "bg-yellow-50 dark:bg-[#2b241c] text-yellow-800"
  };
  return (
    <div className={`flex items-center gap-2 p-2 rounded mb-2 ${colors[type]}`}>
      {children}
    </div>
  );
}

// Label.js
function Label({ children, htmlFor, className = "" }) {
  return (
    <label htmlFor={htmlFor} className={`block text-[16px] font-semibold text-[#404e7c] dark:text-[#d0d2e5] mb-1 ${className}`}>
      {children}
    </label>
  );
}


export default function AuthPage() {
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [step, setStep] = useState("form"); // form | verify
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resetStep, setResetStep] = useState("email");
  const [resetOtp, setResetOtp] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const navigate = useNavigate();

  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  
  useEffect(() => {
    setIsDark(true); // to change it explicitly in light mode
    const root = window.document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])


  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const validate = () => {
    const errs = {}
    if (mode === 'signup') {
      if (!form.name || !/^[a-zA-Z0-9]+$/.test(form.name)) errs.name = 'Name is required (alphanumeric)'
    }
    if (!form.email || !/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(form.email)) errs.email = 'Valid email required'
    if (!form.password || form.password.length < 8) errs.password = 'Min 8 characters'
    if (mode === 'signup' && form.password !== form.confirm) errs.confirm = 'Passwords do not match'
    return errs
  }

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setFieldErrors({})
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      const res = await register(form.name, form.email, form.password)
      if (res.error || res.message?.toLowerCase().includes('error')) {
        setError(res.error || res.message)
      } else {
        // setPendingEmail(form.email)
        setStep('verify')
        setOtpMessage('OTP sent to your email. Please enter it below.')
        setSuccess('')
      }
    } else if (mode === 'login') {
      const res = await login(form.email, form.password);
      if (res.token && res.user && res.user.isVerified) {
        localStorage.setItem('token', res.token);
        setSuccess('Login successful! Redirecting...');
        setTimeout(() => navigate("/"), 800);

      } else if (res.token && res.user && res.user.isVerified === false) {
        // setPendingEmail(form.email);
        setStep('verify');
        handleResendOtp();
        setOtpMessage('Your account is not verified. Please enter the OTP sent to your email.');
        setSuccess('');
      } else {
        setError(res.error || res.message || 'Login failed');
      }
    }
    setLoading(false);
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    if (!otp || otp.length < 4) {
      setFieldErrors({ otp: 'Enter the OTP sent to your email' })
      setLoading(false)
      return
    }
    const res = await verify(otp)
    if (res.token) {
      localStorage.setItem('token', res.token)
      setSuccess('Account verified! Redirecting...')
      setTimeout(() => navigate("/"), 800)
    } else {
      setError(res.error || res.message || 'Verification failed')
    }
    setLoading(false)
  }

  const handleResendOtp = async () => {
    setOtpMessage('')
    setError('')
    setSuccess('')
    setLoading(true)
    setCooldown(60)
    const res = await resendOtp()
    if (res.message) {
      setOtpMessage('OTP resent! Please check your email.')
    } else {
      setError(res.error || res.message || 'Failed to resend OTP')
    }
    setLoading(false)
  }

  // Forgot Password Flow
  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    if (!form.email || !/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(form.email)) {
      setFieldErrors({ email: 'Valid email required' })
      setLoading(false)
      return
    }
    localStorage.setItem('rst_user_email', form.email)
    const res = await forgotPassword()
    if (res.success || res.message?.toLowerCase().includes('otp')) {
      setSuccess('OTP sent to your email for password reset.')
      setResetStep('otp')
    } else {
      setError(res.error || res.message || 'Failed to send reset OTP')
    }
    setLoading(false)
  }

  const handleResetOtpSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    if (!resetOtp || resetOtp.length < 4) {
      setFieldErrors({ resetOtp: 'Enter the OTP sent to your email' })
      setLoading(false)
      return
    }
    setResetStep('password')
    setSuccess('OTP verified. Set your new password.')
    setLoading(false)
  }

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    if (!resetNewPassword || resetNewPassword.length < 8)
      return setFieldErrors({ resetNewPassword: 'Min 8 characters' })
    if (resetNewPassword !== resetConfirmPassword)
      return setFieldErrors({ resetConfirmPassword: 'Passwords do not match' })
    const res = await resetPassword(resetOtp, resetNewPassword)
    if (res.success) {
      setSuccess('Password reset! Please login.')
      setTimeout(() => switchMode('login'), 1200)
    } else {
      setError(res.error || res.message || 'Failed to reset password')
    }
    setLoading(false)
  }

  const handleForgotResendOtp = async () => {
    setError('')
    setSuccess('')
    setLoading(true)
    setCooldown(60)
    const res = await forgotPassword()
    if (res.success || res.message?.toLowerCase().includes('otp')) {
      setSuccess('OTP resent! Please check your email.')
    } else {
      setError(res.error || res.message || 'Failed to resend OTP')
    }
    setLoading(false)
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setStep('form')
    setForm({ name: '', email: '', password: '', confirm: '' })
    setError('')
    setSuccess('')
    setOtp('')
    setOtpMessage('')
    setPendingEmail('')
    setFieldErrors({})
    setResetStep('email')
    setResetOtp('')
    setResetNewPassword('')
    setResetConfirmPassword('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-caldina bg-[#f7f5ff] dark:bg-[#333762] transition-colors duration-300">
      <motion.div
        className="w-full max-w-md p-0"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
      >
        <Card>
          <CardHeader
            title={
              step === "verify"
                ? "Verify Email"
                : mode === "login"
                ? "Sign In"
                : mode === "signup"
                ? "Sign Up"
                : "Forgot Password"
            }
            subtitle={
              step === "verify"
                ? "Enter the OTP sent to your email."
                : mode === "login"
                ? "Welcome back! Please enter your details."
                : mode === "signup"
                ? "Create your account to get started."
                : resetStep === "email"
                ? "Enter your registered email to reset password."
                : resetStep === "otp"
                ? "Enter the OTP sent to your email."
                : "Set your new password."
            }
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={step + mode + resetStep}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={variants}
              className="p-8 pt-4 space-y-4"
            >
              {/* Feedback */}
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Alert type="error">
                      <AlertTriangle className="w-5 h-5" />
                      <span>{error}</span>
                    </Alert>
                  </motion.div>
                )}
                {success && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Alert type="success">
                      <CheckCircle className="w-5 h-5" />
                      <span>{success}</span>
                    </Alert>
                  </motion.div>
                )}
                {otpMessage && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Alert type="info">
                      <KeyRound className="w-5 h-5" />
                      <span>{otpMessage}</span>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Form Section */}
              {step === "verify" ? (
                <form onSubmit={handleVerify} className="space-y-4">
                  <div>
                    <Label htmlFor="otp">OTP Code</Label>
                    <div className="relative flex items-center">
                      <KeyRound className="w-5 h-5 absolute left-[10px] top-[10px] text-purple-400" />
                      <Input
                        id="otp"
                        name="otp"
                        placeholder="Enter OTP"
                        type="text"
                        autoFocus
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={6}
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className={fieldErrors.otp ? "border-red-500" : ""}
                      />
                    </div>
                    {fieldErrors.otp && <div className="text-xs text-red-500 mt-1">{fieldErrors.otp}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={loading}>
                      {loading ? <span className="animate-spin">⏳</span> : "Verify"}
                    </Button>
                    <button
                      type="button"
                      variant="ghost"
                      className="underline px-2 text-purple-600 dark:text-[#86cb92]"
                      onClick={handleResendOtp}
                      disabled={loading || cooldown > 0}
                    >
                      {cooldown > 0 ? `Resend OTP (${cooldown}s)` : "Resend OTP"}
                    </button>
                  </div>
                  <button type="button" variant="ghost" className="w-full mt-2 text-zinc-500 underline" onClick={() => {setMode("login"); setError(''); setSuccess(''); setOtpMessage(''); setFieldErrors({}); setStep('form');}}>
                    Back to Login
                  </button>
                </form>
              ) : mode === "forgot" ? (
                <form
                  onSubmit={
                    resetStep === "email"
                      ? handleForgotSubmit
                      : resetStep === "otp"
                      ? handleResetOtpSubmit
                      : handleResetPasswordSubmit
                  }
                  className="space-y-4"
                >
                  {resetStep === "email" && (
                    <div>
                      <Label htmlFor="email">Registered Email</Label>
                      <div className="relative flex items-center">
                        <Mail className="w-5 h-5 absolute left-[10px] top-[9px] text-purple-400" />
                        <Input
                          id="email"
                          name="email"
                          placeholder="Enter your registered email"
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={handleChange}
                          className={fieldErrors.email ? "border-red-500" : ""}
                        />
                      </div>
                      {fieldErrors.email && <div className="text-xs text-red-500 mt-1">{fieldErrors.email}</div>}
                    </div>
                  )}
                  {resetStep === "otp" && (
                    <div>
                      <Label htmlFor="resetOtp">OTP Code</Label>
                      <div className="relative flex items-center">
                        <KeyRound className="w-5 h-5 absolute left-[10px] top-[10px] text-purple-400" />
                        <Input
                          id="resetOtp"
                          name="resetOtp"
                          placeholder="Enter OTP"
                          type="text"
                          autoFocus
                          inputMode="numeric"
                          pattern="\d*"
                          maxLength={6}
                          value={resetOtp}
                          onChange={e => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className={fieldErrors.resetOtp ? "border-red-500" : ""}
                        />
                      </div>
                      {fieldErrors.resetOtp && <div className="text-xs text-red-500 mt-1">{fieldErrors.resetOtp}</div>}
                      <button
                        type="button"
                        variant="ghost"
                        className="underline mt-1 px-2 text-purple-600 dark:text-[#86cb92]"
                        onClick={handleForgotResendOtp}
                        disabled={loading || cooldown > 0}
                      >
                        {cooldown > 0 ? `Resend OTP (${cooldown}s)` : "Resend OTP"}
                      </button>
                    </div>
                  )}
                  {resetStep === "password" && (
                    <>
                      <div>
                        <Label htmlFor="resetNewPassword">New Password</Label>
                        <div className="relative flex items-center">
                          <Lock className="w-5 h-5 absolute left-[10px] top-[9px] text-purple-400" />
                          <Input
                            id="resetNewPassword"
                            name="resetNewPassword"
                            placeholder="Enter new password"
                            type="password"
                            autoComplete="new-password"
                            value={resetNewPassword}
                            onChange={e => setResetNewPassword(e.target.value)}
                            className={fieldErrors.resetNewPassword ? "border-red-500" : ""}
                          />
                        </div>
                        {fieldErrors.resetNewPassword && <div className="text-xs text-red-500 mt-1">{fieldErrors.resetNewPassword}</div>}
                      </div>
                      <div>
                        <Label htmlFor="resetConfirmPassword">Confirm New Password</Label>
                        <div className="relative flex items-center">
                          <Lock className="w-5 h-5 absolute left-[10px] top-[9px] text-purple-400" />
                          <Input
                            id="resetConfirmPassword"
                            name="resetConfirmPassword"
                            placeholder="Confirm new password"
                            type="password"
                            autoComplete="new-password"
                            value={resetConfirmPassword}
                            onChange={e => setResetConfirmPassword(e.target.value)}
                            className={fieldErrors.resetConfirmPassword ? "border-red-500" : ""}
                          />
                        </div>
                        {fieldErrors.resetConfirmPassword && <div className="text-xs text-red-500 mt-1">{fieldErrors.resetConfirmPassword}</div>}
                      </div>
                    </>
                  )}
                  <Button type="submit" className="w-full mt-2" disabled={loading}>
                    {loading
                      ? <span className="animate-spin">⏳</span>
                      : resetStep === "email"
                      ? "Send OTP"
                      : resetStep === "otp"
                      ? "Verify OTP"
                      : "Reset Password"}
                  </Button>
                  {/* <button type="button" variant="ghost" className="w-full text-zinc-500 underline" onClick={() => {setMode("login"); setError(''); setSuccess(''); setOtpMessage(''); setFieldErrors({}); setStep('form');}}>
                    Back to Login
                  </button> */}
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "signup" && (
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <div className="relative flex items-center">
                        <User className="w-5 h-5 absolute left-[10px] top-[9px] text-purple-400" />
                        <Input
                          id="name"
                          name="name"
                          placeholder="Enter your name"
                          type="text"
                          autoComplete="username"
                          value={form.name}
                          onChange={handleChange}
                          className={fieldErrors.name ? "border-red-500" : ""}
                        />
                      </div>
                      {fieldErrors.name && <div className="text-xs text-red-500 mt-1">{fieldErrors.name}</div>}
                    </div>
                  )}
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative flex items-center">
                      <Mail className="w-5 h-5 absolute left-[10px] top-[9px] text-purple-400" />
                      <Input
                        id="email"
                        name="email"
                        placeholder="Enter your email"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={handleChange}
                        className={fieldErrors.email ? "border-red-500" : ""}
                      />
                    </div>
                    {fieldErrors.email && <div className="text-xs text-red-500 mt-1">{fieldErrors.email}</div>}
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative flex items-center">
                      <Lock className="w-5 h-5 absolute left-[11px] top-[9px] text-purple-400" />
                      <Input
                        id="password"
                        name="password"
                        placeholder="Enter your password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        value={form.password}
                        onChange={handleChange}
                        className={fieldErrors.password ? "border-red-500" : ""}
                      />
                      <button
                        type="button"
                        className="absolute right-[10px] top-[10px] text-purple-400"
                        tabIndex={-1}
                        onClick={() => setShowPassword(v => !v)}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {fieldErrors.password && <div className="text-xs text-red-500 mt-1">{fieldErrors.password}</div>}
                  </div>
                  {mode === "login" && (
                    <div className="text-right -mt-3">
                      <button type="button" variant="ghost" className="underline text-purple-600 dark:text-[#86cb92] text-sm" 
                        onClick={() => {
                          setMode("forgot");
                          setError('');
                          setSuccess('');
                          setOtpMessage('');
                          setFieldErrors({});
                          setStep('form');
                          setForm({ email: '', password: '' });
                          setResetNewPassword('');
                          setResetConfirmPassword('');
                          setResetStep('email');
                          setResetOtp('');
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                  {mode === "signup" && (
                    <div>
                      <Label htmlFor="confirm">Confirm Password</Label>
                      <div className="relative flex items-center">
                        <Lock className="w-5 h-5 absolute left-[10px] top-[9px] text-purple-400" />
                        <Input
                          id="confirm"
                          name="confirm"
                          placeholder="Confirm your password"
                          type="password"
                          autoComplete="new-password"
                          value={form.confirm}
                          onChange={handleChange}
                          className={fieldErrors.confirm ? "border-red-500" : ""}
                        />
                      </div>
                      {fieldErrors.confirm && <div className="text-xs text-red-500 mt-1">{fieldErrors.confirm}</div>}
                    </div>
                  )}
                  <Button type="submit" className="w-full mt-2" disabled={loading}>
                    {loading
                      ? <span className="animate-spin">⏳</span>
                      : mode === "login"
                      ? "Sign In"
                      : "Sign Up"}
                  </Button>
                </form>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer Switch */}
          <div className="p-6 pt-2 text-center text-sm border-t border-zinc-100 dark:border-zinc-700">
            {mode === "login" ? (
              <>
                <span className="dark:text-[#f7f5ff]">Don&apos;t have an account?{" "}</span>
                <button
                  className="underline text-purple-600 hover:text-purple-500 dark:text-[#86cb92] font-medium"
                  onClick={() => {setMode("signup"); setError(''); setSuccess(''); setOtpMessage(''); setFieldErrors({}); setStep('form'); setForm({ name: '', email: '', password: '', confirm: '' });}}
                >
                  Sign up
                </button>
              </>
            ) : mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  className="underline text-purple-600 hover:text-purple-500 dark:text-[#86cb92] font-medium"
                  onClick={() => {setMode("login"); setError(''); setSuccess(''); setOtpMessage(''); setFieldErrors({}); setStep('form'); setForm({ email: '', password: '' });}}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Remembered your password?{" "}
                <button
                  className="underline text-purple-600 hover:text-purple-500 dark:text-[#86cb92] font-medium"
                  onClick={() => setMode("login")}
                >
                  Back to Login
                </button>
              </>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
