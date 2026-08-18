import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  onWheel,
  step,
  ...props
}: React.ComponentProps<"input">) {
  // A wheel scroll over a FOCUSED `type="number"` field is a browser-level
  // increment: it steps the value and fires change. So scrolling past a form
  // silently rewrote what had already been typed — 10.5 came back as 10,
  // because the implicit step of 1 snaps the value to whole numbers.
  //
  // Dropping focus first lets the page scroll the way the user intended and
  // leaves the value exactly as typed. The event still propagates, so the
  // scroll itself is not swallowed (which is why this is preferred over
  // preventDefault — React attaches wheel listeners passively at the root, so
  // preventDefault would not fire reliably anyway).
  const handleWheel = React.useCallback(
    (e: React.WheelEvent<HTMLInputElement>) => {
      if (type === "number" && document.activeElement === e.currentTarget) {
        e.currentTarget.blur()
      }
      onWheel?.(e)
    },
    [type, onWheel],
  )

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      // Without an explicit step the implicit value is 1, which makes every
      // decimal fail native validation and makes arrow/wheel stepping jump in
      // whole units — wrong for dose, weight, temperature and price fields.
      // Callers that genuinely want whole numbers pass their own step.
      step={type === "number" ? (step ?? "any") : step}
      onWheel={handleWheel}
      className={cn(
        "h-8 w-full min-w-0 rounded-xl border-none bg-surface-container-low px-3 py-1 text-base font-label text-sm shadow-xs transition-all duration-200 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-on-surface-variant/50 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:shadow-sm disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
