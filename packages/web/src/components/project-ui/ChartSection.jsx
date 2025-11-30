import AMSTARRobvis from '@components/charts/AMSTARRobvis';
import AMSTARDistribution from '@components/charts/AMSTARDistribution';
import ChartSettingsModal from '@components/charts/ChartSettingsModal';
import { getAnswers } from '@/AMSTAR2/checklist.js';
import { createMemo, createSignal, createEffect, Show } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
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
 * - studies: signal returning array of studies with checklists
 * - members: signal returning array of project members
 * - getChecklistData: function (studyId, checklistId) => checklist with answers
 */
export default function ChartSection(props) {
  const [showSettingsModal, setShowSettingsModal] = createSignal(false);
  const [customLabels, setCustomLabels] = createStore([]);
  const [greyscale, setGreyscale] = createSignal(false);
  const [robvisTitle, setRobvisTitle] = createSignal('AMSTAR-2 Quality Assessment');
  const [distributionTitle, setDistributionTitle] = createSignal(
    'Distribution of AMSTAR Ratings on Each Item Across Included Reviews',
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
  const rawChecklistData = createMemo(() => {
    const studiesList = props.studies?.() || [];
    const membersList = props.members?.() || [];
    if (studiesList.length === 0) return [];

    const data = [];

    for (const study of studiesList) {
      if (!study.checklists || study.checklists.length === 0) continue;

      for (const checklist of study.checklists) {
        // Get full checklist data with answers
        const fullChecklist = props.getChecklistData?.(study.id, checklist.id);
        if (!fullChecklist?.answers) continue;

        // Get the properly formatted answers using the AMSTAR2 getAnswers function
        const answersObj = getAnswers(fullChecklist.answers);
        if (!answersObj) continue;

        const reviewerName = getAssigneeName(checklist.assignedTo, membersList);
        data.push({
          id: `${study.id}-${checklist.id}`,
          label: `${study.name} - ${reviewerName}`,
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
        <div class='text-center py-8 bg-white rounded-lg border border-gray-200'>
          <p class='text-gray-500'>No completed checklists to display charts.</p>
          <p class='text-gray-400 text-sm mt-1'>
            Add studies and complete checklists to see quality assessment charts.
          </p>
        </div>
      }
    >
      <div class='flex flex-col gap-6'>
        {/* Settings button */}
        <div class='flex justify-end'>
          <button
            onClick={() => setShowSettingsModal(true)}
            class='inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors'
            title='Chart Settings'
          >
            <BiRegularCog class='w-4 h-4' />
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
