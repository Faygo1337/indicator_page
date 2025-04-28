import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface AnimatedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function AnimatedDialog({ open, onOpenChange, children, className }: AnimatedDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <>
            <DialogPrimitive.Portal forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ 
                  duration: 0.3,
                  ease: "easeInOut"
                }}
                className="fixed inset-0 z-50"
              >
                <DialogPrimitive.Overlay 
                  className="fixed inset-0"
                  style={{
                    background: 'rgba(0, 0, 0, 0.7)', // Более тёмный фон
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ backdropFilter: "blur(0px)" }}
                animate={{ backdropFilter: "blur(16px)" }} // Усиленное размытие
                exit={{ backdropFilter: "blur(0px)" }}
                transition={{
                  duration: 0.4,
                  ease: "easeInOut"
                }}
                className="fixed inset-0 z-50"
              />

              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <DialogPrimitive.Content
                  forceMount
                  asChild
                  className={cn(
                    "relative w-full max-w-lg grid gap-4 border bg-background shadow-lg sm:rounded-lg mx-4 sm:mx-auto",
                    className
                  )}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ 
                      opacity: 0,
                      scale: 0.95,
                      y: 10,
                      transition: { duration: 0.2 }
                    }}
                    transition={{
                      duration: 0.3,
                      type: "spring",
                      damping: 20,
                      stiffness: 300
                    }}
                    className="p-6"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.1,
                        duration: 0.2
                      }}
                    >
                      {children}
                    </motion.div>
                    <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-all hover:opacity-100 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      <motion.div
                        whileHover={{ rotate: 90 }}
                        transition={{ duration: 0.2 }}
                      >
                        <X className="h-4 w-4" />
                      </motion.div>
                      <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  </motion.div>
                </DialogPrimitive.Content>
              </div>
            </DialogPrimitive.Portal>
          </>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}