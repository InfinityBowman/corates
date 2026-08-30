/**
 * ChartEditSheet - Side panel for editing a figure: row labels, title, and palette.
 * Stays open beside the plots so label and palette changes can be checked live.
 */

import { useId } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { CHART_PALETTES } from './chartConfigs';
import type { ChartPalette } from './chartConfigs';

export type FigureId = 'trafficLight' | 'distribution';

const FIGURE_COPY: Record<FigureId, { title: string; description: string }> = {
  trafficLight: {
    title: 'Edit traffic light',
    description: 'Row labels and palette apply to both figures in this group.',
  },
  distribution: {
    title: 'Edit distribution',
    description: 'Row labels and palette apply to both figures in this group.',
  },
};

interface LabelItem {
  id: string;
  label: string;
}

interface ChartEditSheetProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  figureId: FigureId;
  labels: LabelItem[];
  onLabelChange: (_index: number, _newValue: string) => void;
  onReorder: (_fromIndex: number, _toIndex: number) => void;
  palette: ChartPalette;
  onPaletteChange: (_value: ChartPalette) => void;
  showSymbols: boolean;
  onShowSymbolsChange: (_value: boolean) => void;
  title: string;
  onTitleChange: (_value: string) => void;
}

interface SortableLabelRowProps {
  item: LabelItem;
  index: number;
  onLabelChange: (_index: number, _newValue: string) => void;
}

function SortableLabelRow({ item, index, onLabelChange }: SortableLabelRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('flex items-center gap-2', isDragging && 'opacity-50')}
    >
      <button
        ref={setActivatorNodeRef}
        type='button'
        className='text-muted-foreground hover:text-foreground shrink-0 cursor-grab touch-none rounded p-1 active:cursor-grabbing'
        aria-label={`Reorder chart label ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className='size-4' />
      </button>
      <Input
        type='text'
        value={item.label}
        onChange={e => onLabelChange(index, e.target.value)}
        aria-label={`Chart label ${index + 1}`}
        className='flex-1'
      />
    </div>
  );
}

export function ChartEditSheet({
  open,
  onOpenChange,
  figureId,
  labels,
  onLabelChange,
  onReorder,
  palette,
  onPaletteChange,
  showSymbols,
  onShowSymbolsChange,
  title,
  onTitleChange,
}: ChartEditSheetProps) {
  const fieldId = useId();
  const copy = FIGURE_COPY[figureId];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = labels.findIndex(l => l.id === active.id);
    const newIndex = labels.findIndex(l => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(oldIndex, newIndex);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side='right'
        showOverlay={false}
        onPointerDownOutside={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
        className='w-full gap-0 sm:max-w-md'
      >
        <SheetHeader>
          <SheetTitle>{copy.title}</SheetTitle>
          <SheetDescription>{copy.description}</SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 overflow-y-auto p-4'>
          <div>
            <h3 className='text-foreground mb-3 text-sm font-medium'>Row labels</h3>
            <p className='text-muted-foreground mb-4 text-xs'>
              Drag to reorder or edit labels directly. Changes are temporary and will not be saved.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={labels.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <div className='flex flex-col gap-2'>
                  {labels.map((item, index) => (
                    <SortableLabelRow
                      key={item.id}
                      item={item}
                      index={index}
                      onLabelChange={onLabelChange}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {labels.length === 0 && (
              <p className='text-muted-foreground py-4 text-center text-sm'>
                No chart data available to edit.
              </p>
            )}
          </div>

          <div className='border-border mt-6 border-t pt-6'>
            <h3 className='text-foreground mb-3 text-sm font-medium'>Title</h3>
            <Label htmlFor={`${fieldId}-title`} className='mb-1'>
              Figure title
            </Label>
            <Input
              id={`${fieldId}-title`}
              type='text'
              value={title}
              onChange={e => onTitleChange(e.target.value)}
            />
          </div>

          <div className='border-border mt-6 border-t pt-6'>
            <h3 className='text-foreground mb-3 text-sm font-medium'>Color palette</h3>
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

          <div className='border-border mt-6 border-t pt-6'>
            <h3 className='text-foreground mb-3 text-sm font-medium'>Traffic light symbols</h3>
            <Label
              className={cn(
                'bg-muted flex items-center gap-3 rounded-lg p-3 transition-colors',
                palette === 'greyscale' ?
                  'cursor-not-allowed opacity-70'
                : 'hover:bg-muted/80 cursor-pointer',
              )}
            >
              <Checkbox
                checked={palette === 'greyscale' || showSymbols}
                disabled={palette === 'greyscale'}
                onCheckedChange={checked => onShowSymbolsChange(checked === true)}
              />
              <div>
                <span className='text-foreground text-sm font-medium'>Show cell symbols</span>
                <p className='text-muted-foreground text-xs'>
                  {palette === 'greyscale' ?
                    'Required for greyscale so cells stay distinguishable in print.'
                  : 'Draw +, -, x, and ! marks in traffic light cells and the legend.'}
                </p>
              </div>
            </Label>
          </div>
        </div>

        <SheetFooter className='sm:flex-row sm:justify-start'>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
