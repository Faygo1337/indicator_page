import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ReactNode } from "react";

interface AnimatedHoverCardProps {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AnimatedHoverCard({ trigger, children, className }: AnimatedHoverCardProps) {
  // const contentRef = useRef<HTMLDivElement>(null);

  return (
    <HoverCard openDelay={0} closeDelay={100}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <AnimatePresence>
        <HoverCardContent
          asChild
          side="top"
          align="start"
          className={className}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{
              duration: 0.2,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            {children}
          </motion.div>
        </HoverCardContent>
      </AnimatePresence>
    </HoverCard>
  );
}
