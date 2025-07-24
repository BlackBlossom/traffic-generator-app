import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@heroicons/react/24/outline'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function CalendarPicker({ 
  label, 
  value, 
  onChange, 
  isInvalid = false, 
  validationMessage = '',
  minDate = null, // For end date dependency
  disabled = false 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  // Parse the current value or use today as default
  const selectedDate = useMemo(() => {
    if (value) {
      return new Date(value + 'T00:00:00')
    }
    return null
  }, [value])

  // Set initial month based on selected date or minDate
  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    } else if (minDate) {
      const min = new Date(minDate + 'T00:00:00')
      setCurrentMonth(new Date(min.getFullYear(), min.getMonth(), 1))
    }
  }, [selectedDate, minDate])

  // Get days in current month
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysCount = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    const days = []
    
    // Previous month's trailing days
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevDate = new Date(year, month, -startingDayOfWeek + i + 1)
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isDisabled: true
      })
    }
    
    // Current month days
    for (let day = 1; day <= daysCount; day++) {
      const date = new Date(year, month, day)
      const today = new Date()
      const isToday = date.toDateString() === today.toDateString()
      const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString()
      
      // Check if date is disabled
      let isDisabled = disabled
      
      // For start date (no minDate), disable dates before today
      if (!minDate && !isDisabled) {
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        isDisabled = date < todayStart
      }
      
      // For end date (has minDate), disable dates before minDate
      if (minDate && !isDisabled) {
        const min = new Date(minDate + 'T00:00:00')
        isDisabled = date < min
      }
      
      days.push({
        date,
        isCurrentMonth: true,
        isToday,
        isSelected,
        isDisabled
      })
    }
    
    // Next month's leading days to fill the grid
    const remainingDays = 42 - days.length // 6 rows × 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const nextDate = new Date(year, month + 1, day)
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isDisabled: true
      })
    }
    
    return days
  }, [currentMonth, selectedDate, minDate, disabled])

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      newMonth.setMonth(prev.getMonth() + direction)
      return newMonth
    })
  }

  const selectDate = (dateObj) => {
    if (dateObj.isDisabled) return
    
    // Format date as YYYY-MM-DD in local timezone to avoid UTC conversion issues
    const year = dateObj.date.getFullYear()
    const month = String(dateObj.date.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.date.getDate()).padStart(2, '0')
    const dateString = `${year}-${month}-${day}`
    
    onChange({ target: { value: dateString } })
    setIsOpen(false)
  }

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Select date'
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <div className="relative">
      {label && (
        <label className={`block text-sm font-medium mb-1 ${
          isInvalid 
            ? 'text-red-600 dark:text-red-400' 
            : 'text-[#404e7c] dark:text-[#d0d2e5]'
        }`}>
          {label}
        </label>
      )}
      
      {/* Date Input Button */}
      <motion.button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full h-10 px-3 pr-8 rounded-lg bg-white/60 dark:bg-[#1c1b2f]/60 
                   border text-left text-sm flex items-center justify-between
                   focus:outline-none focus:ring-2 transition ${
                     isInvalid
                       ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
                       : 'border-[#598185] dark:border-[#86cb92] focus:ring-[#86cb92]'
                   } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        whileHover={!disabled ? { scale: 1.01 } : {}}
        whileTap={!disabled ? { scale: 0.99 } : {}}
      >
        <span className={value ? 'text-[#404e7c] dark:text-[#d0d2e5]' : 'text-gray-400'}>
          {formatDisplayDate(value)}
        </span>
        <CalendarIcon className="w-4 h-4 text-[#404e7c] dark:text-[#d0d2e5]" />
      </motion.button>

      {/* Calendar Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute z-50 mt-1 bg-white dark:bg-[#1c1b2f] border border-[#598185]/40 dark:border-[#86cb92]/40 
                       rounded-xl shadow-2xl p-4 w-80 left-0"
          >
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <motion.button
                type="button"
                onClick={() => navigateMonth(-1)}
                className="p-2 rounded-lg hover:bg-[#598185]/10 dark:hover:bg-[#86cb92]/10 transition"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <ChevronLeftIcon className="w-4 h-4 text-[#404e7c] dark:text-[#d0d2e5]" />
              </motion.button>
              
              <motion.h3 
                className="text-lg font-semibold text-[#260f26] dark:text-[#86cb92]"
                key={currentMonth.toISOString()}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </motion.h3>
              
              <motion.button
                type="button"
                onClick={() => navigateMonth(1)}
                className="p-2 rounded-lg hover:bg-[#598185]/10 dark:hover:bg-[#86cb92]/10 transition"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <ChevronRightIcon className="w-4 h-4 text-[#404e7c] dark:text-[#d0d2e5]" />
              </motion.button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map((day) => (
                <div 
                  key={day}
                  className="text-center text-xs font-medium text-[#598185] dark:text-[#86cb92] py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <motion.div 
              className="grid grid-cols-7 gap-1"
              key={currentMonth.toISOString()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {daysInMonth.map((dayObj, index) => (
                <motion.button
                  key={index}
                  type="button"
                  onClick={() => selectDate(dayObj)}
                  disabled={dayObj.isDisabled}
                  className={`
                    h-8 w-8 text-sm rounded-lg transition-all duration-200 flex items-center justify-center
                    ${dayObj.isCurrentMonth 
                      ? dayObj.isSelected
                        ? 'bg-[#598185] text-white font-semibold shadow-lg'
                        : dayObj.isToday
                          ? 'bg-[#86cb92]/20 text-[#260f26] dark:text-[#86cb92] font-semibold border border-[#86cb92]'
                          : dayObj.isDisabled
                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            : 'text-[#404e7c] dark:text-[#d0d2e5] hover:bg-[#598185]/10 dark:hover:bg-[#86cb92]/10'
                      : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    }
                  `}
                  whileHover={!dayObj.isDisabled ? { scale: 1.1 } : {}}
                  whileTap={!dayObj.isDisabled ? { scale: 0.9 } : {}}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.01, duration: 0.2 }}
                >
                  {dayObj.date.getDate()}
                </motion.button>
              ))}
            </motion.div>

            {/* Today Button */}
            <div className="mt-4 pt-3 border-t border-[#598185]/20 dark:border-[#86cb92]/20">
              <motion.button
                type="button"
                onClick={() => {
                  const today = new Date()
                  
                  // Format today's date as YYYY-MM-DD in local timezone
                  const year = today.getFullYear()
                  const month = String(today.getMonth() + 1).padStart(2, '0')
                  const day = String(today.getDate()).padStart(2, '0')
                  const todayString = `${year}-${month}-${day}`
                  
                  // For end date: Check if today is valid (not before minDate)
                  if (minDate) {
                    const min = new Date(minDate + 'T00:00:00')
                    if (today < min) {
                      onChange({ target: { value: minDate } })
                      setIsOpen(false)
                      return
                    }
                  }
                  
                  // For both start and end date: Set today's date
                  onChange({ target: { value: todayString } })
                  setIsOpen(false)
                }}
                className="w-full py-2 text-sm text-[#598185] dark:text-[#86cb92] hover:bg-[#598185]/10 
                          dark:hover:bg-[#86cb92]/10 rounded-lg transition font-medium"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {minDate && new Date() < new Date(minDate + 'T00:00:00') ? 'Select Start Date' : 'Today'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation Message */}
      {isInvalid && validationMessage && (
        <motion.div 
          className="text-xs text-red-600 dark:text-red-400 text-center mt-1"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {validationMessage}
        </motion.div>
      )}

      {/* Click Outside Handler */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default CalendarPicker
