/**
 * Steps component for multi-step wizards and progress indicators (@ark-ui/react)
 *
 * @example
 * <Steps count={3} defaultStep={0}>
 *   <StepsList>
 *     <StepsItem index={0}>
 *       <StepsTrigger><StepsIndicator>1</StepsIndicator></StepsTrigger>
 *       <StepsSeparator />
 *     </StepsItem>
 *     ...
 *   </StepsList>
 *   <StepsContent index={0}>Step 1 content</StepsContent>
 *   <StepsCompletedContent>All done!</StepsCompletedContent>
 *   <StepsPrevTrigger>Previous</StepsPrevTrigger>
 *   <StepsNextTrigger>Next</StepsNextTrigger>
 * </Steps>
 */

import * as React from "react"
import { Steps as StepsPrimitive } from "@ark-ui/react/steps"
import { cn } from "@/lib/utils"

function Steps({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.Root>) {
  return <StepsPrimitive.Root className={className} {...props} />
}

function StepsList({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.List>) {
  return <StepsPrimitive.List className={cn("flex items-center gap-2", className)} {...props} />
}

function StepsItem({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.Item>) {
  return <StepsPrimitive.Item className={cn("flex items-center gap-2", className)} {...props} />
}

function StepsTrigger({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.Trigger>) {
  return <StepsPrimitive.Trigger className={className} {...props} />
}

function StepsIndicator({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.Indicator>) {
  return <StepsPrimitive.Indicator className={className} {...props} />
}

function StepsSeparator({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.Separator>) {
  return (
    <StepsPrimitive.Separator
      className={cn("h-0.5 flex-1 bg-secondary data-[complete]:bg-primary", className)}
      {...props}
    />
  )
}

function StepsContent({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.Content>) {
  return <StepsPrimitive.Content className={className} {...props} />
}

function StepsCompletedContent({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.CompletedContent>) {
  return <StepsPrimitive.CompletedContent className={className} {...props} />
}

function StepsNextTrigger({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.NextTrigger>) {
  return <StepsPrimitive.NextTrigger className={className} {...props} />
}

function StepsPrevTrigger({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.PrevTrigger>) {
  return <StepsPrimitive.PrevTrigger className={className} {...props} />
}

export {
  Steps,
  StepsList,
  StepsItem,
  StepsTrigger,
  StepsIndicator,
  StepsSeparator,
  StepsContent,
  StepsCompletedContent,
  StepsNextTrigger,
  StepsPrevTrigger,
}
