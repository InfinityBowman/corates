/**
 * PasswordInput component with visibility toggle (@ark-ui/react)
 *
 * @example
 * <PasswordInput>
 *   <PasswordInputLabel>Password</PasswordInputLabel>
 *   <PasswordInputControl>
 *     <PasswordInputField />
 *     <PasswordInputVisibilityTrigger />
 *   </PasswordInputControl>
 * </PasswordInput>
 */

import * as React from "react"
import { PasswordInput as PasswordInputPrimitive } from "@ark-ui/react/password-input"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const PasswordInputIndicator = PasswordInputPrimitive.Indicator
const PasswordInputContext = PasswordInputPrimitive.Context

function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof PasswordInputPrimitive.Root>) {
  return <PasswordInputPrimitive.Root className={cn("w-full", className)} {...props} />
}

function PasswordInputLabel({
  className,
  ...props
}: React.ComponentProps<typeof PasswordInputPrimitive.Label>) {
  return (
    <PasswordInputPrimitive.Label
      className={cn("mb-1 block text-sm font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

function PasswordInputControl({
  className,
  ...props
}: React.ComponentProps<typeof PasswordInputPrimitive.Control>) {
  return (
    <PasswordInputPrimitive.Control
      className={cn("relative flex items-center", className)}
      {...props}
    />
  )
}

function PasswordInputField({
  className,
  ...props
}: React.ComponentProps<typeof PasswordInputPrimitive.Input>) {
  return (
    <PasswordInputPrimitive.Input
      className={cn(
        "w-full rounded-lg border border-border px-3 py-2 pr-10 text-sm transition",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

function PasswordInputVisibilityTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PasswordInputPrimitive.VisibilityTrigger>) {
  return (
    <PasswordInputPrimitive.VisibilityTrigger
      className={cn(
        "absolute right-3 flex items-center text-muted-foreground/70 transition-colors",
        "hover:text-muted-foreground focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children ?? (
        <PasswordInputPrimitive.Indicator fallback={<EyeOffIcon className="h-4 w-4" />}>
          <EyeIcon className="h-4 w-4" />
        </PasswordInputPrimitive.Indicator>
      )}
    </PasswordInputPrimitive.VisibilityTrigger>
  )
}

export {
  PasswordInput,
  PasswordInputLabel,
  PasswordInputControl,
  PasswordInputField,
  PasswordInputVisibilityTrigger,
  PasswordInputIndicator,
  PasswordInputContext,
}
