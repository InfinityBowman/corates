import AMSTARRobvis from '@components/charts/AMSTARRobvis';
import AMSTARDistribution from '@components/charts/AMSTARDistribution';
import ChartSettingsModal from '@components/charts/ChartSettingsModal';
import { createMemo, createSignal, createEffect, Show } from 'solid-js';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import { createStore } from 'solid-js/store';
import { BiRegularCog } from 'solid-icons/bi';

/**
 * Export an SVG element as a file
 * @param {SVGElement} svgElement - The SVG element to export
 * @param {string} filename - The filename (without extension)
 * @param {'svg' | 'png'} format - The export format
 * @param {boolean} transparent - Whether to use transparent background (PNG only)
 */
function exportChart(svgElement, filename, format, transparent = false) {
  if (!svgElement) return;

  // Clone the SVG to avoid modifying the original
  const clonedSvg = svgElement.cloneNode(true);

  // Ensure proper XML namespace
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Remove background style for transparent export
  if (transparent) {
    clonedSvg.style.background = 'transparent';
  }

  // Get the SVG as a string
  const svgData = new XMLSerializer().serializeToString(clonedSvg);

  if (format === 'svg') {
    // Download as SVG
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
    // Convert to PNG using canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // Get SVG dimensions
    const svgWidth = svgElement.getAttribute('width') || svgElement.getBoundingClientRect().width;
    const svgHeight =
      svgElement.getAttribute('height') || svgElement.getBoundingClientRect().height;

    // Set canvas size (2x for better quality)
    const scale = 2;
    canvas.width = svgWidth * scale;
    canvas.height = svgHeight * scale;

    img.onload = () => {
      // Fill white background only if not transparent
      if (!transparent) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw the image scaled
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      // Download as PNG
      canvas.toBlob(blob => {
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

    // Encode SVG as data URL
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
  }
}

/**
 * ChartSection - Displays AMSTAR charts for a project's checklists
 *
 * Props:
 * - studies: signal returning array of studies with checklists (includes consolidatedAnswers from store)
 * - members: signal returning array of project members
 */
export default function ChartSection(props) {
  const [showSettingsModal, setShowSettingsModal] = createSignal(false);
  const [customLabels, setCustomLabels] = createStore([]);
  const [greyscale, setGreyscale] = createSignal(false);
  const [robvisTitle, setRobvisTitle] = createSignal('AMSTAR 2 Item-Level Judgments by Review');
  const [distributionTitle, setDistributionTitle] = createSignal(
    'Level Judgments Across Included Reviews',
  );
  const [transparentExport, setTransparentExport] = createSignal(false);

  // Refs for export
  let robvisSvgRef = null;
  let distributionSvgRef = null;

  // Export handlers
  const handleExportRobvis = format => {
    exportChart(robvisSvgRef, 'amstar-quality-assessment', format, transparentExport());
  };

  const handleExportDistribution = format => {
    exportChart(distributionSvgRef, 'amstar-distribution', format, transparentExport());
  };

  const questionOrder = [
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

  // Get assignee name from members list
  const getAssigneeName = (userId, membersList) => {
    if (!userId) return 'Unassigned';
    const member = membersList.find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  };

  // Build raw chart data from studies and their checklists
  // Answers are pre-computed during sync and stored on checklist objects
  const rawChecklistData = createMemo(() => {
    const studiesList = props.studies?.() || [];
    const membersList = props.members?.() || [];
    if (studiesList.length === 0) return [];

    const data = [];

    for (const study of studiesList) {
      const checklists = study.checklists || [];
      if (checklists.length === 0) continue;

      for (const checklist of checklists) {
        // Only include completed AMSTAR2 checklists
        if (checklist.status !== CHECKLIST_STATUS.COMPLETED) continue;
        if (checklist.type !== 'AMSTAR2') continue;

        // Answers are pre-computed during sync and stored on the checklist
        const answersObj = checklist.consolidatedAnswers;
        if (!answersObj) continue;

        const reviewerName = getAssigneeName(checklist.assignedTo, membersList);
        data.push({
          id: `${study.id}-${checklist.id}`,
          label: `${study.name.length > 20 ? study.name.slice(0, 20) + '...' : study.name}`,
          reviewer: reviewerName,
          reviewName: study.name,
          questions: questionOrder.map(q => answersObj[q]),
        });
      }
    }
    return data;
  });

  // Initialize custom labels when raw data changes
  createEffect(() => {
    const raw = rawChecklistData();
    // Only reset if the data structure changed (different ids)
    const currentIds = customLabels.map(l => l.id).join(',');
    const newIds = raw.map(d => d.id).join(',');
    if (currentIds !== newIds) {
      setCustomLabels(raw.map(d => ({ id: d.id, label: d.label })));
    } else {
      // Update labels for existing items if the underlying data changed (e.g., assignee changed)
      // Only update if the user hasn't customized the label
      for (let i = 0; i < raw.length; i++) {
        const rawItem = raw[i];
        const customItem = customLabels[i];
        // If the custom label matches what was auto-generated before, update it
        // We detect this by checking if it follows the "studyName - reviewerName" pattern
        if (customItem && customItem.label !== rawItem.label) {
          // Check if the label was likely auto-generated (contains " - ")
          const wasAutoGenerated = customItem.label.includes(' - ');
          if (wasAutoGenerated) {
            setCustomLabels(i, 'label', rawItem.label);
          }
        }
      }
    }
  });

  // Merge custom labels with raw data
  const checklistData = createMemo(() => {
    const raw = rawChecklistData();

    return raw.map(item => {
      const customLabel = customLabels.find(l => l.id === item.id);
      return {
        ...item,
        label: customLabel?.label ?? item.label,
      };
    });
  });

  // Update a single label by index
  const handleLabelChange = (index, newValue) => {
    setCustomLabels(index, 'label', newValue);
  };

  return (
    <Show
      when={checklistData().length > 0}
      fallback={
        <div class='rounded-lg border border-gray-200 bg-white px-4 py-8 text-center'>
          <p class='text-gray-500'>
            Once appraisals are completed, this section will display domain-level judgments by
            review and across reviews, along with a figure summarizing the ratings of overall
            confidence in the results of the included reviews.
          </p>
        </div>
      }
    >
      <div class='flex flex-col gap-6'>
        {/* Section Header with Description and Settings */}
        <div class='flex items-start justify-between gap-4'>
          <div class='flex-1'>
            <p class='text-sm text-gray-600'>
              Visual representation of AMSTAR-2 quality assessment ratings across completed
              checklists. Use the settings to customize chart appearance, labels, and export
              options.
            </p>
          </div>
          <button
            onClick={() => setShowSettingsModal(true)}
            class='inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900'
            title='Chart Settings'
          >
            <BiRegularCog class='h-4 w-4' />
            Settings
          </button>
        </div>

        <AMSTARRobvis
          data={checklistData()}
          greyscale={greyscale()}
          title={robvisTitle()}
          ref={el => (robvisSvgRef = el)}
        />
        <AMSTARDistribution
          data={checklistData()}
          greyscale={greyscale()}
          title={distributionTitle()}
          ref={el => (distributionSvgRef = el)}
        />

        {/* Settings Modal */}
        <ChartSettingsModal
          isOpen={showSettingsModal()}
          onClose={() => setShowSettingsModal(false)}
          labels={customLabels}
          onLabelChange={handleLabelChange}
          greyscale={greyscale()}
          onGreyscaleChange={setGreyscale}
          robvisTitle={robvisTitle()}
          onRobvisTitleChange={setRobvisTitle}
          distributionTitle={distributionTitle()}
          onDistributionTitleChange={setDistributionTitle}
          onExportRobvis={handleExportRobvis}
          onExportDistribution={handleExportDistribution}
          transparentExport={transparentExport()}
          onTransparentExportChange={setTransparentExport}
        />
      </div>
    </Show>
  );
}
