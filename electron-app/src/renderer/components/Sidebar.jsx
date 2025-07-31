import { useRef, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  FaBars,
  FaHome,
  FaCogs,
  FaServer,
  FaChartBar,
  FaBug,
  FaUser,
  FaSlidersH
} from 'react-icons/fa'
import { motion, AnimatePresence } from 'framer-motion'
//import Tooltip from './Tooltip'

const navItems = [
  { name: 'Dashboard', icon: <FaHome />, path: '/' },
  { name: 'SEO Settings', icon: <FaCogs />, path: '/traffic-settings' },
  { name: 'Proxy Management', icon: <FaServer />, path: '/proxy-management' },
  { name: 'SEO Analytics', icon: <FaChartBar />, path: '/traffic-analytics' },
  { name: 'Debug', icon: <FaBug />, path: '/debug' },
  { name: 'Profile', icon: <FaUser />, path: '/profile' },
]

function Tooltip({ targetRef, text }) {
  const [position, setPosition] = useState({ top: 0, left: 90 })

  useEffect(() => {
    const node = targetRef?.current
    if (node) {
      const rect = node.getBoundingClientRect()
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8
      })
    }
  }, [targetRef])

  return (
    <AnimatePresence>
      <motion.div
        key="tooltip"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        transition={{ duration: 0.2 }}
        className="fixed z-[1000] bg-black text-white text-xs px-2 py-1 rounded shadow whitespace-nowrap pointer-events-none"
        style={{ top: `${position.top - 12}px`, left: `${position.left}px`, transform: 'translateY(-50%)' }}
      >
        {text}
      </motion.div>
    </AnimatePresence>
  )
}

export default function Sidebar({ collapsed, setCollapsed }) {
//   const [collapsed, setCollapsed] = useState(false)
  const [hoveredItem, setHoveredItem] = useState(null)
  const [showLabels, setShowLabels] = useState(!collapsed)

  useEffect(() => {
    if (collapsed === "false") {
      const mediaQuery = window.matchMedia('(max-width: 767px)')

      const handleResize = () => {
        setCollapsed(mediaQuery.matches)
      }

      handleResize() // set initially

      mediaQuery.addEventListener('change', handleResize)
      return () => mediaQuery.removeEventListener('change', handleResize)
    } else {
      // If collapsed is a boolean, just set it directly
      setCollapsed(collapsed)
    }
  }, [setCollapsed])


  useEffect(() => {
    if (collapsed) {
        // Hide labels immediately on collapse
        setShowLabels(false)
    } else {
        // Show labels after sidebar expansion animation finishes
        const timeout = setTimeout(() => setShowLabels(true), 300)
        return () => clearTimeout(timeout)
    }
  }, [collapsed])

  // Create an array of refs — one per nav item
  const itemRefs = navItems.map(() => useRef(null))

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={`h-screen fixed top-8 left-0 z-50 flex flex-col bg-white/60 dark:bg-[#1c1b2f]/60 border-r border-[#e0e0e0] dark:border-[#333762] shadow-xl backdrop-blur-md  rounded-br-2xl overflow-x-hidden ${
          collapsed ? 'overflow-y-hidden' : 'overflow-y-auto'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center h-16 ${
            collapsed ? 'justify-center' : 'justify-between px-4'
          } py-5 border-b border-[#e0e0e0] dark:border-[#333762]`}
        >
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-2xl font-bold text-[#260f26] dark:text-[#86cb92] tracking-wide origin-left"
            >
              RST
            </motion.span>
          )}
          <button
            onClick={() => setCollapsed(prev => !prev)}
            className="text-[#260f26] dark:text-[#86cb92] text-xl"
            title="Toggle Sidebar"
          >
            <FaBars />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item, index) => (
            <div
              key={item.name}
              className="relative"
              ref={itemRefs[index]}
              onMouseEnter={() => collapsed && setHoveredItem({ name: item.name, index })}
              onMouseLeave={() => collapsed && setHoveredItem(null)}
            >
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `group relative flex items-center ${
                    collapsed ? 'justify-center' : 'gap-3 px-4'
                  } py-2.5 rounded-xl transition-all duration-200 font-medium ${
                    isActive
                      ? 'bg-gradient-to-r from-[#86cb92] to-[#71b48d] text-white shadow-lg'
                      : 'text-[#404e7c] dark:text-[#d0d2e5] hover:bg-[#eaeaff] dark:hover:bg-[#2e2c4d] hover:text-[#260f26] dark:hover:text-white'
                  }`
                }
              >
                <span className="text-2xl">{item.icon}</span>

                <AnimatePresence>
                  {showLabels && (
                    <motion.span
                      key="label"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={collapsed ? {} : 
                      { opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="text-[16px] tracking-wide"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            </div>
          ))}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <motion.div
            key="footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-center text-[#598185] dark:text-[#86cb92] border-t border-[#e0e0e0] dark:border-[#333762] py-3"
          >
            RST © 2025
          </motion.div>
        )}
      </motion.aside>

      {/* Tooltip */}
      {collapsed && hoveredItem && (
        <Tooltip
          targetRef={itemRefs[hoveredItem.index]}
          text={hoveredItem.name}
        />
      )}
    </>
  )
}
