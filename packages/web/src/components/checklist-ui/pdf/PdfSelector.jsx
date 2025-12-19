/**
 * PdfSelector - Dropdown to select which PDF to view when multiple PDFs exist
 *
 * Shows a compact dropdown that displays the current PDF with tag badge,
 * and allows switching between PDFs.
 */

import { Show, createMemo } from 'solid-js';
import { Menu } from '@corates/ui';

export default function PdfSelector(props) {
  // props.pdfs: Array<{ id, fileName, tag }>
  // props.selectedPdfId: string | null
  // props.onSelect: (pdfId: string) => void

  const sortedPdfs = createMemo(() => {
    const pdfs = props.pdfs || [];
    // Sort: primary first, then protocol, then secondary
    return pdfs.toSorted((a, b) => {
      const tagOrder = { primary: 0, protocol: 1, secondary: 2 };
      const tagA = tagOrder[a.tag] ?? 2;
      const tagB = tagOrder[b.tag] ?? 2;
      return tagA - tagB;
    });
  });

  // Build menu items with formatted labels including tag
  const menuItems = createMemo(() =>
    sortedPdfs().map(pdf => ({
      value: pdf.id,
      label:
        pdf.tag === 'primary' || pdf.tag === 'protocol' ?
          `${pdf.fileName} (${pdf.tag === 'primary' ? 'Primary' : 'Protocol'})`
        : pdf.fileName,
    })),
  );

  // Menu's onSelect callback receives { value: string }
  const handleSelect = details => {
    props.onSelect?.(details.value);
  };

  const shouldShow = createMemo(() => props.pdfs && props.pdfs.length > 1);

  return (
    <Show when={shouldShow()}>
      <div class='flex items-center gap-2'>
        <Menu items={menuItems()} onSelect={handleSelect} />
        <span class='text-xs text-gray-500'>{props.pdfs?.length || 0} PDFs</span>
      </div>
    </Show>
  );
}
