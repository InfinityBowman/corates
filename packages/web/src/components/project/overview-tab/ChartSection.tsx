/**
 * ChartSection - Displays appraisal figures for a project's checklists.
 * Renders one figure group (traffic light + distribution) per checklist type;
 * ROB2 figures follow the robvis convention of one figure pair per assessed outcome.
 */

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { DownloadIcon, PencilIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TrafficLightChart } from '@/components/charts/TrafficLightChart';
import { DistributionChart } from '@/components/charts/DistributionChart';
import { ChartEditSheet, type FigureId } from '@/components/charts/ChartEditSheet';
import { CiteCoratesMenuItems, CiteCoratesPopover } from '@/components/charts/CiteCorates';
import {
  AMSTAR2_CHART_CONFIG,
  ROB2_CHART_CONFIG,
  ROBINS_I_CHART_CONFIG,
} from '@/components/charts/chartConfigs';
import type { ChartPalette, ChecklistChartConfig } from '@/components/charts/chartConfigs';
import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import { useProjectContext } from '../ProjectContext';
import { useProjectOutcomes } from '@/project/workspace-data';
import type { StudyInfo } from '@/stores/projectStore';

/**
 * Export an SVG element as a file (framework-agnostic utility)
 */

function exportChart(
  svgElement: SVGSVGElement | null,
  filename: string,
  format: 'svg' | 'png',
  transparent = false,
) {
  if (!svgElement) return;

  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (transparent) clonedSvg.style.background = 'transparent';

  const svgData = new XMLSerializer().serializeToString(clonedSvg);

  if (format === 'svg') {
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else if (format === 'png') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    const svgWidth =
      Number(svgElement.getAttribute('width')) || svgElement.getBoundingClientRect().width;
    const svgHeight =
      Number(svgElement.getAttribute('height')) || svgElement.getBoundingClientRect().height;

    const scale = 2;
    canvas.width = svgWidth * scale;
    canvas.height = svgHeight * scale;

    img.onload = () => {
      if (!transparent) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    img.src = URL.createObjectURL(svgBlob);
  }
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'outcome'
  );
}

function truncateLabel(name: string): string {
  return name.length > 20 ? name.slice(0, 20) + '...' : name;
}

interface ChartItem {
  id: string;
  label: string;
  values: string[];
}

interface ChartGroupSpec {
  key: string;
  heading: string;
  description: string;
  config: ChecklistChartConfig;
  data: ChartItem[];
  defaultTrafficLightTitle: string;
  defaultDistributionTitle: string;
  exportBaseName: string;
}

interface ChartSectionProps {
  studies: StudyInfo[];
}

export function ChartSection({ studies }: ChartSectionProps) {
  const { projectId } = useProjectContext();
  const outcomes = useProjectOutcomes(projectId);

  const groups = useMemo<ChartGroupSpec[]>(() => {
    const result: ChartGroupSpec[] = [];

    // Risk-of-bias tools are assessed per outcome, so each gets one figure
    // pair per outcome (the robvis convention)
    const outcomeTools = [
      { type: 'ROB2', name: 'RoB 2', config: ROB2_CHART_CONFIG, slug: 'rob2' },
      { type: 'ROBINS_I', name: 'ROBINS-I', config: ROBINS_I_CHART_CONFIG, slug: 'robins-i' },
    ];

    const amstarData: ChartItem[] = [];
    const byToolAndOutcome = new Map<string, Map<string, ChartItem[]>>(
      outcomeTools.map(tool => [tool.type, new Map()]),
    );

    for (const study of studies) {
      for (const checklist of study.checklists || []) {
        if (checklist.status !== CHECKLIST_STATUS.FINALIZED) continue;
        const answersObj = checklist.consolidatedAnswers;
        if (!answersObj) continue;

        if (checklist.type === 'AMSTAR2') {
          amstarData.push({
            id: `${study.id}-${checklist.id}`,
            label: truncateLabel(study.name),
            values: AMSTAR2_CHART_CONFIG.columns.map(c => answersObj[c.id] ?? ''),
          });
          continue;
        }

        const tool = outcomeTools.find(t => t.type === checklist.type);
        if (!tool) continue;
        const byOutcome = byToolAndOutcome.get(tool.type)!;
        const outcomeKey = checklist.outcomeId ?? '';
        const items = byOutcome.get(outcomeKey) ?? [];
        items.push({
          id: `${study.id}-${checklist.id}`,
          label: truncateLabel(study.name),
          values: tool.config.columns.map(c => answersObj[c.id] ?? ''),
        });
        byOutcome.set(outcomeKey, items);
      }
    }

    if (amstarData.length) {
      result.push({
        key: 'amstar2',
        heading: 'AMSTAR-2',
        description:
          'Visual representation of AMSTAR-2 quality assessment ratings across completed checklists.',
        config: AMSTAR2_CHART_CONFIG,
        data: amstarData,
        defaultTrafficLightTitle: 'AMSTAR 2 Item-Level Judgments by Review',
        defaultDistributionTitle: 'Level Judgments Across Included Reviews',
        exportBaseName: 'amstar',
      });
    }

    for (const tool of outcomeTools) {
      const byOutcome = byToolAndOutcome.get(tool.type)!;
      // Project outcome order first; any checklists without a matching
      // outcome entry go last.
      const orderedKeys = [
        ...outcomes.map(o => o.id).filter(id => byOutcome.has(id)),
        ...[...byOutcome.keys()].filter(key => !outcomes.some(o => o.id === key)),
      ];
      for (const outcomeKey of orderedKeys) {
        const outcomeName = outcomes.find(o => o.id === outcomeKey)?.name ?? 'Unspecified outcome';
        result.push({
          key: `${tool.slug}-${outcomeKey || 'none'}`,
          heading: `${tool.name} - ${outcomeName}`,
          description:
            `Risk of bias judgments for the outcome "${outcomeName}", derived from the ` +
            `${tool.name} algorithm across completed checklists.`,
          config: tool.config,
          data: byOutcome.get(outcomeKey) ?? [],
          defaultTrafficLightTitle: `Risk of Bias (${tool.name}): ${outcomeName}`,
          defaultDistributionTitle: `Risk of Bias Distribution (${tool.name}): ${outcomeName}`,
          exportBaseName: `${tool.slug}-${slugify(outcomeName)}`,
        });
      }
    }

    return result;
  }, [studies, outcomes]);

  if (groups.length === 0) {
    return (
      <div className='border-border bg-card rounded-lg border px-4 py-8 text-center'>
        <p className='text-muted-foreground'>
          Once appraisals are completed, this section will display item-level judgments by study and
          across studies, along with a figure summarizing the distribution of ratings for the
          included studies.
        </p>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-10'>
      {groups.map(group => (
        <ChartGroup key={group.key} group={group} showHeading={groups.length > 1} />
      ))}
    </div>
  );
}

interface ChartGroupProps {
  group: ChartGroupSpec;
  showHeading: boolean;
}

function ChartGroup({ group, showHeading }: ChartGroupProps) {
  const [editingFigure, setEditingFigure] = useState<FigureId | null>(null);
  const [customLabels, setCustomLabels] = useState<Array<{ id: string; label: string }>>([]);
  const [palette, setPalette] = useState<ChartPalette>('default');
  const [showSymbols, setShowSymbols] = useState(true);
  const [trafficLightTitle, setTrafficLightTitle] = useState(group.defaultTrafficLightTitle);
  const [distributionTitle, setDistributionTitle] = useState(group.defaultDistributionTitle);
  const [transparentExport, setTransparentExport] = useState(false);

  const trafficLightSvgRef = useRef<SVGSVGElement>(null);

  const distributionSvgRef = useRef<SVGSVGElement>(null);

  // Merge custom labels when raw data changes: keep order and edited text, append new rows
  useEffect(() => {
    setCustomLabels(prev => {
      if (prev.length === 0) {
        return group.data.map(d => ({ id: d.id, label: d.label }));
      }

      const dataIds = new Set(group.data.map(d => d.id));
      const prevIds = new Set(prev.map(l => l.id));
      const merged: Array<{ id: string; label: string }> = [];

      for (const item of prev) {
        if (dataIds.has(item.id)) merged.push(item);
      }

      for (const d of group.data) {
        if (!prevIds.has(d.id)) merged.push({ id: d.id, label: d.label });
      }

      if (
        merged.length === prev.length &&
        merged.every((item, i) => item.id === prev[i]?.id && item.label === prev[i]?.label)
      ) {
        return prev;
      }

      return merged;
    });
  }, [group.data]);

  const chartData = useMemo(() => {
    const dataById = new Map(group.data.map(item => [item.id, item]));
    return customLabels
      .map(labelItem => {
        const item = dataById.get(labelItem.id);
        if (!item) return null;
        return { ...item, label: labelItem.label };
      })
      .filter((item): item is ChartItem => item !== null);
  }, [group.data, customLabels]);

  const handleLabelChange = useCallback((index: number, newValue: string) => {
    setCustomLabels(prev =>
      prev.map((item, i) => (i === index ? { ...item, label: newValue } : item)),
    );
  }, []);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    setCustomLabels(prev => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }, []);

  const handleExportTrafficLight = useCallback(
    (format: 'svg' | 'png') =>
      exportChart(
        trafficLightSvgRef.current,
        `${group.exportBaseName}-traffic-light`,
        format,
        transparentExport,
      ),
    [group.exportBaseName, transparentExport],
  );

  const handleExportDistribution = useCallback(
    (format: 'svg' | 'png') =>
      exportChart(
        distributionSvgRef.current,
        `${group.exportBaseName}-distribution`,
        format,
        transparentExport,
      ),
    [group.exportBaseName, transparentExport],
  );

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex items-start justify-between gap-4'>
        <div className='flex-1'>
          {showHeading && (
            <h3 className='text-foreground mb-1 text-sm font-semibold'>{group.heading}</h3>
          )}
          <p className='text-secondary-foreground text-sm'>{group.description}</p>
        </div>
        <CiteCoratesPopover />
      </div>

      <FigureFrame
        actions={
          <FigureActions
            editLabel='Edit traffic light chart'
            editing={editingFigure === 'trafficLight'}
            onEdit={() => setEditingFigure('trafficLight')}
            onExport={handleExportTrafficLight}
            transparentExport={transparentExport}
            onTransparentExportChange={setTransparentExport}
          />
        }
      >
        <TrafficLightChart
          ref={trafficLightSvgRef}
          data={chartData}
          config={group.config}
          palette={palette}
          showSymbols={showSymbols}
          title={trafficLightTitle}
        />
      </FigureFrame>
      <FigureFrame
        actions={
          <FigureActions
            editLabel='Edit distribution chart'
            editing={editingFigure === 'distribution'}
            onEdit={() => setEditingFigure('distribution')}
            onExport={handleExportDistribution}
            transparentExport={transparentExport}
            onTransparentExportChange={setTransparentExport}
          />
        }
      >
        <DistributionChart
          ref={distributionSvgRef}
          data={chartData}
          config={group.config}
          palette={palette}
          title={distributionTitle}
        />
      </FigureFrame>

      <ChartEditSheet
        open={editingFigure !== null}
        onOpenChange={open => {
          if (!open) setEditingFigure(null);
        }}
        figureId={editingFigure ?? 'trafficLight'}
        labels={customLabels}
        onLabelChange={handleLabelChange}
        onReorder={handleReorder}
        palette={palette}
        onPaletteChange={value => {
          setPalette(value);
          if (value === 'greyscale') setShowSymbols(true);
        }}
        showSymbols={showSymbols}
        onShowSymbolsChange={setShowSymbols}
        title={editingFigure === 'distribution' ? distributionTitle : trafficLightTitle}
        onTitleChange={
          editingFigure === 'distribution' ? setDistributionTitle : setTrafficLightTitle
        }
      />
    </div>
  );
}

interface FigureFrameProps {
  actions: ReactNode;
  children: ReactNode;
}

function FigureFrame({ actions, children }: FigureFrameProps) {
  return (
    <div className='mx-auto flex w-full max-w-[880px] flex-col gap-1'>
      <div className='flex justify-end gap-1'>{actions}</div>
      {children}
    </div>
  );
}

interface FigureActionsProps {
  editLabel: string;
  editing?: boolean;
  onEdit: () => void;
  onExport: (_format: 'svg' | 'png') => void;
  transparentExport: boolean;
  onTransparentExportChange: (_value: boolean) => void;
}

function FigureActions({
  editLabel,
  editing = false,
  onEdit,
  onExport,
  transparentExport,
  onTransparentExportChange,
}: FigureActionsProps) {
  return (
    <>
      <Button
        variant={editing ? 'secondary' : 'ghost'}
        size='sm'
        onClick={onEdit}
        aria-label={editLabel}
        aria-pressed={editing}
      >
        <PencilIcon data-icon='inline-start' />
        Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='sm' aria-label='Export figure'>
            <DownloadIcon data-icon='inline-start' />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={() => onExport('svg')}>Export SVG</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('png')}>Export PNG</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={transparentExport}
            onCheckedChange={checked => onTransparentExportChange(checked === true)}
            onSelect={event => event.preventDefault()}
          >
            Transparent background
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <CiteCoratesMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
