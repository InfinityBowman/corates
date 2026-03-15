// @ts-nocheck
import { useState, useMemo } from 'preact/hooks';
import { ToolbarButton, DropdownMenu, DropdownItem } from './ui';
import { DocumentIcon } from './icons';

type PdfPickerProps = {
  pdfs?: Array<{ id: string; fileName: string; tag?: string }>;
  selectedPdfId?: string | null;
  onPdfSelect?: (_pdfId: string) => void;
};

export function PdfPicker({ pdfs, selectedPdfId, onPdfSelect }: PdfPickerProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Don't show if there's only one or no PDFs
  if (!pdfs || pdfs.length <= 1) {
    return null;
  }

  // Sort PDFs: primary first, then protocol, then secondary
  const sortedPdfs = useMemo(() => {
    return [...pdfs].sort((a, b) => {
      const tagOrder = { primary: 0, protocol: 1, secondary: 2 };
      const tagA = tagOrder[a.tag as keyof typeof tagOrder] ?? 2;
      const tagB = tagOrder[b.tag as keyof typeof tagOrder] ?? 2;
      return tagA - tagB;
    });
  }, [pdfs]);

  // Find the selected PDF
  const selectedPdf = sortedPdfs.find(pdf => pdf.id === selectedPdfId);

  const handleSelect = (pdfId: string) => {
    if (onPdfSelect) {
      onPdfSelect(pdfId);
    }
    setIsMenuOpen(false);
  };

  // Format display name with tag
  const formatDisplayName = (pdf: { fileName: string; tag?: string }) => {
    if (pdf.tag === 'primary') {
      return `${pdf.fileName} (Primary)`;
    }
    if (pdf.tag === 'protocol') {
      return `${pdf.fileName} (Protocol)`;
    }
    return pdf.fileName;
  };

  return (
    <div className='relative'>
      <ToolbarButton
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        isActive={isMenuOpen}
        aria-label='Select PDF'
        title={selectedPdf ? formatDisplayName(selectedPdf) : 'Select PDF'}
      >
        <span className='flex items-center whitespace-nowrap'>
          <DocumentIcon className='h-4 w-4' />
          <span className='ml-1 text-xs'>{pdfs.length}</span>
        </span>
      </ToolbarButton>

      <DropdownMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} className='w-64'>
        {sortedPdfs.map(pdf => {
          const isSelected = pdf.id === selectedPdfId;
          return (
            <DropdownItem key={pdf.id} onClick={() => handleSelect(pdf.id)} isActive={isSelected}>
              {formatDisplayName(pdf)}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </div>
  );
}
