/**
 * PdfSelector - Dropdown to select which PDF to view when multiple PDFs exist
 *
 * Shows a compact dropdown that displays the current PDF with tag badge,
 * and allows switching between PDFs.
 */

import { Show, createMemo } from 'solid-js';
import { Menu } from '@corates/ui';
import { CgFileDocument } from 'solid-icons/cg';
import { AiFillStar } from 'solid-icons/ai';
import { HiOutlineDocumentText } from 'solid-icons/hi';
import { BiRegularChevronDown } from 'solid-icons/bi';

export default function PdfSelector(props) {
  // props.pdfs: Array<{ id, fileName, tag }>
  // props.selectedPdfId: string | null
  // props.onSelect: (pdfId: string) => void

  const selectedPdf = createMemo(() => {
    if (!props.selectedPdfId || !props.pdfs?.length) return null;
    return props.pdfs.find(p => p.id === props.selectedPdfId);
  });

  const sortedPdfs = createMemo(() => {
    const pdfs = props.pdfs || [];
    // Sort: primary first, then protocol, then secondary
    return [...pdfs].sort((a, b) => {
      const tagOrder = { primary: 0, protocol: 1, secondary: 2 };
      const tagA = tagOrder[a.tag] ?? 2;
      const tagB = tagOrder[b.tag] ?? 2;
      return tagA - tagB;
    });
  });

  const menuItems = createMemo(() =>
    sortedPdfs().map(pdf => ({
      id: pdf.id,
      label: pdf.fileName,
      tag: pdf.tag,
    })),
  );

  const getTagIcon = tag => {
    if (tag === 'primary') return <AiFillStar class='w-3 h-3 text-blue-600' />;
    if (tag === 'protocol') return <HiOutlineDocumentText class='w-3 h-3 text-purple-600' />;
    return null;
  };

  const getTagLabel = tag => {
    if (tag === 'primary') return 'Primary';
    if (tag === 'protocol') return 'Protocol';
    return null;
  };

  const shouldShow = createMemo(() => props.pdfs && props.pdfs.length > 1);

  return (
    <Show when={shouldShow()}>
      <div class='flex items-center gap-2'>
        <Menu
          items={menuItems()}
          onSelect={props.onSelect}
          renderItem={item => (
            <div class='flex items-center gap-2 w-full'>
              <CgFileDocument class='w-4 h-4 text-gray-400 shrink-0' />
              <span class='truncate flex-1'>{item.label}</span>
              <Show when={item.tag === 'primary' || item.tag === 'protocol'}>
                <span
                  class={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                    item.tag === 'primary' ?
                      'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {getTagIcon(item.tag)}
                  {getTagLabel(item.tag)}
                </span>
              </Show>
            </div>
          )}
        >
          <button
            type='button'
            class='inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors max-w-xs'
          >
            <CgFileDocument class='w-4 h-4 text-gray-500 shrink-0' />
            <span class='truncate'>{selectedPdf()?.fileName || 'Select PDF'}</span>
            <Show when={selectedPdf()?.tag === 'primary' || selectedPdf()?.tag === 'protocol'}>
              {getTagIcon(selectedPdf()?.tag)}
            </Show>
            <BiRegularChevronDown class='w-4 h-4 text-gray-400 shrink-0' />
          </button>
        </Menu>
        <span class='text-xs text-gray-500'>{props.pdfs?.length || 0} PDFs</span>
      </div>
    </Show>
  );
}
