/**
 * CoRATES software citation — APA and AMA copy actions used from figure chrome.
 */

import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_FULL_NAME, APP_NAME, APP_PUBLISHER } from '@/config/app';
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
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

export function getCoratesCitations() {
  const now = new Date();
  const year = now.getFullYear();
  // AMA access dates are always US-style ("August 31, 2026"), so pin the locale
  // rather than letting the reader's browser render "31 August 2026".
  const accessed = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const title = `${APP_NAME} (${APP_FULL_NAME})`;
  return {
    apa: `Maynard, J. A., & Maynard, B. R. (${year}). ${title} [Computer software]. ${APP_PUBLISHER}. https://corates.org`,
    ama: `Maynard JA, Maynard BR. ${title} [software]. ${APP_PUBLISHER}; ${year}. Accessed ${accessed}. https://corates.org`,
  };
}

export function copyCoratesCitation(style: CitationStyle, options?: { toast?: boolean }) {
  const text = getCoratesCitations()[style];
  navigator.clipboard.writeText(text);
  if (options?.toast !== false) {
    showToast.success(`${style.toUpperCase()} citation copied`);
  }
}

export function CiteCoratesMenuItems() {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Cite CoRATES</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem onClick={() => copyCoratesCitation('apa')}>
          Copy APA citation
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyCoratesCitation('ama')}>
          Copy AMA citation
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
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
      </PopoverContent>
    </Popover>
  );
}

export function CiteCoratesPopover() {
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
        <Button variant='ghost' size='sm'>
          Cite CoRATES
        </Button>
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
