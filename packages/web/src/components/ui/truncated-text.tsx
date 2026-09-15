/**
 * TruncatedText - single-line text that reveals itself in a tooltip when clipped.
 *
 * The tooltip is mounted only while the text is too long. Needs a `min-w-0`
 * parent to truncate inside a flex row.
 *
 * @example
 * <TruncatedText text={study.name} className='text-foreground font-medium' />
 */

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsTruncated } from '@/hooks/useIsTruncated';
import { cn } from '@/lib/utils';

/** The provider opens tooltips instantly; names need a beat so scanning a list stays quiet. */
const NAME_TOOLTIP_DELAY_MS = 500;

interface TruncatedTextProps {
  text: string;
  className?: string;
}

function TruncatedText({ text, className }: TruncatedTextProps) {
  const [ref, isTruncated] = useIsTruncated(text);

  const content = (
    <span ref={ref} className={cn('block truncate', className)}>
      {text}
    </span>
  );

  if (!isTruncated) return content;

  return (
    <Tooltip delayDuration={NAME_TOOLTIP_DELAY_MS}>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent className='max-w-sm'>{text}</TooltipContent>
    </Tooltip>
  );
}

export { TruncatedText, NAME_TOOLTIP_DELAY_MS };
