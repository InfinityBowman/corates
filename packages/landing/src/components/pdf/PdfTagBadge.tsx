/**
 * PdfTagBadge - Visual badge indicating PDF tag type (primary, protocol)
 */

import { StarIcon, FileTextIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PdfTagBadgeProps {
  tag?: string;
}

export function PdfTagBadge({ tag }: PdfTagBadgeProps) {
  if (tag !== 'primary' && tag !== 'protocol') return null;

  return (
    <Badge
      variant='info'
      className={tag === 'protocol' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : undefined}
    >
      {tag === 'primary' ?
        <>
          <StarIcon className='size-3' />
          <span>Primary</span>
        </>
      : <>
          <FileTextIcon className='size-3' />
          <span>Protocol</span>
        </>
      }
    </Badge>
  );
}
