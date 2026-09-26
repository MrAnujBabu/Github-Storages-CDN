import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | undefined;
  children: ReactNode;
  footer?: ReactNode;
  className?: string | undefined;
  /** Prevent closing while a write is in flight. */
  locked?: boolean | undefined;
}

/** Centered dialog on desktop, bottom sheet on phones. */
export function ResponsiveDialog({ open, onOpenChange, title, description, children, footer, className, locked }: Props) {
  const isMobile = useIsMobile();
  const handleChange = (next: boolean) => {
    if (locked && !next) return;
    onOpenChange(next);
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleChange} dismissible={!locked}>
        <DrawerContent className={cn("max-h-[92dvh] rounded-t-2xl", className)}>
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-display text-xl font-semibold">{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">{children}</div>
          {footer ? <DrawerFooter className="safe-bottom pt-2">{footer}</DrawerFooter> : <div className="safe-bottom h-4" />}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleChange}>
      <DialogContent
        className={cn("max-h-[90vh] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg", className)}
        onInteractOutside={(e) => {
          if (locked) e.preventDefault();
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 text-left">
          <DialogTitle className="font-display text-xl font-semibold">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-6 pb-4">{children}</div>
        {footer ? <DialogFooter className="border-t bg-muted/40 px-6 py-4 sm:justify-end">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
