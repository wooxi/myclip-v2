import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border border-transparent px-2 py-0.5 text-[11px] font-medium [&>svg]:pointer-events-none [&>svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "text-foreground border-border",
        muted: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
        // DESIGN.md 语义色 soft：slate/indigo/amber/sky（同色系 60% 描边）
        slate:
          "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60",
        indigo:
          "bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60",
        amber:
          "bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60",
        sky: "bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/60",
        emerald:
          "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/70",
        rose: "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
