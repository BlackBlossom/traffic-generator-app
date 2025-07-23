// src/renderer/animations.js
export const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.5, type: "spring", stiffness: 80 }
  }),
  exit: { opacity: 0, y: 32, transition: { duration: 0.3 } },
};

export const fieldVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.03 * i, duration: 0.4 }
  }),
  exit: { opacity: 0, y: 20, transition: { duration: 0.3 } },
};

export const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.04 * i, duration: 0.4, type: "spring", stiffness: 90 }
  }),
  exit: { opacity: 0, y: 18, transition: { duration: 0.3 } },
};
