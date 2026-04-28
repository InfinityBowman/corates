import { useState } from 'react';
import { CopyIcon, CheckIcon } from 'lucide-react';
import { showToast } from '@/components/ui/toast';

interface CopyButtonProps {
  text: string;
  label: string;
  className?: string;
  iconSize?: string;
}

export function CopyButton({
  text,
  label,
  className = 'text-muted-foreground/70 hover:text-muted-foreground',
  iconSize = 'size-3',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast.success('Copied', `${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast.error('Error', 'Failed to copy to clipboard');
    }
  };

  return (
    <button type='button' onClick={handleCopy} className={className} title={`Copy ${label}`}>
      {copied ?
        <CheckIcon className={`text-success ${iconSize}`} />
      : <CopyIcon className={iconSize} />}
    </button>
  );
}
