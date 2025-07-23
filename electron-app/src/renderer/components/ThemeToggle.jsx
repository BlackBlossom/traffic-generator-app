// src/components/ThemeToggle.jsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FaSun, FaMoon } from 'react-icons/fa'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = window.document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  return (
    <div
      onClick={() => setIsDark(prev => !prev)}
      className={`w-14 h-8 flex items-center px-1 rounded-full cursor-pointer transition-colors duration-300 ${
        isDark ? 'bg-[#86cb92]' : 'bg-[#404e7c]'
      }`}
    >
      <motion.div
        animate={{ x: isDark ? 24 : 0 }}
        transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
        className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center text-sm text-[#260f26]"
      >
        {isDark ? <FaMoon /> : <FaSun />}
      </motion.div>
    </div>
  )
}
