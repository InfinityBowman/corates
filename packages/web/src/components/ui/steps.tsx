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
 *   <StepsViewport>
 *     <StepsContent index={0}>Step 1 content</StepsContent>
 *     <StepsCompletedContent>All done!</StepsCompletedContent>
 *   </StepsViewport>
 *   <StepsPrevTrigger>Previous</StepsPrevTrigger>
 *   <StepsNextTrigger>Next</StepsNextTrigger>
 * </Steps>
 */

import * as React from 'react';
import { Steps as StepsPrimitive } from '@ark-ui/react/steps';
import { cn } from '@/lib/utils';

function Steps({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.Root>) {
  return <StepsPrimitive.Root className={className} {...props} />;
}

function StepsList({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.List>) {
  return <StepsPrimitive.List className={cn('flex items-center gap-2', className)} {...props} />;
}

function StepsItem({ className, ...props }: React.ComponentProps<typeof StepsPrimitive.Item>) {
  return <StepsPrimitive.Item className={cn('flex items-center gap-2', className)} {...props} />;
}

function StepsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof StepsPrimitive.Trigger>) {
  return <StepsPrimitive.Trigger className={className} {...props} />;
}

function StepsIndicator({
  className,
  ...props
}: React.ComponentProps<typeof StepsPrimitive.Indicator>) {
  return <StepsPrimitive.Indicator className={className} {...props} />;
}

function StepsSeparator({
  className,
  ...props
}: React.ComponentProps<typeof StepsPrimitive.Separator>) {
  return (
    <StepsPrimitive.Separator
      className={cn('bg-secondary data-[complete]:bg-primary h-0.5 flex-1 rounded-full', className)}
      {...props}
    />
  );
}

function StepsContent({
  className,
  ...props
}: React.ComponentProps<typeof StepsPrimitive.Content>) {
  return <StepsPrimitive.Content className={className} {...props} />;
}

// Must match duration-[260ms] below; Tailwind needs the class as a literal.
const STEPS_HEIGHT_MS = 260;

/**
 * Animates its own height to whatever step is showing, so the card eases
 * between steps of different sizes instead of snapping. Wrap the Content and
 * CompletedContent blocks in it; leave the List outside so the indicator row
 * holds its position.
 */
function StepsViewport({ className, children, ...props }: React.ComponentProps<'div'>) {
  const box = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const outer = box.current;
    const content = inner.current;
    if (!outer || !content) return;

    let settled: ReturnType<typeof setTimeout>;
    let firstPass = true;

    // Written straight to the node rather than through state: a setState here
    // commits a render after the step swap has already painted, which shows up
    // as a frame of clipped content.
    const observer = new ResizeObserver(([entry]) => {
      outer.style.height = `${entry.contentRect.height}px`;
      if (firstPass) {
        firstPass = false;
        return;
      }
      // Only clip while the height is in flight. At rest the box hugs its
      // content, where overflow-hidden would cut the focus ring off the
      // full-width fields and the last button.
      outer.dataset.resizing = 'true';
      clearTimeout(settled);
      settled = setTimeout(() => delete outer.dataset.resizing, STEPS_HEIGHT_MS + 40);
    });
    observer.observe(content);

    return () => {
      observer.disconnect();
      clearTimeout(settled);
    };
  }, []);

  return (
    // Height stays auto until the observer first fires, and auto does not
    // interpolate, so the first paint lands without animating from zero.
    <div
      ref={box}
      className={cn(
        'transition-[height] duration-[260ms] data-[resizing]:overflow-hidden',
        'ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}

function StepsCompletedContent({
  className,
  ...props
}: React.ComponentProps<typeof StepsPrimitive.CompletedContent>) {
  return <StepsPrimitive.CompletedContent className={className} {...props} />;
}

function StepsNextTrigger({
  className,
  ...props
}: React.ComponentProps<typeof StepsPrimitive.NextTrigger>) {
  return <StepsPrimitive.NextTrigger className={className} {...props} />;
}

function StepsPrevTrigger({
  className,
  ...props
}: React.ComponentProps<typeof StepsPrimitive.PrevTrigger>) {
  return <StepsPrimitive.PrevTrigger className={className} {...props} />;
}

export {
  Steps,
  StepsList,
  StepsItem,
  StepsTrigger,
  StepsIndicator,
  StepsSeparator,
  StepsContent,
  StepsViewport,
  StepsCompletedContent,
  StepsNextTrigger,
  StepsPrevTrigger,
};
