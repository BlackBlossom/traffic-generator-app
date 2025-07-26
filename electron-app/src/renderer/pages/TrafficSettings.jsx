// src/renderer/pages/TrafficSettings.jsx
import React, { useState, useEffect, Fragment, useMemo, useCallback } from 'react'
import { Listbox, Dialog, Transition } from '@headlessui/react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cog6ToothIcon,
  ClockIcon,
  ShareIcon,
  PencilIcon,
  CalendarIcon,
  BoltIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  XMarkIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'
import { fieldVariants, sectionVariants } from '../animations'
import { useUser } from '../context/UserContext'
import { 
  getUserCampaigns, 
  createCampaign, 
  deleteCampaign,
  stopCampaign
} from '../api/auth'
import CalendarPicker from '../components/CalendarPicker'

// Utility to merge class names
const cn = (...classes) => classes.filter(Boolean).join(' ')

// Common CSS classes
const TEXT_COLOR = 'text-[#404e7c] dark:text-[#d0d2e5]'
const TITLE_COLOR = 'text-[#260f26] dark:text-[#86cb92]'
const ACCENT_COLOR = 'text-[#598185] dark:text-[#86cb92]'

// Helper functions
const getInitialStartTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDuration = (campaign) => {
  const minDuration = campaign.visitDurationMin || campaign.visitDuration || 30;
  const maxDuration = campaign.visitDurationMax || campaign.visitDuration || 30;
  return minDuration === maxDuration ? `${minDuration}s` : `${minDuration}-${maxDuration}s`;
};

// Component for scheduling duration display
const SchedulingDurationDisplay = ({ data, dateValidation, timeValidation }) => {
  if (!data.startDate || !data.endDate || !data.startTime || !data.endTime || 
      dateValidation.isStartInvalid || dateValidation.isEndInvalid ||
      timeValidation.isStartInvalid || timeValidation.isEndInvalid) {
    return null;
  }

  const startDateTime = new Date(`${data.startDate}T${data.startTime}:00`);
  const endDateTime = new Date(`${data.endDate}T${data.endTime}:00`);
  const durationMs = endDateTime - startDateTime;
  const durationMinutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  let durationText = '';
  if (days > 0) {
    durationText = `${days}d ${remainingHours}h ${minutes}m`;
  } else if (hours > 0) {
    durationText = `${hours}h ${minutes}m`;
  } else {
    durationText = `${minutes}m`;
  }
  
  return (
    <motion.div 
      className="text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-xs text-[#598185] dark:text-[#86cb92] bg-[#f8f9ff] dark:bg-[#1c1b2f]/50 p-3 rounded-lg">
        <div className="font-semibold mb-1">Campaign Duration: {durationText}</div>
        <div className="opacity-75">
          From {startDateTime.toLocaleDateString()} {startDateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
          <br />
          to {endDateTime.toLocaleDateString()} {endDateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      </div>
    </motion.div>
  );
};

// Component for date selection
const DateSelectionSection = ({ data, handleStartDateChange, handleEndDateChange, getDateValidation }) => {
  const dateValidation = getDateValidation();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <CalendarPicker
        label="Start Date"
        value={data.startDate}
        onChange={handleStartDateChange}
        isInvalid={dateValidation.isStartInvalid}
        validationMessage={dateValidation.startMessage}
      />
      <CalendarPicker
        label="End Date"
        value={data.endDate}
        onChange={handleEndDateChange}
        minDate={data.startDate}
        isInvalid={dateValidation.isEndInvalid}
        validationMessage={dateValidation.endMessage}
      />
    </div>
  );
};

// Component for animated form field
const AnimatedField = ({ children, index }) => (
  <motion.div
    variants={fieldVariants}
    custom={index}
    initial="hidden"
    animate="visible"
  >
    {children}
  </motion.div>
);

// Component for time selection
const TimeSelectionSection = ({ data, handleStartTimeChange, handleEndTimeChange, getTimeValidation }) => {
  const timeValidation = getTimeValidation();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TimeSelect
        label="Start Time"
        value={data.startTime}
        onChange={handleStartTimeChange}
        isInvalid={timeValidation.isStartInvalid}
        validationMessage={timeValidation.message}
      />
      <TimeSelect
        label="End Time"
        value={data.endTime}
        onChange={handleEndTimeChange}
        isInvalid={timeValidation.isEndInvalid}
        validationMessage={timeValidation.message}
      />
    </div>
  );
};

// Component for cookies management
const CookiesManagementSection = ({ data, onCookiesChange }) => {
  const [newCookie, setNewCookie] = useState({
    name: '',
    value: '',
    domain: '',
    path: '/',
    expires: '',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax'
  });

  const [showAddCookie, setShowAddCookie] = useState(false);

  const addCookie = () => {
    if (!newCookie.name.trim()) return;
    
    const cookieToAdd = {
      ...newCookie,
      name: newCookie.name.trim(),
      value: newCookie.value.trim(),
      domain: newCookie.domain.trim(),
      expires: newCookie.expires ? new Date(newCookie.expires).getTime() : null
    };

    onCookiesChange([...data.cookies, cookieToAdd]);
    
    // Reset form
    setNewCookie({
      name: '',
      value: '',
      domain: '',
      path: '/',
      expires: '',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax'
    });
    setShowAddCookie(false);
  };

  const removeCookie = (index) => {
    const updatedCookies = data.cookies.filter((_, i) => i !== index);
    onCookiesChange(updatedCookies);
  };

  const formatExpires = (timestamp) => {
    if (!timestamp) return 'Session';
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GlobeAltIcon className="w-5 h-5 text-[#598185] dark:text-[#86cb92]" />
          <Label>Cookies Management</Label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({data.cookies.length}/50)
          </span>
        </div>
        <motion.button
          type="button"
          onClick={() => setShowAddCookie(!showAddCookie)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#598185] dark:bg-[#86cb92] 
                     text-white dark:text-[#1c1b2f] rounded-lg hover:opacity-90 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <PlusIcon className="w-4 h-4" />
          Add Cookie
        </motion.button>
      </div>

      {/* Existing Cookies List */}
      {data.cookies.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.cookies.map((cookie, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1c1b2f]/50 
                         rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-[#404e7c] dark:text-[#d0d2e5] truncate">
                    {cookie.name}
                  </span>
                  {cookie.domain && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      @{cookie.domain}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>Value: {cookie.value || 'empty'}</span>
                  <span>Path: {cookie.path}</span>
                  <span>Expires: {formatExpires(cookie.expires)}</span>
                  {cookie.httpOnly && <span className="text-blue-600">HttpOnly</span>}
                  {cookie.secure && <span className="text-green-600">Secure</span>}
                </div>
              </div>
              <motion.button
                type="button"
                onClick={() => removeCookie(index)}
                className="ml-2 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 
                           rounded transition"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <XMarkIcon className="w-4 h-4" />
              </motion.button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Cookie Form */}
      <AnimatePresence>
        {showAddCookie && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-[#598185]/40 dark:border-[#86cb92]/40 rounded-lg p-4 bg-gray-50/50 dark:bg-[#1c1b2f]/20"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <Input
                label="Cookie Name *"
                value={newCookie.name}
                onChange={(e) => setNewCookie({...newCookie, name: e.target.value})}
                placeholder="e.g. session_id"
              />
              <Input
                label="Cookie Value"
                value={newCookie.value}
                onChange={(e) => setNewCookie({...newCookie, value: e.target.value})}
                placeholder="e.g. abc123"
              />
              <Input
                label="Domain"
                value={newCookie.domain}
                onChange={(e) => setNewCookie({...newCookie, domain: e.target.value})}
                placeholder="e.g. example.com"
              />
              <Input
                label="Path"
                value={newCookie.path}
                onChange={(e) => setNewCookie({...newCookie, path: e.target.value})}
                placeholder="/"
              />
              <Input
                label="Expires (Date)"
                type="datetime-local"
                value={newCookie.expires}
                onChange={(e) => setNewCookie({...newCookie, expires: e.target.value})}
              />
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newCookie.httpOnly}
                      onChange={(e) => setNewCookie({...newCookie, httpOnly: e.target.checked})}
                      className="rounded border-[#598185] dark:border-[#86cb92] text-[#598185] focus:ring-[#86cb92]"
                    />
                    <span className="text-sm text-[#404e7c] dark:text-[#d0d2e5]">HttpOnly</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newCookie.secure}
                      onChange={(e) => setNewCookie({...newCookie, secure: e.target.checked})}
                      className="rounded border-[#598185] dark:border-[#86cb92] text-[#598185] focus:ring-[#86cb92]"
                    />
                    <span className="text-sm text-[#404e7c] dark:text-[#d0d2e5]">Secure</span>
                  </label>
                  <select
                    value={newCookie.sameSite}
                    onChange={(e) => setNewCookie({...newCookie, sameSite: e.target.value})}
                    className="w-full h-8 px-2 border border-[#598185] dark:border-[#86cb92] rounded bg-white/60 dark:bg-[#1c1b2f]/60
                               focus:outline-none focus:ring-2 focus:ring-[#86cb92] transition text-sm"
                  >
                    <option value="Strict">SameSite: Strict</option>
                    <option value="Lax">SameSite: Lax</option>
                    <option value="None">SameSite: None</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <motion.button
                type="button"
                onClick={() => setShowAddCookie(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
              <motion.button
                type="button"
                onClick={addCookie}
                disabled={!newCookie.name.trim()}
                className="px-4 py-2 text-sm bg-[#598185] dark:bg-[#86cb92] text-white dark:text-[#1c1b2f] 
                           rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Add Cookie
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// === Mini‐components ===
const Label = ({ children }) => (
  <label className={`block text-[16px] font-bold ${TEXT_COLOR} mb-1`}>
    {children}
  </label>
)

const Input = React.forwardRef(({ label, tooltip, ...props }, ref) => (
  <div className="flex flex-col">
    {label && (
      <div className="flex items-center gap-2 mb-1">
        <Label>{label}</Label>
        {tooltip && (
          <div className="group relative">
            <div className="w-4 h-4 rounded-full bg-[#598185] text-white text-xs flex items-center justify-center cursor-help">
              ?
            </div>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-[#1c1b2f] dark:bg-white text-white dark:text-[#1c1b2f] text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-48 sm:w-64 max-w-xs">
              {tooltip}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1c1b2f] dark:border-t-white"></div>
            </div>
          </div>
        )}
      </div>
    )}
    <input
      ref={ref}
      {...props}
      className="h-10 px-3 border border-[#598185] dark:border-[#86cb92] rounded-lg bg-white/60 dark:bg-[#1c1b2f]/60
                focus:outline-none focus:ring-2 focus:ring-[#86cb92] transition"
    />
  </div>
))
Input.displayName = 'Input'

const Slider = ({ label, value, onChange, max = 100, tooltip, name }) => (
  <div className="flex flex-col">
    {label && (
      <div className="flex items-center gap-2 mb-1">
        <Label>{label}</Label>
        {tooltip && (
          <div className="group relative">
            <div className="w-4 h-4 rounded-full bg-[#598185] text-white text-xs flex items-center justify-center cursor-help">
              ?
            </div>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-[#1c1b2f] dark:bg-white text-white dark:text-[#1c1b2f] text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-sm">
              {tooltip}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1c1b2f] dark:border-t-white"></div>
            </div>
          </div>
        )}
      </div>
    )}
    <div className="flex items-center gap-3">
      <input
        type="range"
        name={name}
        value={value}
        max={max}
        onChange={onChange}
        className="flex-1 h-2 rounded-lg bg-[#eaeaff] accent-[#598185] cursor-pointer"
      />
      <span className="w-10 text-sm text-[#404e7c] dark:text-[#d0d2e5]">{value}%</span>
    </div>
  </div>
)

const Switch = ({ label, checked, onChange, name }) => (
  <label className="inline-flex items-center gap-2 cursor-pointer">
    <input 
      type="checkbox" 
      name={name}
      checked={checked} 
      onChange={onChange} 
      className="sr-only" 
    />
    <span
      className={cn(
        'w-10 h-5 rounded-full p-[2px] flex items-center transition',
        checked ? 'bg-[#598185]' : 'bg-[#eaeaff] dark:bg-[#333762]'
      )}
    >
      <span
        className={cn(
          'block w-4 h-4 bg-white rounded-full shadow transform transition',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </span>
    {label && <span className={`text-sm ${TEXT_COLOR}`}>{label}</span>}
  </label>
)

const Checkbox = ({ label, checked, onChange, name }) => (
  <label className="inline-flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      name={name}
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 border rounded bg-white dark:bg-[#1c1b2f] border-[#598185] dark:border-[#86cb92]
                focus:ring-2 focus:ring-[#86cb92]"
    />
    {label && <span className={`text-sm ${TEXT_COLOR}`}>{label}</span>}
  </label>
)

const Textarea = React.forwardRef(({ label, ...props }, ref) => (
  <div className="flex flex-col">
    {label && <Label>{label}</Label>}
    <textarea
      ref={ref}
      {...props}
      className="min-h-[80px] p-2 border border-[#598185] dark:border-[#86cb92] rounded-lg bg-white/60 dark:bg-[#1c1b2f]/60
                focus:outline-none focus:ring-2 focus:ring-[#86cb92] transition"
    />
  </div>
))
Textarea.displayName = 'Textarea'

function TimeListbox({ label, value, onChange, options, isInvalid = false }) {
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="flex flex-col">
        <div className="relative">
          <Listbox.Button
            className={`w-full h-10 pl-3 pr-8 rounded-lg bg-white/60 dark:bg-[#1c1b2f]/60 
                       border text-left text-sm 
                       text-[#404e7c] dark:text-[#d0d2e5] flex items-center justify-between
                       focus:outline-none focus:ring-2 transition ${
                         isInvalid
                           ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
                           : 'border-[#598185]/40 dark:border-[#86cb92]/40 focus:ring-[#86cb92]'
                       }`}
          >
            <span>{value || label?.slice(0,2)}</span>
            <ChevronDownIcon className="w-4 h-4 text-[#404e7c] dark:text-[#d0d2e5]" />
          </Listbox.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Listbox.Options
              static
              className="absolute z-10 mt-1 w-full bg-white dark:bg-[#1c1b2f] 
                         border border-[#598185]/40 dark:border-[#86cb92]/40 rounded-lg 
                         max-h-32 overflow-y-auto shadow-lg focus:outline-none"
            >
              {options.map((opt) => (
                <Listbox.Option
                  key={opt}
                  value={opt}
                  className={({ active, selected }) =>
                    cn(
                      'cursor-pointer select-none px-3 py-1 text-sm',
                      active
                        ? 'bg-[#598185]/30 dark:bg-[#86cb92]/30'
                        : '',
                      selected ? 'font-semibold' : 'font-normal'
                    )
                  }
                >
                  {opt}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </div>
    </Listbox>
  )
}

function GeoSelect({ label, value, onChange, tooltip }) {
  return (
    <div className="flex flex-col">
      {label && (
        <div className="flex items-center gap-2 mb-1">
          <Label>{label}</Label>
          {tooltip && (
            <div className="group relative">
              <div className="w-4 h-4 rounded-full bg-[#598185] text-white text-xs flex items-center justify-center cursor-help">
                ?
              </div>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-[#1c1b2f] dark:bg-white text-white dark:text-[#1c1b2f] text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-64">
                {tooltip}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1c1b2f] dark:border-t-white"></div>
              </div>
            </div>
          )}
        </div>
      )}
      <Listbox value={value} onChange={onChange}>
        <div className="relative">
          <Listbox.Button
            className="w-full h-10 pl-3 pr-8 rounded-lg bg-white/60 dark:bg-[#1c1b2f]/60 
                       border border-[#598185] dark:border-[#86cb92] text-left text-sm 
                       text-[#404e7c] dark:text-[#d0d2e5] flex items-center justify-between
                       focus:outline-none focus:ring-2 focus:ring-[#86cb92] transition"
          >
            <span>{value || 'Select country...'}</span>
            <ChevronDownIcon className="w-4 h-4 text-[#404e7c] dark:text-[#d0d2e5]" />
          </Listbox.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Listbox.Options
              className="absolute z-20 mt-1 w-full bg-white dark:bg-[#1c1b2f] 
                         border border-[#598185]/40 dark:border-[#86cb92]/40 rounded-lg 
                         max-h-48 overflow-y-auto shadow-lg focus:outline-none"
            >
              {COUNTRIES.map((country) => (
                <Listbox.Option
                  key={country}
                  value={country}
                  className={({ active, selected }) =>
                    cn(
                      'cursor-pointer select-none px-3 py-2 text-sm',
                      active
                        ? 'bg-[#598185]/30 dark:bg-[#86cb92]/30'
                        : '',
                      selected 
                        ? 'font-semibold text-[#598185] dark:text-[#86cb92]' 
                        : 'font-normal text-[#404e7c] dark:text-[#d0d2e5]'
                    )
                  }
                >
                  {country}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  )
}

function VisitDurationRange({ label, minValue, maxValue, onMinChange, onMaxChange, tooltip }) {
  // Calculate if there's a validation issue - only show error if max < min
  const hasValidationIssue = maxValue < minValue || minValue < 5 || maxValue < 5;
  const validationMessage = maxValue < minValue 
    ? "Max cannot be smaller than min" 
    : (minValue < 5 || maxValue < 5) 
      ? "Both values must be at least 5 seconds" 
      : "";

  return (
    <div className="flex flex-col">
      {label && (
        <div className="flex items-center gap-2 mb-1">
          <Label>{label}</Label>
          {tooltip && (
            <div className="group relative">
              <div className="w-4 h-4 rounded-full bg-[#598185] text-white text-xs flex items-center justify-center cursor-help">
                ?
              </div>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-[#1c1b2f] dark:bg-white text-white dark:text-[#1c1b2f] text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-64">
                {tooltip}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1c1b2f] dark:border-t-white"></div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Min"
          value={minValue}
          onChange={onMinChange}
          min="5"
          className={`h-10 px-3 border rounded-lg bg-white/60 dark:bg-[#1c1b2f]/60
                    focus:outline-none focus:ring-2 transition text-center ${
                      minValue < 5
                        ? 'border-red-500 dark:border-red-400 focus:ring-red-500' 
                        : 'border-[#598185] dark:border-[#86cb92] focus:ring-[#86cb92]'
                    }`}
        />
        <input
          type="number"
          placeholder="Max"
          value={maxValue}
          onChange={onMaxChange}
          min="5"
          className={`h-10 px-3 border rounded-lg bg-white/60 dark:bg-[#1c1b2f]/60
                    focus:outline-none focus:ring-2 transition text-center ${
                      hasValidationIssue && maxValue < minValue
                        ? 'border-red-500 dark:border-red-400 focus:ring-red-500' 
                        : maxValue < 5
                        ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
                        : 'border-[#598185] dark:border-[#86cb92] focus:ring-[#86cb92]'
                    }`}
        />
      </div>
      <div className={`text-xs text-center mt-1 ${
        hasValidationIssue 
          ? 'text-red-600 dark:text-red-400' 
          : 'text-[#598185] dark:text-[#86cb92]'
      }`}>
        {hasValidationIssue ? validationMessage : `${minValue} - ${maxValue} seconds`}
      </div>
    </div>
  )
}

export function TimeSelect({ label, value = '', onChange, isInvalid = false, validationMessage = '' }) {
  const [hour = '', minute = ''] = value.split(':')
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

  return (
    <div className="flex flex-col">
      {label && (
        <label className={`block text-sm font-medium mb-1 ${
          isInvalid 
            ? 'text-red-600 dark:text-red-400' 
            : 'text-[#404e7c] dark:text-[#d0d2e5]'
        }`}>
          {label}
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <TimeListbox
          label="HH"
          value={hour}
          onChange={(h) => onChange(`${h}:${minute}`)}
          options={hours}
          isInvalid={isInvalid}
        />
        <TimeListbox
          label="MM"
          value={minute}
          onChange={(m) => onChange(`${hour}:${m}`)}
          options={minutes}
          isInvalid={isInvalid}
        />
      </div>
      {isInvalid && validationMessage && (
        <div className="text-xs text-red-600 dark:text-red-400 text-center mt-1">
          {validationMessage}
        </div>
      )}
    </div>
  )
}

const INITIAL_DATA = {
  url: '',
  visitDurationMin: 20,
  visitDurationMax: 40,
  delay: 5,
  bounceRate: 40,
  concurrent: 5,
  scrolling: true,
  organic: 60,
  headfulPercentage: 50, // Percentage of sessions that should run with headful browser (0-100)
  desktopPercentage: 70, // Percentage of sessions that should use desktop devices (0-100)
  totalSessions: '', // Total number of sessions to generate (empty = unlimited)
  scheduling: false,
  startDate: getTodayDate(),
  endDate: getTodayDate(),
  startTime: getInitialStartTime(),
  endTime: '',
  social: { Facebook: true, Twitter: true, Instagram: false, LinkedIn: false },
  custom: '',
  geo: 'Global',
  notes: '',
  adSelectors: '', // Comma-separated list of CSS selectors for ads to be clicked
  adsXPath: '', // Comma-separated list of X-path expressions for Google Ads containers
  cookies: [] // Array of cookies to be set during sessions
}

// Country list for geo targeting
const COUNTRIES = [
  'Global',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Netherlands',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Switzerland',
  'Austria',
  'Belgium',
  'Ireland',
  'Portugal',
  'Japan',
  'South Korea',
  'Singapore',
  'Hong Kong',
  'India',
  'Brazil',
  'Mexico',
  'Argentina',
  'Chile',
  'Russia',
  'Poland',
  'Czech Republic',
  'Hungary',
  'Greece',
  'Turkey',
  'Israel',
  'South Africa',
  'New Zealand',
]

export default function TrafficSettings() {
  const location = useLocation()
  const [data, setData] = useState(INITIAL_DATA)
  const [campaigns, setCampaigns] = useState([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [stoppingCampaignId, setStoppingCampaignId] = useState(null);
  const [loading, setLoading] = useState(false)
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const { user } = useUser()

  // Fetch campaigns function - separated for reusability
  const fetchUserCampaigns = async () => {
    if (!user || !user.apiKeys?.[0]?.key) {
      setError("No API key found. Please Regenerate API Key.");
      setCampaignsLoading(false);
      return;
    }
    setCampaignsLoading(true);
    try {
      const result = await getUserCampaigns(user.email, user.apiKeys[0].key);
      setCampaigns(result);
      setError('');
    } catch (err) {
      setError("Failed to load previous campaigns.");
    }
    setCampaignsLoading(false);
  };

  // Initial load of campaigns - only depends on user
  useEffect(() => {
    fetchUserCampaigns();
  }, [user]);
  
  // Memoize campaign categories to prevent unnecessary recalculations
  const { activeCampaigns, scheduledCampaigns, previousCampaigns } = useMemo(() => {
    return {
      activeCampaigns: campaigns.filter(c => c.isActive && !c.scheduling),
      scheduledCampaigns: campaigns.filter(c => c.scheduling),
      previousCampaigns: campaigns.filter(c => !c.isActive && !c.scheduling)
    };
  }, [campaigns]);
  
  useEffect(() => {
    // Try main container first
    const scroller = document.querySelector('.main-scrollable');
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname]);
  
  // Optimized change handlers - single functions that don't recreate
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setData((d) => ({ ...d, [name]: value }));
  }, []);

  const handleSliderChange = useCallback((e) => {
    const { name, value } = e.target;
    setData((d) => ({ ...d, [name]: Number(value) }));
  }, []);

  const handleCheckboxChange = useCallback((e) => {
    const { name, checked } = e.target;
    setData((d) => ({ ...d, [name]: checked }));
  }, []);

  const handleSocialChange = useCallback((e) => {
    const { name, checked } = e.target;
    setData((d) => ({
      ...d,
      social: { ...d.social, [name]: checked },
    }));
  }, []);

  // Enhanced visit duration handlers - only validate min, show error for max
  const handleVisitDurationMinChange = useCallback((e) => {
    const value = Number(e.target.value);
    setData((d) => ({
      ...d, 
      visitDurationMin: Math.max(5, value) // Only ensure minimum is at least 5
    }));
  }, []);

  const handleVisitDurationMaxChange = useCallback((e) => {
    const value = Number(e.target.value);
    setData((d) => ({
      ...d, 
      visitDurationMax: Math.max(5, value) // Only ensure maximum is at least 5
    }));
  }, []);

  // Enhanced time selection handlers - only validate start time, show error for end time
  const handleStartTimeChange = useCallback((value) => {
    setData(d => ({ ...d, startTime: value }));
  }, []);

  const handleEndTimeChange = useCallback((value) => {
    setData(d => ({ ...d, endTime: value }));
  }, []);

  // Date selection handlers
  const handleStartDateChange = useCallback((e) => {
    const { value } = e.target;
    setData(d => {
      const newData = { ...d, startDate: value };
      
      // If end date is before new start date, update end date to match start date
      if (d.endDate && new Date(d.endDate + 'T00:00:00') < new Date(value + 'T00:00:00')) {
        newData.endDate = value;
      }
      
      return newData;
    });
  }, []);

  const handleEndDateChange = useCallback((e) => {
    const { value } = e.target;
    setData(d => ({ ...d, endDate: value }));
  }, []);

  // Enhanced date validation with dependency logic
  const getDateValidation = useCallback(() => {
    if (!data.scheduling || !data.startDate || !data.endDate) {
      return { 
        isStartInvalid: false, 
        isEndInvalid: false, 
        startMessage: '', 
        endMessage: '' 
      };
    }

    const startDate = new Date(data.startDate + 'T00:00:00');
    const endDate = new Date(data.endDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for date comparison

    let isStartInvalid = false;
    let isEndInvalid = false;
    let startMessage = '';
    let endMessage = '';

    // Check if start date is in the past
    if (startDate < today) {
      isStartInvalid = true;
      startMessage = 'Start date cannot be in the past';
    }

    // Check if end date is before start date
    if (endDate < startDate) {
      isEndInvalid = true;
      endMessage = 'End date cannot be before start date';
    }

    return { isStartInvalid, isEndInvalid, startMessage, endMessage };
  }, [data.scheduling, data.startDate, data.endDate]);

  // Helper function to check time validation
  const getTimeValidation = useCallback(() => {
    if (!data.scheduling || !data.startTime || !data.endTime || !data.startDate || !data.endDate) {
      return { isStartInvalid: false, isEndInvalid: false, message: '' };
    }

    // Parse dates and times
    const startDate = new Date(`${data.startDate}T${data.startTime}:00`);
    const endDate = new Date(`${data.endDate}T${data.endTime}:00`);
    const now = new Date();
    
    // Check if start date/time is in the past
    if (startDate <= now) {
      return { 
        isStartInvalid: true, 
        isEndInvalid: false, 
        message: 'Start date/time must be in the future' 
      };
    }
    
    // Check if end date/time is before or equal to start date/time
    if (endDate <= startDate) {
      return { 
        isStartInvalid: false, 
        isEndInvalid: true, 
        message: 'End date/time cannot be earlier than start date/time' 
      };
    }
    
    // Check minimum duration (10 minutes)
    const durationMinutes = (endDate - startDate) / (1000 * 60);
    if (durationMinutes < 10) {
      return { 
        isStartInvalid: false, 
        isEndInvalid: true, 
        message: 'Duration must be at least 10 minutes' 
      };
    }

    return { isStartInvalid: false, isEndInvalid: false, message: '' };
  }, [data.scheduling, data.startDate, data.endDate, data.startTime, data.endTime]);

  // Cookies management handler
  const handleCookiesChange = useCallback((newCookies) => {
    setData(d => ({ ...d, cookies: newCookies }));
  }, []);

  // Validation function (memoized)
  const validate = useCallback(() => {
    if (!data.url || !/^https?:\/\/.+/.test(data.url)) return 'Valid URL required'
    if (data.visitDurationMin < 5) return 'Minimum visit duration must be at least 5 seconds'
    if (data.visitDurationMax < 5) return 'Maximum visit duration must be at least 5 seconds'
    if (data.visitDurationMax < data.visitDurationMin) return 'Maximum visit duration cannot be smaller than minimum visit duration'
    if (data.concurrent < 1) return 'Concurrent sessions must be at least 1'
    if (data.totalSessions && data.totalSessions < 1) return 'Total sessions must be at least 1 or empty for unlimited'
    if (data.organic < 0 || data.organic > 100) return 'Organic % must be 0-100'
    if (data.desktopPercentage < 0 || data.desktopPercentage > 100) return 'Desktop % must be 0-100'
    
    // Use validation helpers for scheduling
    if (data.scheduling) {
      if (!data.startDate || !data.endDate || !data.startTime || !data.endTime) return 'Set both start and end date/time for scheduling'
      
      const dateValidation = getDateValidation();
      if (dateValidation.isStartInvalid) return dateValidation.startMessage;
      if (dateValidation.isEndInvalid) return dateValidation.endMessage;
      
      const timeValidation = getTimeValidation();
      if (timeValidation.isStartInvalid || timeValidation.isEndInvalid) return timeValidation.message;
    }
    
    return ''
  }, [data, getDateValidation, getTimeValidation])

  // Add campaign with optimized state management
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    if (!user || !user.apiKeys?.[0]?.key) {
      setError("User authentication required.");
      return;
    }
    setLoading(true);
    try {
      const resp = await createCampaign(user.email, user.apiKeys[0].key, data);
      setSuccess(resp.message || "Campaign created successfully!");
      setData(INITIAL_DATA);
      // Refetch campaigns only after successful creation
      await fetchUserCampaigns();
    } catch (err) {
      setError("Error creating campaign.");
    }
    setLoading(false);
  }, [data, validate, user, fetchUserCampaigns]);

  // Reset form with optimized state management
  const handleReset = useCallback(() => {
    setData({
      ...INITIAL_DATA,
      startDate: getTodayDate(),
      endDate: getTodayDate(),
      startTime: getInitialStartTime(),
      endTime: ''
    })
    setError('')
    setSuccess('')
  }, [])

  // Optimized delete dialog handlers
  const openDeleteDialog = useCallback((id) => {
    setCampaignToDelete(id);
    setShowDeleteDialog(true);
  }, []);

  const handleDeleteConfirmed = useCallback(async () => {
    if (campaignToDelete) {
      await handleDeleteCampaign(campaignToDelete);
      setShowDeleteDialog(false);
      setCampaignToDelete(null);
    }
  }, [campaignToDelete]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteDialog(false);
    setCampaignToDelete(null);
  }, []);

  const handleDeleteCampaign = useCallback(async (id) => {
    if (!user || !user.apiKeys?.[0]?.key) {
      setError("No API key found. Please Regenerate API Key.");
      return;
    }
    setLoading(true);
    try {
      await deleteCampaign(user.email, id, user.apiKeys[0].key);
      setSuccess("Campaign deleted successfully!");
      // Update campaigns state directly instead of refetching
      setCampaigns(prev => prev.filter(c => (c.id || c._id) !== id));
    } catch (err) {
      setError("Error deleting campaign.");
    }
    setLoading(false);
  }, [user]);

  const handleStopCampaign = useCallback(async (id) => {
    setStoppingCampaignId(id);
    try {
      await stopCampaign(user.email, id, user.apiKeys[0].key);
      setSuccess("Campaign stopped successfully!");
      // Update campaigns state directly instead of refetching
      setCampaigns(prev => prev.map(c => 
        (c.id || c._id) === id ? { ...c, isActive: false } : c
      ));
    } catch (err) {
      setError("Error stopping campaign.");
    }
    setStoppingCampaignId(null);
  }, [user]);

  // --- Campaign List Section Component ---
  function CampaignSection({ title, icon: Icon, campaigns, onDeleteClick, onStopClick, emptyText, showStop, showDelete = true }) {
    return (
      <motion.section className="bg-white dark:bg-[#1c1b2f]/70 border-0 border-[#598185]/40 dark:border-[#86cb92]/40 rounded-2xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
      >
        <h3 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-[#260f26] dark:text-[#86cb92] mb-2">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          {title}
        </h3>
        <motion.ul
          className="space-y-2 text-sm text-[#404e7c] dark:text-[#d0d2e5]"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } }, hidden: {} }}
        >
          {campaigns.length === 0 && <li className="text-gray-400 text-center sm:text-left">{emptyText}</li>}
          <AnimatePresence>
            {campaigns.map((c, idx) => (
              <motion.li
                key={c.id || c._id}
                className="relative border-b border-[#598185]/20 dark:border-[#86cb92]/20 pb-3 flex flex-col group hover:bg-[#f8f9ff] dark:hover:bg-[#1c1b2f]/50 rounded-lg p-3 transition-colors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.04 * idx }}
              >
                {/* Action Buttons - Mobile: Stack vertically, Desktop: Side by side */}
                <div className="absolute top-3 right-3 flex flex-col sm:flex-row gap-1 sm:gap-2">
                  {/* Stop Button for Active Campaigns */}
                  {showStop && (
                    <button
                      className="px-2 sm:px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition text-xs sm:text-sm order-2 sm:order-1"
                      onClick={() => onStopClick(c.id || c._id)}
                      disabled={stoppingCampaignId === (c.id || c._id)}
                    >
                      {stoppingCampaignId === (c.id || c._id) ? (
                        <span className="animate-pulse">Stopping...</span>
                      ) : (
                        "Stop"
                      )}
                    </button>
                  )}
                  {/* Delete Button */}
                  {showDelete && (
                    <button
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition order-1 sm:order-2"
                      onClick={() => onDeleteClick(c.id || c._id)}
                      aria-label="Delete campaign"
                    >
                      <TrashIcon className="w-4 h-4 text-red-600 hover:text-red-800 transition" />
                    </button>
                  )}
                </div>
                
                <span className="font-medium text-[#260f26] dark:text-[#86cb92] mb-2 block pr-16 sm:pr-20 break-all">{c.url}</span>
                <div className="text-sm text-[#404e7c] dark:text-[#d0d2e5] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
                  <span>Organic: {c.organic}%</span>
                  <span>Duration: {formatDuration(c)}</span>
                  <span>Sessions: {c.concurrent}</span>
                  <span>Bounce: {c.bounceRate}%</span>
                  {c.totalSessions && <span>Total: {c.totalSessions}</span>}
                  {c.headfulPercentage !== undefined && <span>Headful: {c.headfulPercentage}%</span>}
                  {c.desktopPercentage !== undefined && <span>Desktop: {c.desktopPercentage}%</span>}
                  {c.geo && c.geo !== 'Global' && <span>Geo: {c.geo}</span>}
                  {c.scheduling && (
                    <span>
                      Schedule: {c.startDate && c.startDate !== getTodayDate() ? `${c.startDate} ` : ''}
                      {c.startTime}–{c.endTime}
                      {c.endDate && c.endDate !== c.startDate ? ` to ${c.endDate}` : ''}
                    </span>
                  )}
                  {c.adSelectors && <span>CSS Ads: {c.adSelectors.split(',').length} selectors</span>}
                  {c.adsXPath && <span>XPath: {c.adsXPath.split(',').length} expressions</span>}
                </div>
                {c.notes && <div className="italic text-xs text-[#598185] dark:text-[#86cb92] mt-2 bg-[#f8f9ff] dark:bg-[#1c1b2f]/50 p-2 rounded break-words">{c.notes}</div>}
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </motion.section>
    );
  }

  return (
    <motion.div
      className="space-y-6 lg:space-y-10 p-4 sm:p-6 mx-auto"
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
    >
      {/* Page Heading */}
      <motion.div variants={sectionVariants} custom={0} className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#260f26] dark:text-[#86cb92]">
          Traffic Settings
        </h1>
        <p className="text-base sm:text-lg text-[#598185] dark:text-[#d0d2e5] mt-2">
          Configure new traffic campaigns, schedule runs, and manage referral sources.
        </p>
      </motion.div>

      {/* Create Campaign + Scheduling + Referral */}
      <motion.form
        variants={sectionVariants}
        custom={1}
        className="bg-white dark:bg-[#1c1b2f]/70 border-0 border-[#598185]/40 dark:border-[#86cb92]/40
                          rounded-2xl shadow-lg p-4 sm:p-6 space-y-4 sm:space-y-6"
        onSubmit={handleSubmit}
        autoComplete="off"
      >
        <motion.div
          className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-[#260f26] dark:text-[#86cb92]"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Cog6ToothIcon className="w-5 h-5 sm:w-6 sm:h-6" /> Create Campaign
        </motion.div>

        {/* Feedback */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-[#2b1c1c] p-2 rounded"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <ExclamationTriangleIcon className="w-5 h-5" />
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              className="flex items-center gap-2 text-green-700 bg-green-50 dark:bg-[#1c2b1c] p-2 rounded"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <CheckCircleIcon className="w-5 h-5" />
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Core Settings */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 px-2 sm:px-4"
          variants={sectionVariants}
          custom={2}
        >
          <AnimatedField index={0}>
            <Input
              label="Target URL"
              name="url"
              placeholder="https://example.com"
              value={data.url}
              onChange={handleChange}
              required
            />
          </AnimatedField>

          <AnimatedField index={1}>
            <VisitDurationRange
              label="Visit Duration Range (sec)"
              minValue={data.visitDurationMin}
              maxValue={data.visitDurationMax}
              onMinChange={handleVisitDurationMinChange}
              onMaxChange={handleVisitDurationMaxChange}
              tooltip="Set a range for visit duration to simulate realistic user behavior. Each session will randomly select a duration within this range."
            />
          </AnimatedField>

          <AnimatedField index={2}>
            <Input
              label="Delay Between Visits (sec)"
              name="delay"
              type="number"
              value={data.delay}
              onChange={handleChange}
            />
          </AnimatedField>

          <AnimatedField index={3}>
            <Slider
              label="Bounce Rate (%)"
              value={data.bounceRate}
              onChange={handleSliderChange}
              name="bounceRate"
            />
          </AnimatedField>

          <AnimatedField index={4}>
            <Input
              label="Concurrent Sessions"
              name="concurrent"
              type="number"
              value={data.concurrent}
              onChange={handleChange}
              tooltip="Number of browser sessions running simultaneously"
            />
          </AnimatedField>

          <AnimatedField index={5}>
            <div className="flex items-center space-x-4 mt-4 sm:mt-6">
              <Switch
                checked={data.scrolling}
                onChange={handleCheckboxChange}
                name="scrolling"
                label="Enable Scrolling"
              />
            </div>
          </AnimatedField>

          <AnimatedField index={6}>
            <Slider
              label="Headful Browser Sessions (%)"
              value={data.headfulPercentage}
              onChange={handleSliderChange}
              name="headfulPercentage"
              tooltip="Percentage of sessions that will run with visible browser windows (useful for debugging). 0% = all headless, 100% = all visible."
            />
          </AnimatedField>

          <AnimatedField index={7}>
            <Input
              label="Total Traffic Sessions"
              name="totalSessions"
              type="number"
              placeholder="Leave empty for unlimited"
              value={data.totalSessions}
              onChange={handleChange}
              tooltip="Total number of sessions to generate. Leave empty to run continuously until manually stopped."
            />
          </AnimatedField>

          <AnimatedField index={8}>
            <Input
              label="Organic Traffic (%)"
              name="organic"
              type="number"
              value={data.organic}
              onChange={handleChange}
              tooltip="Percentage of sessions that will be organic (not from referral sources). The proportion (%) of traffic considered organic (i.e., unpaid, from search engines). Balances between organic and paid/social sources to mimic real-world traffic composition."
            />
          </AnimatedField>

          <AnimatedField index={9}>
            <Slider
              label="Desktop Traffic (%)"
              value={data.desktopPercentage}
              onChange={handleSliderChange}
              name="desktopPercentage"
              tooltip="Percentage of sessions that will use desktop devices. 0% = all mobile, 100% = all desktop. Remaining percentage will be mobile traffic."
            />
          </AnimatedField>

          <AnimatedField index={10}>
            <GeoSelect
              label="Geographic Targeting"
              value={data.geo}
              onChange={(value) => setData((d) => ({ ...d, geo: value }))}
              tooltip="Select the geographic location for traffic simulation. 'Global' targets all regions, while specific countries focus traffic from that location."
            />
          </AnimatedField>

          <AnimatedField index={11}>
            <Input
              label="CSS Ad Selectors"
              name="adSelectors"
              placeholder=".GoogleActiveViewElement, .ad-class, #ad-iframe"
              value={data.adSelectors}
              onChange={handleChange}
              tooltip="Comma-separated list of CSS selectors for ads to be clicked. Leave empty for default selectors."
            />
          </AnimatedField>

          <AnimatedField index={12}>
            <Input
              label="Google Ads Container X-Paths"
              name="adsXPath"
              placeholder="//div[@data-google-av-cxn], //ins[@class='adsbygoogle'], //div[contains(@class, 'GoogleActiveViewElement')]"
              value={data.adsXPath}
              onChange={handleChange}
              tooltip="Comma-separated list of X-Path expressions for Google Ads container elements. Examples: //div[@data-google-av-cxn], //ins[@class='adsbygoogle'], //div[contains(@class, 'GoogleActiveViewElement')]. Only works in headful mode."
            />
          </AnimatedField>

          <AnimatedField index={13}>
            <Input
              label="Campaign Notes"
              name="notes"
              placeholder="Describe this campaign..."
              value={data.notes}
              onChange={handleChange}
            />
          </AnimatedField>
        </motion.div>

        {/* Enhanced Scheduling Section */}
        <motion.div
          className="pt-4 sm:pt-6 border-t border-[#598185]/20 dark:border-[#86cb92]/20 space-y-4"
          variants={sectionVariants}
          custom={3}
        >
          <div className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-[#260f26] dark:text-[#86cb92]">
            <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5" /> Schedule
          </div>
          <div className='px-2 sm:px-4'>
            <Switch
              checked={data.scheduling}
              onChange={handleCheckboxChange}
              name="scheduling"
              label="Enable Scheduling"
            />
            <AnimatePresence>
              {data.scheduling && (
                <motion.div
                  className="space-y-4 mt-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                >
                  {/* Enhanced Date Selection with Dependencies */}
                  <DateSelectionSection 
                    data={data}
                    handleStartDateChange={handleStartDateChange}
                    handleEndDateChange={handleEndDateChange}
                    getDateValidation={getDateValidation}
                  />
                  
                  {/* Time Selection */}
                  <TimeSelectionSection 
                    data={data}
                    handleStartTimeChange={handleStartTimeChange}
                    handleEndTimeChange={handleEndTimeChange}
                    getTimeValidation={getTimeValidation}
                  />
                  
                  {/* Duration Display */}
                  <SchedulingDurationDisplay 
                    data={data}
                    dateValidation={getDateValidation()}
                    timeValidation={getTimeValidation()}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Cookies Management Section */}
        <motion.div
          className="pt-4 sm:pt-6 border-t border-[#598185]/20 dark:border-[#86cb92]/20 space-y-4"
          variants={sectionVariants}
          custom={4}
        >
          <CookiesManagementSection 
            data={data}
            onCookiesChange={handleCookiesChange}
          />
        </motion.div>

        {/* Referral Sources */}
        <motion.div
          className="pt-4 sm:pt-6 border-t border-[#598185]/20 dark:border-[#86cb92]/20 space-y-4"
          variants={sectionVariants}
          custom={4}
        >
          <div className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-[#260f26] dark:text-[#86cb92]">
            <ShareIcon className="w-4 h-4 sm:w-5 sm:h-5" /> Referral Sources
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 px-2 sm:px-4">
            <div className='px-0'>
              <Label>Social Media</Label>
              <div className="space-y-2 mt-2 ml-2 max-w-10">
                {Object.keys(data.social).map((src, idx) => (
                  <motion.div
                    key={src}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * idx }}
                  >
                    <Checkbox
                      label={`${src}`}
                      name={src}
                      checked={data.social[src]}
                      onChange={handleSocialChange}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
            <div>
              <Label>Custom Referrers</Label>
              <Textarea
                placeholder="One URL per line"
                name="custom"
                value={data.custom}
                onChange={handleChange}
              />
            </div>
          </div>
        </motion.div>

        {/* Submit & Reset */}
        <motion.div
          className="text-center sm:text-right flex flex-col sm:flex-row gap-2 justify-center sm:justify-end"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <button
            type="button"
            className="mt-4 px-4 py-2 bg-gray-200 dark:bg-[#333762] text-[#404e7c] dark:text-[#d0d2e5] rounded-lg transition hover:bg-gray-300 hover:dark:bg-[#404e7c] flex items-center justify-center"
            onClick={handleReset}
            disabled={loading}
          >
            <ArrowPathIcon className="inline w-5 h-5 mr-1" /> Reset
          </button>
          <button
            type="submit"
            className="mt-4 px-6 py-2 bg-[#598185] hover:bg-[#4b8b7b] text-white rounded-lg transition flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="4" />
              </svg>
            ) : null}
            Create Campaign
          </button>
        </motion.div>
      </motion.form>

      {/* Active Campaigns */}
      <CampaignSection
        title="Active Campaigns"
        icon={BoltIcon}
        campaigns={activeCampaigns}
        onDeleteClick={openDeleteDialog}
        onStopClick={handleStopCampaign}
        emptyText="No active campaigns."
        showStop={true}
        showDelete={false}
      />

      {/* Scheduled Campaigns */}
      <CampaignSection
        title="Scheduled Campaigns"
        icon={CalendarIcon}
        campaigns={scheduledCampaigns}
        onDeleteClick={openDeleteDialog}
        emptyText="No scheduled campaigns."
        showStop={false}
      />

      {/* Previous Campaigns */}
      <CampaignSection
        title="Previous Campaigns"
        icon={PencilIcon}
        campaigns={previousCampaigns}
        onDeleteClick={openDeleteDialog}
        emptyText="No previous campaigns yet."
        showStop={false}
      />

      {/* Delete Confirmation Dialog */}
      <Transition appear show={showDeleteDialog} as={React.Fragment}>
        <Dialog as="div" className="relative z-30" onClose={handleDeleteCancel}>
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
              <Dialog.Panel className="w-full max-w-sm sm:max-w-md rounded-2xl bg-white dark:bg-[#1c1b2f] p-4 sm:p-6 shadow-xl border border-[#86cb92]/30">
                <div className="flex items-center gap-3 mb-3">
                  <ExclamationTriangleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 flex-shrink-0" />
                  <Dialog.Title className="text-base sm:text-lg font-bold text-[#260f26] dark:text-[#86cb92]">
                    Confirm Campaign Deletion
                  </Dialog.Title>
                </div>
                <div className="text-sm sm:text-base text-[#404e7c] dark:text-[#d0d2e5] mb-4 sm:mb-6">
                  Are you sure you want to delete this campaign? <br />
                  <b>This action is irreversible.</b>
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 justify-end">
                  <button
                    onClick={handleDeleteCancel}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#eaeaff] dark:bg-[#333762] text-[#404e7c] dark:text-[#86cb92] font-medium hover:bg-[#86cb92]/20 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirmed}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition"
                  >
                    Delete
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </motion.div>
  )
}