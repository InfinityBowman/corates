/**
 * ChartSettingsModal - Modal for editing chart settings, labels, titles, and export options.
 */

import { useId, useState } from 'react';
import { CopyIcon, CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CHART_PALETTES } from './chartConfigs';
import type { ChartPalette } from './chartConfigs';

interface LabelItem {
  id: string;
  label: string;
}

interface ChartSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  labels: LabelItem[];
  onLabelChange: (_index: number, _newValue: string) => void;
  palette: ChartPalette;
  onPaletteChange: (_value: ChartPalette) => void;
  robvisTitle: string;
  onRobvisTitleChange: (_value: string) => void;
  distributionTitle: string;
  onDistributionTitleChange: (_value: string) => void;
  onExportRobvis: (_format: 'svg' | 'png') => void;
  onExportDistribution: (_format: 'svg' | 'png') => void;
  transparentExport: boolean;
  onTransparentExportChange: (_value: boolean) => void;
}

export function ChartSettingsModal({
  isOpen,
  onClose,
  labels,
  onLabelChange,
  palette,
  onPaletteChange,
  robvisTitle,
  onRobvisTitleChange,
  distributionTitle,
  onDistributionTitleChange,
  onExportRobvis,
  onExportDistribution,
  transparentExport,
  onTransparentExportChange,
}: ChartSettingsModalProps) {
  const [copiedCitation, setCopiedCitation] = useState<string | null>(null);
  const fieldId = useId();

  const currentYear = new Date().getFullYear();

  const apaCitation = `Maynard, J. A., & Maynard, B. R. (${currentYear}). CoRATES (Collaborative Risk-of-Bias and Appraisal Tracking for Evidence Synthesis) [Software]. https://corates.org`;
  const amaCitation = `Maynard JA, Maynard BR. CoRATES (Collaborative Risk-of-Bias and Appraisal Tracking for Evidence Synthesis)[software]. ${currentYear}. Accessed Month Day, Year. https://corates.org`;

  const copyCitation = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCitation(id);
    setTimeout(() => setCopiedCitation(null), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className='flex max-h-[80vh] flex-col sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Chart Settings</DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className='-mx-4 min-h-0 flex-1 overflow-y-auto px-4'>
          {/* Labels Section */}
          <div>
            <h3 className='text-foreground mb-3 text-sm font-medium'>Chart Labels</h3>
            <p className='text-muted-foreground mb-4 text-xs'>
              Edit labels directly. Changes are temporary and won't be saved.
            </p>
            <div className='flex flex-col gap-2'>
              {labels.map((item, index) => (
                <Input
                  key={item.id}
                  type='text'
                  value={item.label}
                  onChange={e => onLabelChange(index, e.target.value)}
                  aria-label={`Chart label ${index + 1}`}
                />
              ))}
            </div>
            {labels.length === 0 && (
              <p className='text-muted-foreground py-4 text-center text-sm'>
                No chart data available to edit.
              </p>
            )}
          </div>

          {/* Chart Titles Section */}
          <div className='border-border mt-6 border-t pt-6'>
            <h3 className='text-foreground mb-3 text-sm font-medium'>Chart Titles</h3>
            <div className='flex flex-col gap-3'>
              <div>
                <Label htmlFor={`${fieldId}-robvis-title`} className='mb-1'>
                  Traffic Light Chart
                </Label>
                <Input
                  id={`${fieldId}-robvis-title`}
                  type='text'
                  value={robvisTitle}
                  onChange={e => onRobvisTitleChange(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`${fieldId}-distribution-title`} className='mb-1'>
                  Distribution Chart
                </Label>
                <Input
                  id={`${fieldId}-distribution-title`}
                  type='text'
                  value={distributionTitle}
                  onChange={e => onDistributionTitleChange(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Display Options */}
          <div className='border-border mt-6 border-t pt-6'>
            <h3 className='text-foreground mb-3 text-sm font-medium'>Color Palette</h3>
            <RadioGroup
              value={palette}
              onValueChange={value => onPaletteChange(value as ChartPalette)}
              className='flex flex-col gap-2'
            >
              {CHART_PALETTES.map(option => (
                <Label
                  key={option.value}
                  className='bg-muted hover:bg-muted/80 flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors'
                >
                  <RadioGroupItem value={option.value} />
                  <div>
                    <span className='text-foreground text-sm font-medium'>{option.label}</span>
                    <p className='text-muted-foreground text-xs'>{option.description}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Export Section */}
          <div className='border-border mt-6 border-t pt-6'>
            <h3 className='text-foreground mb-3 text-sm font-medium'>Export Charts</h3>
            <Label className='bg-muted hover:bg-muted/80 mb-3 flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors'>
              <Checkbox
                checked={transparentExport}
                onCheckedChange={checked => onTransparentExportChange(checked === true)}
              />
              <div>
                <span className='text-foreground text-sm font-medium'>Transparent Background</span>
                <p className='text-muted-foreground text-xs'>Export without white background</p>
              </div>
            </Label>

            <div className='flex flex-col gap-3'>
              <div className='bg-muted rounded-lg p-3'>
                <p className='text-foreground mb-2 text-sm font-medium'>Traffic Light Chart</p>
                <div className='flex gap-2'>
                  <Button variant='outline' size='sm' onClick={() => onExportRobvis('svg')}>
                    Export SVG
                  </Button>
                  <Button variant='outline' size='sm' onClick={() => onExportRobvis('png')}>
                    Export PNG
                  </Button>
                </div>
              </div>
              <div className='bg-muted rounded-lg p-3'>
                <p className='text-foreground mb-2 text-sm font-medium'>Distribution Chart</p>
                <div className='flex gap-2'>
                  <Button variant='outline' size='sm' onClick={() => onExportDistribution('svg')}>
                    Export SVG
                  </Button>
                  <Button variant='outline' size='sm' onClick={() => onExportDistribution('png')}>
                    Export PNG
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Citation Section */}
          <div className='border-border mt-6 border-t pt-6'>
            <h3 className='text-foreground mb-3 text-sm font-medium'>How to Cite CoRATES</h3>
            <p className='text-muted-foreground mb-4 text-xs'>
              Use this citation when you reference CoRATES as the software used for study appraisal.
            </p>
            <div className='flex flex-col gap-4'>
              <div className='bg-muted rounded-lg p-4'>
                <div className='mb-2 flex items-center justify-between'>
                  <h4 className='text-foreground text-xs font-semibold'>APA</h4>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => copyCitation('apa', apaCitation)}
                    className='text-muted-foreground hover:bg-card'
                    title='Copy citation'
                    aria-label='Copy citation'
                  >
                    {copiedCitation === 'apa' ?
                      <CheckIcon className='text-success size-4' />
                    : <CopyIcon className='size-4' />}
                  </Button>
                </div>
                <p className='text-foreground text-sm leading-relaxed'>{apaCitation}</p>
              </div>
              <div className='bg-muted rounded-lg p-4'>
                <div className='mb-2 flex items-center justify-between'>
                  <h4 className='text-foreground text-xs font-semibold'>AMA</h4>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => copyCitation('ama', amaCitation)}
                    className='text-muted-foreground hover:bg-card'
                    title='Copy citation'
                    aria-label='Copy citation'
                  >
                    {copiedCitation === 'ama' ?
                      <CheckIcon className='text-success size-4' />
                    : <CopyIcon className='size-4' />}
                  </Button>
                </div>
                <p className='text-foreground text-sm leading-relaxed'>{amaCitation}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
