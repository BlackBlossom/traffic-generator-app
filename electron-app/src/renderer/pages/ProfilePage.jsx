import React, { useState, useEffect, use } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  PencilIcon, XMarkIcon, EyeIcon, EyeSlashIcon, KeyIcon,
  ArrowRightEndOnRectangleIcon, EnvelopeIcon, UserCircleIcon, ShieldCheckIcon, PlusIcon,
  ComputerDesktopIcon
} from "@heroicons/react/24/outline";
import {
  getUserByEmail, updateUserDetails, changePassword, generateApiKey,
  revokeApiKey, verify, resendOtp,
} from "../api/auth";
import { useUser } from "../context/UserContext";
import ToggleSwitch from "../components/ToggleSwitch";

const COLORS = {
  emerald: "#86cb92",
  mint: "#71b48d",
  myrtle: "#598185",
  yinmn: "#404e7c",
  delft: "#333762",
  space: "#251f47",
  dark: "#260f26",
};

const cn = (...classes) => classes.filter(Boolean).join(" ");

const Label = ({ children }) => (
  <label className="block text-[15px] font-bold text-[#404e7c] dark:text-[#d0d2e5] mb-1">
    {children}
  </label>
);
const CustomInput = React.forwardRef(({ label, icon, ...props }, ref) => (
  <div className="flex flex-col w-full relative">
    {label && <Label>{label}</Label>}
    <div className="relative flex items-center">
      <input
        ref={ref}
        {...props}
        className="h-11 w-full px-2 border-[1px] border-b-2 border-[#598185]/40 dark:border-[#86cb92]/40 rounded-lg
          bg-[#f7f5ff]/50 dark:bg-[#1c1b2f]/90 text-[#260f26] dark:text-[#d0d2e5]
          focus:outline-none focus:border-[#86cb92] focus:ring-0 transition font-medium text-base"
      />
      {icon && (
        <span className="absolute right-3 inset-y-0 flex items-center h-full">
          {icon}
        </span>
      )}
    </div>
  </div>
));
CustomInput.displayName = "CustomInput";

function AnimatedButton({ onClick, className, icon, label, disabled, type = "button", children }) {
  return (
    <motion.button
      type={type}
      whileHover={!disabled ? { scale: 1.0 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      onClick={onClick}
      className={className}
      disabled={disabled}
      style={{ transition: "all 0.15s" }}
    >
      {icon}
      {label && <span className="ml-1">{label}</span>}
      {children}
    </motion.button>
  );
}

// Edit Profile Modal
function EditProfileModal({ open, onClose, fields, setFields, password, setPassword, onSave, loading }) {
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const input = document.querySelector("#edit-name");
        if (input) input.focus();
      }, 100);
    }
  }, [open]);

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 mt-8 h-full flex items-center justify-center bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white dark:bg-[#1c1b2f] rounded-2xl shadow-2xl p-8 w-[370px] relative"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 180, damping: 22 } }}
          exit={{ scale: 0.92, opacity: 0, transition: { duration: 0.18 } }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#22223a]"
            onClick={onClose}
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-[#598185]" />
          </button>
          <h2 className="text-xl font-bold mb-6 text-[#260f26] dark:text-[#86cb92]">Edit Profile</h2>
          <div className="space-y-5">
            <CustomInput
              id="edit-name"
              name="name"
              label="Full Name"
              value={fields.name}
              onChange={e => setFields(f => ({ ...f, name: e.target.value }))}
            />
            <CustomInput
              name="email"
              label="Email"
              value={fields.email}
              onChange={e => setFields(f => ({ ...f, email: e.target.value }))}
            />
            <CustomInput
              name="password"
              label="Current Password"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              icon={
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="ml-2 text-mint"
                  tabIndex={-1}
                >
                  {showPass ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              }
            />
          </div>
          <div className="flex gap-2 justify-end mt-8">
            <AnimatedButton
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600 rounded"
              label="Cancel"
              disabled={loading}
            />
            <AnimatedButton
              onClick={onSave}
              className="px-4 py-2 bg-mint text-white rounded hover:bg-emerald"
              label={loading ? "Saving..." : "Save"}
              disabled={loading}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Password Change Dialog
function PasswordDialog({ open, onClose, onChange }) {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [show, setShow] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);


  const handleSubmit = () => {
    if (!oldPass || !newPass || !confirmPass) return;
    if (newPass !== confirmPass) return;
    onChange(oldPass, newPass);
    setOldPass("");
    setNewPass("");
    setConfirmPass("");
  };

  useEffect(() => {
    if (!open) {
      setOldPass("");
      setNewPass("");
      setConfirmPass("");
    }
  }, [open]);

  if (!open) return null;
  return (
    <AnimatePresence>
    <motion.div
        className="fixed inset-0 z-50 mt-8 h-full flex items-center justify-center bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
    >
      <motion.div
          className="bg-white dark:bg-[#1c1b2f] rounded-2xl shadow-2xl p-8 w-[370px] relative"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 180, damping: 22 } }}
          exit={{ scale: 0.92, opacity: 0, transition: { duration: 0.18 } }}
          onClick={e => e.stopPropagation()}
        >
        <button
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#22223a]"
            onClick={onClose}
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-[#598185]" />
          </button>
        <h2 className="text-xl font-bold mb-6 text-[#260f26] dark:text-[#86cb92]">Change Password</h2>
        <div className="space-y-4">
          <CustomInput
            type={show ? "text" : "password"}
            value={oldPass}
            onChange={e => setOldPass(e.target.value)}
            placeholder="Current Password"
            icon={
              <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="ml-2 text-mint"
                  tabIndex={-1}
                >
                  {show ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
            }
          />
          <CustomInput
            type={showNew ? "text" : "password"}
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            placeholder="New Password"
            icon={
              <button
                  type="button"
                  onClick={() => setShowNew(s => !s)}
                  className="ml-2 text-mint"
                  tabIndex={-1}
                >
                  {showNew ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
            }
          />
          <CustomInput
            type={showConfirm ? "text" : "password"}
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
            placeholder="Confirm New Password"
            icon={
              <button
                  type="button"
                  onClick={() => setShowConfirm(s => !s)}
                  className="ml-2 text-mint"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
            }
          />
        </div>
        <div className="flex gap-3 justify-end mt-8">
          <AnimatedButton
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600 rounded"
            label="Cancel"
          />
          <AnimatedButton
            onClick={handleSubmit}
            className="px-4 py-2 bg-mint text-white rounded hover:bg-emerald"
            label="Confirm"
          />
        </div>
      </motion.div>
    </motion.div>
    </AnimatePresence>
  );
}

// OTP Dialog
function OtpDialog({ open, onClose, otp, setOtp, onVerify, onResend, loading }) {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    setOtp("");
    setCooldown(0);
  }, [open, setOtp]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  if (!open) return null;
  return (
    <motion.div
      className="fixed inset-0 bg-black/50 mt-8 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white/98 dark:bg-[#1c1b2f]/98 p-8 rounded-2xl w-[370px] shadow-2xl"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
      >
        <h2 className="text-xl font-bold mb-4 text-[#86cb92]">Verify Email</h2>
        <CustomInput
          value={otp}
          onChange={e => {
            // Only allow digits
            const val = e.target.value.replace(/\D/g, "");
            setOtp(val);
          }}
          inputMode="numeric"
          pattern="\d*"
          placeholder="Enter 6-digit OTP"
          maxLength={6}
        />
        <div className="text-right">
          <AnimatedButton
            className="text-purple-600 dark:text-[#86cb92] text-sm hover:underline"
            onClick={() => {
              setCooldown(60);
              onResend();
            }}
            label={cooldown > 0 ? `Resend OTP (${cooldown}s)` : "Resend OTP"}
            disabled={cooldown > 0}
          />
        </div>
        <div className="flex-1 gap-3 mt-8">
          <AnimatedButton
            onClick={onVerify}
            className="px-4 py-2 w-full bg-emerald text-white rounded hover:bg-mint"
            label={loading ? "Verifying..." : "Verify"}
            disabled={loading}
          />
          <AnimatedButton
            onClick={onClose}
            className="px-4 py-2 w-full text-gray-700 dark:text-gray-300 hover:underline rounded"
            label="Cancel"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ProfilePage() {
  const { user, setUser, loading } = useUser();
  const [editModal, setEditModal] = useState(false);
  const [fields, setFields] = useState({ name: "", email: "" });
  const [password, setPassword] = useState("");
  const [isPasswordDialog, setIsPasswordDialog] = useState(false);
  const [isOtpDialog, setIsOtpDialog] = useState(false);
  const [otp, setOtp] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", type: "success" });
  const [profileLoading, setProfileLoading] = useState(true);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyReveal, setApiKeyReveal] = useState(false);
  const [startupEnabled, setStartupEnabled] = useState(false);
  const [startupLoading, setStartupLoading] = useState(false);
  const token = localStorage.getItem("token");
  const location = useLocation();

  useEffect(() => {
    if (user) {
      setFields({ name: user?.name, email: user?.email });
    } else {
      setFields({ name: "", email: "" });
    }
    setProfileLoading(false);
  }, [user]);

  useEffect(() => {
    // Load startup status when component mounts
    const loadStartupStatus = async () => {
      try {
        const result = await window.electronAPI.getStartupEnabled();
        if (result.success) {
          setStartupEnabled(result.enabled);
        }
      } catch (error) {
        console.error('Failed to load startup status:', error);
      }
    };
    
    loadStartupStatus();
  }, []);

  useEffect(() => {
    // Try main container first
    const scroller = document.querySelector('.main-scrollable');
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname]);


  const showToast = (message, type = "success") => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false }), 2800);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("rst_user_email");
    window.location.href = "/login";
  };

  const handleProfileSave = async () => {
    if (!password) {
      showToast("Current password required.", "error");
      return;
    }
    setProfileLoading(true);
    const res = await updateUserDetails({
      name: fields.name,
      newEmail: fields.email,
      password,
      token,
    });
    setProfileLoading(false);
    if (res.requireVerification) {
      setIsOtpDialog(true);
      showToast(res.message, "info");
      setEditModal(false);
      setPassword("");
    } else if (res.success) {
      setUser((u) => ({
        ...u,
        name: fields.name,
        email: fields.email,
      }));
      showToast("Profile updated!", "success");
      setEditModal(false);
      setPassword("");
    } else {
      showToast(res.message, "error");
    }
  };

  const handlePasswordChange = async (oldPassword, newPassword) => {
    setProfileLoading(true);
    const res = await changePassword({ oldPassword, newPassword, token });
    setProfileLoading(false);
    if (res.success) {
      showToast("Password changed!", "success");
      setIsPasswordDialog(false);
    } else {
      showToast(res.message, "error");
    }
  };

  const handleOtpVerify = async () => {
    setProfileLoading(true);
    const res = await verify(otp);
    setProfileLoading(false);
    if (res.token) {
      localStorage.setItem("token", res.token);
      setUser((u) => ({ ...u, isVerified: true }));
      showToast("Email verified!", "success");
      setIsOtpDialog(false);
    } else {
      showToast(res.message, "error");
    }
  };

  const handleApiKeyGenerate = async () => {
    setApiKeyLoading(true);
    const res = await generateApiKey(token);
    setApiKeyLoading(false);
    if (res.apiKey) {
      setUser((u) => ({ ...u, apiKeys: [{ key: res.apiKey, createdAt: new Date() }] }));
      showToast("API key generated!", "success");
    } else {
      showToast(res.message, "error");
    }
  };
  const handleApiKeyRevoke = async () => {
    setApiKeyLoading(true);
    const apiKey = user.apiKeys?.[0]?.key;
    const res = await revokeApiKey(apiKey, token);
    setApiKeyLoading(false);
    if (res.success) {
      setUser((u) => ({ ...u, apiKeys: [] }));
      showToast("API key revoked.", "info");
    } else {
      showToast(res.message, "error");
    }
  };

  const handleStartupToggle = async (enable) => {
    setStartupLoading(true);
    try {
      const result = await window.electronAPI.setStartupEnabled(enable);
      if (result.success) {
        setStartupEnabled(enable);
        showToast(
          enable 
            ? "App will now start at login" 
            : "App will no longer start at login", 
          "success"
        );
      } else {
        showToast("Failed to update startup setting", "error");
      }
    } catch (error) {
      console.error('Failed to toggle startup:', error);
      showToast("Failed to update startup setting", "error");
    } finally {
      setStartupLoading(false);
    }
  };

  
  if (profileLoading || !user)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-emerald-400"></div>
      </div>
    );

  return (
    <div className="flex justify-center min-h-[calc(100vh-2.5rem)] pt-20">
      <motion.section
        layout
        layoutId="profile-card"
        className="relative bg-white/98 dark:bg-[#1c1b2f]/70 border-0 border-[#598185]/40 dark:border-[#86cb92]/40
          rounded-2xl shadow-2xl px-8 py-10 space-y-10 max-w-xl h-full w-full flex flex-col"
        initial={{ opacity: 0, y: 32, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 140, damping: 22 } }}
        exit={{ opacity: 0, y: 32, scale: 0.98, transition: { duration: 0.2 } }}
      >
        {/* Floating Log Out Button */}
        <motion.button
          onClick={handleLogout}
          className="absolute top-6 right-6 p-2 rounded-full bg-[#eaeaff] dark:bg-[#333762] text-[#404e7c] dark:text-[#d0d2e5] hover:bg-[#d0d2e5] hover:dark:bg-[#404e7c] shadow transition group"
          whileHover={{ scale: 1.12 }}
          title="Log Out"
        >
          <ArrowRightEndOnRectangleIcon className="w-6 h-6" />
        </motion.button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <UserCircleIcon className="w-14 h-14 text-mint" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-[#260f26] dark:text-[#86cb92]">{user.name}</span>
              <button
                onClick={() => setEditModal(true)}
                className="flex items-center gap-1 text-yinmn dark:text-mint hover:text-emerald font-medium text-sm px-2 py-1 rounded transition"
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </button>
            </div>
            <span className="flex items-center gap-2 text-yinmn dark:text-mint text-sm">
              <EnvelopeIcon className="w-4 h-4" />
              {user.email}
              {user.isVerified && (
                <ShieldCheckIcon className="w-5 h-5 text-mint ml-1" title="Verified" />
              )}
              {!user.isVerified && (
                <span className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs">Unverified</span>
              )}
            </span>
          </div>
        </div>

        {/* Edit Modal */}
        <EditProfileModal
          open={editModal}
          onClose={() => setEditModal(false)}
          fields={fields}
          setFields={setFields}
          password={password}
          setPassword={setPassword}
          onSave={handleProfileSave}
          loading={profileLoading}
        />

        {/* Feedback */}
        <AnimatePresence>
          {toast.open && (
            <motion.div
              layout
              key={toast.message}
              className={cn(
                "fixed top-20 right-6 px-4 py-2 rounded shadow-lg z-50",
                toast.type === "success"
                  ? "bg-emerald-600 text-white"
                  : toast.type === "error"
                  ? "bg-red-600 text-white"
                  : "bg-mint text-white"
              )}
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 120, damping: 22 } }}
              exit={{ opacity: 0, y: -24, scale: 0.95, transition: { duration: 0.18 } }}
            >
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Divider */}
        <div className="w-full border-t border-[#598185]/20 dark:border-[#86cb92]/20"></div>

        {/* API Key Section */}
        <motion.div layout className="w-full flex flex-col gap-4 items-center">
          <div className="flex items-center self-start pl-4 gap-2 text-lg font-semibold text-[#260f26] dark:text-[#86cb92]">
            <KeyIcon className="w-5 h-5" /> API Key
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3 w-full">
            <CustomInput
              value={user.apiKeys?.[0]?.key || ""}
              readOnly
              type={apiKeyReveal ? "text" : "password"}
              className="w-full md:w-64 px-2 py-1 rounded border bg-mint/10 text-mint"
            />
            {user.apiKeys?.length > 0 ? (
              <div className="flex gap-2">
                <AnimatedButton
                  onClick={() => setApiKeyReveal((v) => !v)}
                  className="px-2 py-1 rounded bg-mint/20 dark:text-white text-yinmn font-semibold hover:bg-mint/40 transition"
                  icon={apiKeyReveal ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                />
                <AnimatedButton
                  onClick={() => navigator.clipboard.writeText(user.apiKeys?.[0]?.key || "")}
                  className="px-2 py-1 rounded bg-myrtle text-white font-semibold hover:bg-mint transition"
                  label="Copy"
                />
                <AnimatedButton
                  onClick={async () => {
                    setApiKeyLoading(true);
                    await handleApiKeyRevoke();
                    setApiKeyLoading(false);
                  }}
                  className="px-2 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition"
                  label={apiKeyLoading ? "Revoking..." : "Revoke"}
                  disabled={apiKeyLoading}
                />
              </div>
            ) : (
              <AnimatedButton
                onClick={async () => {
                  setApiKeyLoading(true);
                  await handleApiKeyGenerate();
                  setApiKeyLoading(false);
                }}
                className="flex items-center gap-2 px-2 py-2 w-[300px] rounded bg-mint text-white font-semibold hover:bg-emerald transition mt-2 md:mt-0"
                label={apiKeyLoading ? "Generating..." : "Generate API Key"}
                icon={<PlusIcon className="w-5 h-5" />}
                disabled={apiKeyLoading}
              />
            )}
          </div>
        </motion.div>

        {/* Divider */}
        <div className="w-full border-t border-[#598185]/20 dark:border-[#86cb92]/20"></div>

        {/* Startup Settings Section */}
        <motion.div layout className="w-full flex flex-col gap-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-[#260f26] dark:text-[#86cb92]">
            <ComputerDesktopIcon className="w-5 h-5" /> 
            Startup Settings
          </div>
          <div className="px-4">
            <ToggleSwitch
              enabled={startupEnabled}
              onToggle={handleStartupToggle}
              disabled={startupLoading}
              label="Start app at login"
              description="Automatically launch RST when you log into your computer"
            />
          </div>
        </motion.div>

        {/* Divider */}
        <div className="w-full border-t border-[#598185]/20 dark:border-[#86cb92]/20"></div>

        {/* Password Change */}
        <div className="w-full">
          <AnimatedButton
            onClick={() => setIsPasswordDialog(true)}
            className="w-full py-3 rounded-xl bg-yinmn text-white font-semibold hover:bg-space transition"
            label="Change Password"
          />
        </div>

        {/* Timestamps */}
        <div className="text-xs text-myrtle mt-4 text-center">
          Created: {new Date(user.createdAt).toLocaleString()}
          <br />
          Updated: {new Date(user.updatedAt).toLocaleString()}
        </div>

        {/* Password Dialog */}
        <AnimatePresence>
          {isPasswordDialog && (
            <PasswordDialog
              open={isPasswordDialog}
              onClose={() => setIsPasswordDialog(false)}
              onChange={handlePasswordChange}
            />
          )}
        </AnimatePresence>

        {/* OTP Dialog */}
        <AnimatePresence>
          {isOtpDialog && (
            <OtpDialog
              open={isOtpDialog}
              onClose={() => setIsOtpDialog(false)}
              otp={otp}
              setOtp={setOtp}
              onVerify={handleOtpVerify}
              onResend={resendOtp}
              loading={profileLoading}
            />
          )}
        </AnimatePresence>
      </motion.section>
    </div>
  );
}