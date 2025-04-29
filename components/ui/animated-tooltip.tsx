// import { motion, AnimatePresence } from "framer-motion";
// import { ReactNode } from "react";
// import { cn } from "@/lib/utils";

// interface AnimatedTooltipProps {
//   children: ReactNode;
//   isVisible: boolean;
//   copied: boolean;
// }

// export function AnimatedTooltip({ children, isVisible, copied }: AnimatedTooltipProps) {
//   return (
//     <AnimatePresence>
//       {isVisible && (
//         <motion.div
//           initial={{ opacity: 0, scale: 0.95, y: 5 }}
//           animate={{ opacity: 1, scale: 1, y: 0 }}
//           exit={{ opacity: 0, scale: 0.95, y: 5 }}
//           transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
//           className={cn(
//             "absolute -top-7 left-1/3 transform -translate-x-1/2 px-2 py-1 text-xs rounded-md whitespace-nowrap z-50",
//             "bg-popover border border-border shadow-md",
//             copied ? "bg-green-900/90 border-green-700" : "bg-gray-900/90 border-gray-700"
//           )}
//         >
//           <motion.div
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             className="relative"
//           >
//             {children}
//             <motion.div
//               className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 rotate-45 w-2 h-2 bg-inherit border-r border-b border-border"
//               layoutId="tooltip-arrow"
//             />
//           </motion.div>
//         </motion.div>
//       )}
//     </AnimatePresence>
//   );
// }
