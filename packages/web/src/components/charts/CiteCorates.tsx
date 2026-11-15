/**
 * CoRATES software citation — APA and AMA copy actions used from figure chrome.
 */

import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { getCoratesCitations } from '@/lib/coratesCitation';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { showToast } from '@/lib/toast';

export type CitationStyle = 'apa' | 'ama';

function copyCoratesCitation(style: CitationStyle, options?: { toast?: boolean }) {
  const text = getCoratesCitations()[style];
  navigator.clipboard.writeText(text);
  if (options?.toast !== false) {
    showToast.success(`${style.toUpperCase()} citation copied`);
  }
}

export function CiteCoratesButton() {
  const [copied, setCopied] = useState<CitationStyle | null>(null);
  const citations = getCoratesCitations();

  const copy = (style: CitationStyle) => {
    copyCoratesCitation(style, { toast: false });
    setCopied(style);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline'>Cite CoRATES</Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-96'>
        <PopoverHeader>
          <PopoverTitle>How to cite CoRATES</PopoverTitle>
          <PopoverDescription className='text-xs'>
            Use this citation when you reference CoRATES as the software used for study appraisal.
          </PopoverDescription>
        </PopoverHeader>
        <CitationBlock
          styleLabel='APA'
          text={citations.apa}
          copied={copied === 'apa'}
          onCopy={() => copy('apa')}
        />
        <CitationBlock
          styleLabel='AMA'
          text={citations.ama}
          copied={copied === 'ama'}
          onCopy={() => copy('ama')}
        />
        <Link
          to='/cite'
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary text-xs font-medium hover:underline'
        >
          Vancouver, BibTeX and RIS formats
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function CitationBlock({
  styleLabel,
  text,
  copied,
  onCopy,
}: {
  styleLabel: string;
  text: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className='bg-muted rounded-lg p-3'>
      <div className='mb-1.5 flex items-center justify-between'>
        <h4 className='text-foreground text-xs font-semibold'>{styleLabel}</h4>
        <Button
          variant='ghost'
          size='icon-sm'
          onClick={onCopy}
          className='text-muted-foreground'
          aria-label={`Copy ${styleLabel} citation`}
        >
          {copied ?
            <CheckIcon className='text-success size-4' />
          : <CopyIcon className='size-4' />}
        </Button>
      </div>
      <p className='text-foreground text-xs leading-relaxed'>{text}</p>
    </div>
  );
}
