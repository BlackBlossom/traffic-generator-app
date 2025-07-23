import { AnimatePresence, motion } from 'framer-motion'

export default function TooltipBox({ show, text }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          role="tooltip"
          aria-live="polite"
          className="
            absolute top-1/2 left-6 z-50
            min-w-[120px] max-w-[220px] xl:max-w-[280px]
            text-xs font-medium
            text-white
            bg-[#1c1b2f] dark:bg-[#260f26]
            border border-[#404e7c] dark:border-[#86cb92]
            px-3 py-2 rounded-md shadow-xl
            pointer-events-none
            flex flex-col
            select-none
          "
          style={{ transform: 'translateY(-50%)' }}
        >
          <span>{text}</span>
          {/* Triangle pointer */}
          <span
            className="
              absolute left-[-8px] top-1/2 -translate-y-1/2
              w-0 h-0 border-y-8 border-y-transparent border-r-8
              border-r-[#1c1b2f] dark:border-r-[#260f26]
            "
            aria-hidden="true"
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
