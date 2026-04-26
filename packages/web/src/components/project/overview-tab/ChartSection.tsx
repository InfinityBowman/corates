/**
 * ChartSection - Displays AMSTAR charts for a project's checklists.
 * Orchestrates AMSTARRobvis, AMSTARDistribution, and ChartSettingsModal.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { SettingsIcon } from 'lucide-react';
import { AMSTARRobvis } from '@/components/charts/AMSTARRobvis';
import { AMSTARDistribution } from '@/components/charts/AMSTARDistribution';
import { ChartSettingsModal } from '@/components/charts/ChartSettingsModal';
import { CHECKLIST_STATUS } from '@corates/shared/checklists';

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

const QUESTION_ORDER = [
  'q1',
  'q2',
  'q3',
  'q4',
  'q5',
  'q6',
  'q7',
  'q8',
  'q9',
  'q10',
  'q11',
  'q12',
  'q13',
  'q14',
  'q15',
  'q16',
];

interface ChartSectionProps {
  studies: any[];
}

export function ChartSection({ studies }: ChartSectionProps) {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [customLabels, setCustomLabels] = useState<Array<{ id: string; label: string }>>([]);
  const [greyscale, setGreyscale] = useState(false);
  const [robvisTitle, setRobvisTitle] = useState('AMSTAR 2 Item-Level Judgments by Review');
  const [distributionTitle, setDistributionTitle] = useState(
    'Level Judgments Across Included Reviews',
  );
  const [transparentExport, setTransparentExport] = useState(false);

  const robvisSvgRef = useRef<SVGSVGElement>(null);

  const distributionSvgRef = useRef<SVGSVGElement>(null);

  // Build raw chart data from finalized AMSTAR2 checklists
  const rawChecklistData = useMemo(() => {
    if (!studies.length) return [];

    const data: Array<{ id: string; label: string; questions: string[] }> = [];
    for (const study of studies) {
      for (const checklist of study.checklists || []) {
        if (checklist.status !== CHECKLIST_STATUS.FINALIZED) continue;
        if (checklist.type !== 'AMSTAR2') continue;

        const answersObj = checklist.consolidatedAnswers;
        if (!answersObj) continue;

        data.push({
          id: `${study.id}-${checklist.id}`,
          label: study.name.length > 20 ? study.name.slice(0, 20) + '...' : study.name,
          questions: QUESTION_ORDER.map(q => answersObj[q] ?? ''),
        });
      }
    }
    return data;
  }, [studies]);

  // Sync custom labels when raw data changes
  useEffect(() => {
    const currentIds = customLabels.map(l => l.id).join(',');
    const newIds = rawChecklistData.map(d => d.id).join(',');
    if (currentIds !== newIds) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing labels from data
      setCustomLabels(rawChecklistData.map(d => ({ id: d.id, label: d.label })));
    }
  }, [rawChecklistData, customLabels]);

  // Merge custom labels with raw data
  const checklistData = useMemo(() => {
    return rawChecklistData.map(item => {
      const custom = customLabels.find(l => l.id === item.id);
      return { ...item, label: custom?.label ?? item.label };
    });
  }, [rawChecklistData, customLabels]);

  const handleLabelChange = useCallback((index: number, newValue: string) => {
    setCustomLabels(prev =>
      prev.map((item, i) => (i === index ? { ...item, label: newValue } : item)),
    );
  }, []);

  const handleExportRobvis = useCallback(
    (format: 'svg' | 'png') =>
      exportChart(robvisSvgRef.current, 'amstar-quality-assessment', format, transparentExport),
    [transparentExport],
  );

  const handleExportDistribution = useCallback(
    (format: 'svg' | 'png') =>
      exportChart(distributionSvgRef.current, 'amstar-distribution', format, transparentExport),
    [transparentExport],
  );

  if (checklistData.length === 0) {
    return (
      <div className='border-border bg-card rounded-lg border px-4 py-8 text-center'>
        <p className='text-muted-foreground'>
          Once appraisals are completed, this section will display domain-level judgments by review
          and across reviews, along with a figure summarizing the ratings of overall confidence in
          the results of the included reviews.
        </p>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div className='flex-1'>
          <p className='text-secondary-foreground text-sm'>
            Visual representation of AMSTAR-2 quality assessment ratings across completed
            checklists. Use the settings to customize chart appearance, labels, and export options.
          </p>
        </div>
        <button
          onClick={() => setShowSettingsModal(true)}
          className='text-secondary-foreground hover:bg-secondary hover:text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors'
          title='Chart Settings'
        >
          <SettingsIcon className='size-4' />
          Settings
        </button>
      </div>

      <AMSTARRobvis
        ref={robvisSvgRef}
        data={checklistData}
        greyscale={greyscale}
        title={robvisTitle}
      />
      <AMSTARDistribution
        ref={distributionSvgRef}
        data={checklistData}
        greyscale={greyscale}
        title={distributionTitle}
      />

      <ChartSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        labels={customLabels}
        onLabelChange={handleLabelChange}
        greyscale={greyscale}
        onGreyscaleChange={setGreyscale}
        robvisTitle={robvisTitle}
        onRobvisTitleChange={setRobvisTitle}
        distributionTitle={distributionTitle}
        onDistributionTitleChange={setDistributionTitle}
        onExportRobvis={handleExportRobvis}
        onExportDistribution={handleExportDistribution}
        transparentExport={transparentExport}
        onTransparentExportChange={setTransparentExport}
      />
    </div>
  );
}
