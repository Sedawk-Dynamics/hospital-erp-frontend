"use client"

import { isValidElement } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium font-label whitespace-nowrap transition-all duration-200 outline-none select-none active:scale-[0.97] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:shadow-lg transition-shadow",
        outline:
          "border-outline-variant/30 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high",
        secondary:
          "bg-secondary text-on-secondary hover:shadow-lg transition-shadow",
        ghost:
          "hover:bg-surface-container-high hover:text-on-surface",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/15",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 rounded-lg px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-lg px-3 text-[0.8rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-6 text-sm font-bold has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-8",
        "icon-xs": "size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)


/**
 * Whether the element being rendered is a real <button>.
 *
 * Base UI warns when a button-like component renders something else, because
 * doing so silently drops native button semantics — form submission, Enter/Space
 * activation, the implicit ARIA role. The fix it asks for is `nativeButton=
 * {false}`, which every call site then has to remember.
 *
 * A navigation button written as `render={<Link/>}` is an ordinary thing to
 * want, so infer it here instead: only when `render` is an element, and only
 * when the caller has not answered for themselves. Returning undefined leaves
 * Base UI's own default in place.
 */
export function inferNativeButton(
  render: unknown,
  explicit: boolean | undefined,
): boolean | undefined {
  if (explicit !== undefined) return explicit;
  // A render FUNCTION cannot be inspected — leave the default alone.
  if (!isValidElement(render)) return undefined;
  return render.type === 'button';
}

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={inferNativeButton(props.render, nativeButton)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
