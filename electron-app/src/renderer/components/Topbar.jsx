import { FaUserCircle } from 'react-icons/fa'
import { motion } from 'framer-motion'
import ThemeToggle from './ThemeToggle'
import { NavLink } from 'react-router-dom'

export default function Topbar({ collapsed }) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0, left: collapsed ? 80 : 260 }}
      animate={{
        y: 0,
        opacity: 1,
        left: collapsed ? 80 : 260
      }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className={`fixed top-8 z-30 right-0 h-16 px-4 flex items-center justify-between border-b border-[#e0e0e0] dark:border-[#333762] bg-white/70 dark:bg-[#1c1b2f]/70 backdrop-blur-md shadow-sm`}
      style={{ position: 'fixed' }}
    >
      {/* Left: App Title */}
      <h1 className="text-2xl font-bold text-[#260f26] dark:text-[#86cb92] tracking-wide">
        {collapsed? "RST" : ""}
      </h1>

      {/* Right: Toggle + Profile */}
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <NavLink
          to="/profile"
          className="text-2xl text-[#404e7c] dark:text-[#d0d2e5] hover:text-[#86cb92] transition-all"
          aria-label="Profile"
        >
          <FaUserCircle />
        </NavLink>
      </div>
    </motion.header>
  )
}
