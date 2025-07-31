import React from "react";
import { motion } from "framer-motion";

const ToggleSwitch = ({ enabled, onToggle, disabled = false, label, description }) => {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex-1">
        {label && (
          <label className="block text-[15px] font-bold text-[#404e7c] dark:text-[#d0d2e5] mb-1">
            {label}
          </label>
        )}
        {description && (
          <p className="text-sm text-[#598185] dark:text-[#86cb92]/80">
            {description}
          </p>
        )}
      </div>
      
      <div
        onClick={() => !disabled && onToggle(!enabled)}
        className={`
          relative inline-flex h-6 w-12 items-center px-1 rounded-full cursor-pointer transition-colors duration-300 ease-in-out
          ${enabled 
            ? 'bg-[#86cb92]' 
            : 'bg-[#598185]/40 dark:bg-[#404e7c]/60'
          }
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'cursor-pointer hover:opacity-90'
          }
        `}
        role="switch"
        aria-checked={enabled}
        aria-disabled={disabled}
      >
        <motion.div
          animate={{ 
            x: enabled ? 24 : 0 
          }}
          transition={{ 
            type: 'tween', 
            duration: 0.25, 
            ease: 'easeInOut' 
          }}
          className="w-4 h-4 rounded-full bg-white shadow-md flex items-center justify-center"
        >
          {/* Optional: Add icons or indicators here */}
        </motion.div>
      </div>
    </div>
  );
};

export default ToggleSwitch;
