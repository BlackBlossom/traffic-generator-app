// src/renderer/pages/ProxyManagement.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, Transition } from "@headlessui/react";
import {
  ShieldCheckIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  ArrowUpOnSquareIcon,
  ArrowDownOnSquareIcon,
  ArrowDownTrayIcon,
  LinkIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon,
  CheckBadgeIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { sectionVariants, fieldVariants } from "../animations";

// Utility
const cn = (...classes) => classes.filter(Boolean).join(" ");

// Mini components
const Label = ({ children }) => (
  <label className="block text-sm font-bold text-[#404e7c] dark:text-[#d0d2e5] mb-1">
    {children}
  </label>
);

const Input = React.forwardRef(({ label, error, ...props }, ref) => (
  <div className="flex flex-col gap-1 mb-4">
    {label && <Label>{label}</Label>}
    {error && <span className="text-xs text-red-500">{error}</span>}
    <input
      ref={ref}
      {...props}
      className="h-10 px-3 border border-[#598185] dark:border-[#86cb92] rounded-lg bg-white/70 dark:bg-[#1c1b2f]/70
                 focus:outline-none focus:ring-2 focus:ring-[#86cb92] transition"
    />
  </div>
));
Input.displayName = "Input";

const Textarea = React.forwardRef(({ label, ...props }, ref) => (
  <div className="flex flex-col gap-1">
    {label && <Label>{label}</Label>}
    <textarea
      ref={ref}
      {...props}
      className="min-h-[100px] p-2 border border-[#598185] dark:border-[#86cb92] rounded-lg bg-white/70 dark:bg-[#1c1b2f]/70
                 focus:outline-none focus:ring-2 focus:ring-[#86cb92] transition"
    />
  </div>
));
Textarea.displayName = "Textarea";

const Switch = ({ label, checked, onChange }) => (
  <label className="inline-flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
    <span
      className={cn(
        "w-10 h-5 rounded-full p-[2px] flex items-center transition",
        checked ? "bg-[#598185]" : "bg-[#eaeaff] dark:bg-[#333762]"
      )}
    >
      <span
        className={cn(
          "block w-4 h-4 bg-white rounded-full shadow transform transition",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </span>
    {label && <span className="text-sm text-[#404e7c] dark:text-[#d0d2e5]">{label}</span>}
  </label>
);

const StatCard = ({ label, value, icon: Icon, custom = 0 }) => (
  <motion.div
    className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#333762] shadow border border-[#e5e5e5] dark:border-[#23243a]/60"
    variants={fieldVariants}
    initial="hidden"
    animate="visible"
    custom={custom}
  >
    <div className="bg-[#86cb92]/20 dark:bg-[#404e7c]/40 p-2 rounded-lg">
      <Icon className="w-6 h-6 text-[#598185] dark:text-[#86cb92]" />
    </div>
    <div>
      <div className="text-xs text-[#404e7c] dark:text-[#b0b0c3]">{label}</div>
      <div className="text-2xl font-bold text-[#260f26] dark:text-[#86cb92]">{value}</div>
    </div>
  </motion.div>
);

const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-full font-medium text-base transition",
      active
        ? "bg-[#86cb92] text-[#251f47] shadow"
        : "text-[#404e7c] dark:text-[#86cb92] hover:bg-[#71b48d]/10"
    )}
  >
    <Icon className="w-5 h-5" />
    {label}
  </button>
);

const MODES = [
  { label: "Imported", value: "imported" },
  { label: "Local", value: "local" },
];

// Main Page
export default function ProxyManagement() {
  // State
  const [tab, setTab] = useState("input");
  const [proxyText, setProxyText] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [refreshInterval, setRefreshInterval] = useState(() => Number(localStorage.getItem("refreshInterval") || 6));
  const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem("autoRefresh") === "true");
  const [proxyMode, setProxyMode] = useState(() => localStorage.getItem("proxyMode") || "imported");
  const [status, setStatus] = useState({ total: 0, working: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [showScrapeDialog, setShowScrapeDialog] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    // Try main container first
    const scroller = document.querySelector('.main-scrollable');
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname]);

  // Scraper Logic
  useEffect(() => {
    let tid;
    if (autoRefresh) {
      tid = setInterval(scrapeProxies, refreshInterval * 3600 * 1000);
    }
    return () => clearInterval(tid);
  }, [autoRefresh, refreshInterval]);

  function handleScrapeNowClick() {
    setShowScrapeDialog(true);
  }
  function confirmScrape() {
    setShowScrapeDialog(false);
    scrapeProxies();
  }

  // Load from URL handler
  async function handleLoadFromUrl(e) {
    e?.preventDefault?.();
    if (!importUrl.trim()) {
      setUrlError("Please enter a URL before loading.");
      return;
    }
    setUrlError("");
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const resp = await fetch(importUrl);
      if (!resp.ok) throw new Error(`Import URL returned ${resp.status}`);
      const txt = await resp.text();
      const lines = txt.trim().split("\n").filter(Boolean);
      setProxyText(lines.join("\n"));
      setStatus({ total: lines.length, working: lines.length });
      setHistory((h) => [
        { type: "url", count: lines.length, date: new Date(), url: importUrl },
        ...h,
      ]);
      setSuccess("Proxies loaded from URL.");
    } catch (e) {
      setError("Failed to load from your URL.");
    }
    setLoading(false);
  }

  async function scrapeProxies() {
    setLoading(true);
    setError("");
    setSuccess("");
    let lines = [];

    try {
      const resp = await fetch(
        "https://api.proxyscrape.com/v2/?request=displayproxies" +
          "&protocol=http" +
          "&timeout=10000" +
          "&country=all" +
          "&ssl=all" +
          "&anonymity=all" +
          "&skip=0" +
          "&limit=2000"
      );
      // const resp = await axios.get('https://www.proxy-list.download/api/v1/get?type=http');
      if (!resp.ok) throw new Error(`Public scraper returned ${resp.status}`);
      const txt = await resp.text();
      lines = txt.trim().split("\n").filter(Boolean);
      setHistory((h) => [
        { type: "scrape", count: lines.length, date: new Date() },
        ...h,
      ]);
      setSuccess("Proxies scraped successfully.");
    } catch (e) {
      setError("Public scraper unavailable. Please try again later or use your own URL.");
    }

    setProxyText(lines.join("\n"));
    setStatus({ total: lines.length, working: lines.length });
    setLoading(false);
  }

  // Functionalities
  function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setProxyText(text);
      setHistory((h) => [
        { type: "upload", count: text.split("\n").filter(Boolean).length, date: new Date(), file: file.name },
        ...h,
      ]);
      setSuccess("Proxies uploaded.");
    };
    reader.readAsText(file);
  }
  function handleDownload() {
    if (!proxyText) return;
    const blob = new Blob([proxyText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "proxies.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleSave() {
    localStorage.setItem("proxies", proxyText);
    setHistory((h) => [
      { type: "save", count: proxyText.split("\n").filter(Boolean).length, date: new Date() },
      ...h,
    ]);
    setSuccess("Proxies saved to browser.");
  }
  function handleCopy() {
    navigator.clipboard.writeText(proxyText);
    setSuccess("Copied to clipboard!");
  }

  // Settings persistence
  useEffect(() => {
    localStorage.setItem("refreshInterval", refreshInterval);
  }, [refreshInterval]);
  useEffect(() => {
    localStorage.setItem("autoRefresh", autoRefresh);
  }, [autoRefresh]);
  useEffect(() => {
    localStorage.setItem("proxyMode", proxyMode);
  }, [proxyMode]);

  // Layout
  return (
    <motion.div
      className="space-y-10 p-6"
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
    >
      {/* Page Heading */}
      <motion.div variants={sectionVariants} custom={0}>
        <h1 className="text-3xl font-extrabold text-[#260f26] dark:text-[#86cb92]">
          Proxy Management
        </h1>
        <p className="text-lg text-[#598185] dark:text-[#d0d2e5]">
          Import, scrape, and manage proxies for your campaigns.
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        <TabButton
          active={tab === "input"}
          onClick={() => setTab("input")}
          icon={Bars3Icon}
          label="Input"
        />
        <TabButton
          active={tab === "status"}
          onClick={() => setTab("status")}
          icon={CheckBadgeIcon}
          label="Status"
        />
        <TabButton
          active={tab === "settings"}
          onClick={() => setTab("settings")}
          icon={Cog6ToothIcon}
          label="Settings"
        />
      </div>

      {/* Animated Section */}
      <AnimatePresence mode="wait">
        {tab === "input" && (
          <motion.section
            key="input"
            variants={sectionVariants}
            custom={1}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="space-y-8"
          >
            {/* Input Card */}
            <motion.div
              className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg p-6 space-y-6"
              variants={fieldVariants}
              custom={0}
              initial="hidden"
              animate="visible"
            >
              <div className="flex items-center gap-2 text-xl font-semibold text-[#260f26] dark:text-[#86cb92]">
                <ShieldCheckIcon className="w-6 h-6" /> Proxy Input
              </div>
              <Textarea
                label="Proxy List (one per line)"
                value={proxyText}
                onChange={e => setProxyText(e.target.value)}
                placeholder="proxy1:port1\nproxy2:port2\n..."
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setProxyText("")}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-[#eaeaff] dark:bg-[#333762] text-[#404e7c] dark:text-[#86cb92] rounded transition hover:bg-[#86cb92]/20"
                >
                  <XMarkIcon className="w-4 h-4" /> Clear
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-[#eaeaff] dark:bg-[#333762] text-[#404e7c] dark:text-[#86cb92] rounded transition hover:bg-[#86cb92]/20"
                >
                  <DocumentDuplicateIcon className="w-4 h-4" /> Copy
                </button>
              </div>
              <AnimatePresence>
                {success && (
                  <motion.div
                    className="text-green-700 bg-green-50 dark:bg-[#1c2b1c] p-2 rounded text-sm flex items-center gap-2"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <CheckBadgeIcon className="w-5 h-5" /> {success}
                  </motion.div>
                )}
                {error && (
                  <motion.div
                    className="text-red-600 bg-red-50 dark:bg-[#2b1c1c] p-2 rounded text-sm flex items-center gap-2"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <ExclamationTriangleIcon className="w-5 h-5" /> {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Import Card */}
            <motion.div
              className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg p-6 space-y-6"
              variants={fieldVariants}
              custom={1}
              initial="hidden"
              animate="visible"
            >
              {/* Auto Scraper Card */}
              <div className="p-2 space-y-6">
                <div className="flex items-center gap-2 mb-4 text-xl font-semibold text-[#260f26] dark:text-[#86cb92]">
                  <ArrowPathIcon className="w-6 h-6" /> Auto Scraper
                </div>
                <button
                  type="button"
                  onClick={handleScrapeNowClick}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-1 bg-[#598185] hover:bg-[#86cb92] text-white rounded-lg font-medium shadow transition disabled:opacity-50"
                >
                  <ArrowPathIcon className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Scraping…" : "Scrape Now"}
                </button>
              </div>
              {/* Import from URL Card */}
              <form className="p-2 space-y-6" onSubmit={handleLoadFromUrl}>
                <div className="flex items-center gap-2 mb-4 text-xl font-semibold text-[#260f26] dark:text-[#86cb92]">
                  <LinkIcon className="w-6 h-6" /> Import from URL
                </div>
                <Input
                  label="Import URL"
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  placeholder="https://example.com/proxies.txt"
                  error={urlError}
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-1 bg-[#86cb92] hover:bg-[#71b48d] text-[#251f47] rounded-lg font-medium shadow transition"
                >
                  <LinkIcon className="w-5 h-5" /> Load from URL
                </button>
              </form>
              <Transition appear show={showScrapeDialog} as={React.Fragment}>
                <Dialog as="div" className="relative z-30" onClose={() => setShowScrapeDialog(false)}>
                  <Transition.Child
                    as={React.Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <div className="fixed inset-0 bg-black/40" />
                  </Transition.Child>
                  <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Transition.Child
                        as={React.Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                      <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1c1b2f] p-6 shadow-xl border border-[#86cb92]/30">
                        <div className="flex items-center gap-3 mb-3">
                          <ExclamationTriangleIcon className="w-8 h-8 text-[#eab308]" />
                          <Dialog.Title className="text-lg font-bold text-[#260f26] dark:text-[#86cb92]">
                            Public Proxy Warning
                          </Dialog.Title>
                        </div>
                        <div className="text-[#404e7c] dark:text-[#d0d2e5] mb-6">
                          Scraping will fetch public proxies, which are often unsafe, slow, and may be blacklisted. <br />
                          <b>For critical or secure tasks, use residential proxies instead.</b>
                        </div>
                        <div className="flex gap-4 justify-end">
                          <button
                            onClick={() => setShowScrapeDialog(false)}
                            className="px-4 py-2 rounded-lg bg-[#eaeaff] dark:bg-[#333762] text-[#404e7c] dark:text-[#86cb92] font-medium hover:bg-[#86cb92]/20 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={confirmScrape}
                            className="px-4 py-2 rounded-lg bg-[#598185] hover:bg-[#86cb92] text-white font-medium transition"
                          >
                            Proceed Anyway
                          </button>
                        </div>
                      </Dialog.Panel>
                    </Transition.Child>
                  </div>
                </Dialog>
              </Transition>
            </motion.div>

            {/* File Actions Card */}
            <motion.div
              className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg p-6 space-y-6"
              variants={fieldVariants}
              custom={2}
              initial="hidden"
              animate="visible"
            >
              <div className="flex items-center gap-2 text-xl font-semibold text-[#260f26] dark:text-[#86cb92]">
                <ArrowDownTrayIcon className="w-6 h-6" /> File Actions
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#598185] text-[#598185] hover:bg-[#598185] hover:text-white transition"
                >
                  <ArrowUpOnSquareIcon className="w-5 h-5" /> Upload
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handleUpload}
                />
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#404e7c] text-[#404e7c] hover:bg-[#404e7c] hover:text-white transition"
                >
                  <ArrowDownOnSquareIcon className="w-5 h-5" /> Download
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#86cb92] text-[#86cb92] hover:bg-[#86cb92] hover:text-[#251f47] transition"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" /> Save to Browser
                </button>
              </div>
            </motion.div>
          </motion.section>
        )}

        {tab === "status" && (
          <motion.section
            key="status"
            variants={sectionVariants}
            custom={2}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="space-y-8"
          >
            <motion.div
              className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-8"
              variants={fieldVariants}
              custom={0}
              initial="hidden"
              animate="visible"
            >
              <StatCard label="Total Proxies" value={status.total} icon={Bars3Icon} custom={0} />
              <StatCard label="Working Proxies" value={status.working} icon={CheckBadgeIcon} custom={1} />
            </motion.div>
            <motion.div
              className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg p-6"
              variants={fieldVariants}
              custom={1}
              initial="hidden"
              animate="visible"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="flex items-center gap-2 text-lg font-bold text-[#260f26] dark:text-[#86cb92]">
                  <Bars3Icon className="w-5 h-5" /> Proxy Import History
                </h3>
                <button
                  onClick={() => setHistory([])}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#eaeaff] dark:bg-[#333762] text-[#404e7c] dark:text-[#86cb92] text-xs font-semibold hover:bg-[#86cb92]/20 transition"
                  title="Clear History"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Clear History
                </button>
              </div>
              <motion.ul
                className="mt-2 space-y-2 text-sm text-[#404e7c] dark:text-[#d0d2e5]"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.08 } },
                  hidden: {},
                }}
              >
                {history.length === 0 && <li className="italic opacity-70">No history yet.</li>}
                <AnimatePresence>
                  {history.map((h, i) => (
                    <motion.li
                      key={i}
                      className="border-b last:border-b-0 pb-2 last:pb-0 flex items-center gap-2"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ delay: 0.04 * i }}
                    >
                      <span>
                        {h.type === "scrape" && "Scraped"}
                        {h.type === "url" && "Loaded from URL"}
                        {h.type === "upload" && "Uploaded"}
                        {h.type === "save" && "Saved"}
                      </span>
                      <span className="text-[#598185] dark:text-[#86cb92]">
                        {h.count} proxies
                      </span>
                      {h.url && (
                        <span className="truncate max-w-xs text-xs opacity-70">{h.url}</span>
                      )}
                      {h.file && (
                        <span className="truncate max-w-xs text-xs opacity-70">{h.file}</span>
                      )}
                      <span className="ml-auto text-xs opacity-60">
                        {h.date.toLocaleString()}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            </motion.div>
          </motion.section>
        )}

        {tab === "settings" && (
          <motion.section
            key="settings"
            variants={sectionVariants}
            custom={3}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="space-y-8"
          >
            <motion.div
              className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg p-6"
              variants={fieldVariants}
              custom={0}
              initial="hidden"
              animate="visible"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#260f26] dark:text-[#86cb92]">
                  Proxy Settings
                </h3>
                {/* <button onClick={() => setTab("input")} aria-label="Close settings">
                  <XMarkIcon className="w-6 h-6 text-[#404e7c] dark:text-[#d0d2e5]" />
                </button> */}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <Label>Proxy Mode</Label>
                  <div className="flex gap-2 mt-2">
                    {MODES.map(mode => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setProxyMode(mode.value)}
                        className={cn(
                          "px-4 py-2 rounded transition font-semibold",
                          proxyMode === mode.value
                            ? "bg-[#598185] text-white shadow"
                            : "bg-white dark:bg-[#333762] border border-[#598185] text-[#598185] dark:text-[#86cb92] hover:bg-[#86cb92]/10"
                        )}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  label="Auto‑Refresh (h)"
                  type="number"
                  min={1}
                  value={refreshInterval}
                  onChange={e => setRefreshInterval(Number(e.target.value))}
                />
                <Input
                  label="Minimum Working"
                  type="number"
                  value={status.working}
                  disabled
                />
              </div>
              <div className="flex items-center mt-6 gap-4">
                <Switch
                  checked={autoRefresh}
                  onChange={e => setAutoRefresh(e.target.checked)}
                  label="Auto Refresh"
                />
              </div>
              <div className="text-right mt-6">
                <button
                  type="button"
                  onClick={() => setSuccess("Settings saved!")}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-[#598185] hover:bg-[#86cb92] text-white rounded-lg transition"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" /> Save Settings
                </button>
              </div>
              <AnimatePresence>
                {success && (
                  <motion.div
                    className="text-green-700 bg-green-50 dark:bg-[#1c2b1c] p-2 rounded text-sm flex items-center gap-2 mt-4"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <CheckBadgeIcon className="w-5 h-5" /> {success}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
