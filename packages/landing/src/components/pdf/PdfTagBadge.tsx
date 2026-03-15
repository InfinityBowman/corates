/**
 * PdfTagBadge - Visual badge indicating PDF tag type (primary, protocol)
 */

import { StarIcon, FileTextIcon } from 'lucide-react';

interface PdfTagBadgeProps {
  tag?: string;
}

export function PdfTagBadge({ tag }: PdfTagBadgeProps) {
  if (tag !== 'primary' && tag !== 'protocol') return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        tag === 'primary' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
      }`}
    >
      {tag === 'primary' ? (
        <>
          <StarIcon className="h-3 w-3" />
          <span>Primary</span>
        </>
      ) : (
        <>
          <FileTextIcon className="h-3 w-3" />
          <span>Protocol</span>
        </>
      )}
    </span>
  );
}
