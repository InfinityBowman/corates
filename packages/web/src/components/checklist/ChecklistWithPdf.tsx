import { lazy, Suspense, useState } from 'react';
import { CloudUploadIcon } from 'lucide-react';
import { GenericChecklist } from '@/components/checklist/GenericChecklist';
import { SplitScreenLayout } from '@/components/checklist/SplitScreenLayout';
import { FileUpload, FileUploadDropzone, FileUploadHiddenInput } from '@/components/ui/file-upload';
import { Spinner } from '@/components/ui/spinner';
import { validatePdfFile } from '@/lib/pdfValidation';

const EmbedPdfViewer = lazy(() => import('@/components/pdf/EmbedPdfViewer'));

interface ChecklistWithPdfProps {
  studyId: string;
  checklistId: string;
  checklistType: string;
  headerContent?: React.ReactNode;
  pdfData?: ArrayBuffer | null;
  pdfFileName?: string | null;
  readOnly?: boolean;
  pdfs?: any[];
  selectedPdfId?: string | null;
  onPdfSelect?: (_pdfId: string) => void;
  pdfUrl?: string | null;
  onAnnotationAdd?: (_annotation: any) => void;
  onAnnotationUpdate?: (_annotation: any) => void;
  onAnnotationDelete?: (_annotationId: string) => void;
  initialAnnotations?: any[];
  onPdfChange?: (_data: ArrayBuffer, _fileName: string) => void;
  onPdfClear?: () => void;
  allowDelete?: boolean;
}

export function ChecklistWithPdf({
  studyId,
  checklistId,
  checklistType,
  headerContent,
  pdfData,
  pdfFileName,
  readOnly,
  pdfs,
  selectedPdfId,
  onPdfSelect,
  pdfUrl,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  initialAnnotations,
  onPdfChange,
  onPdfClear,
  allowDelete,
}: ChecklistWithPdfProps) {
  const showUploadPanel = !pdfData && !!onPdfChange;

  return (
    <div className='bg-secondary flex h-full min-h-0 flex-col'>
      <SplitScreenLayout
        defaultLayout='vertical'
        defaultRatio={50}
        showSecondPanel={!!pdfData || showUploadPanel}
        headerContent={headerContent}
        pdfUrl={pdfUrl}
        pdfData={pdfData}
      >
        <GenericChecklist
          studyId={studyId}
          checklistId={checklistId}
          checklistType={checklistType}
          readOnly={readOnly}
        />

        {pdfData ?
          <Suspense
            fallback={
              <div className='flex h-full items-center justify-center'>
                <Spinner size='md' />
              </div>
            }
          >
            <EmbedPdfViewer
              pdfData={pdfData}
              pdfFileName={pdfFileName || undefined}
              readOnly={readOnly}
              pdfs={pdfs}
              selectedPdfId={selectedPdfId}
              onPdfSelect={onPdfSelect}
              onAnnotationAdd={onAnnotationAdd}
              onAnnotationUpdate={onAnnotationUpdate}
              onAnnotationDelete={onAnnotationDelete}
              initialAnnotations={initialAnnotations}
              onPdfChange={onPdfChange}
              onPdfClear={onPdfClear}
              allowDelete={allowDelete}
            />
          </Suspense>
        : showUploadPanel ?
          <PdfUploadPanel onPdfChange={onPdfChange} />
        : null}
      </SplitScreenLayout>
    </div>
  );
}

function PdfUploadPanel({
  onPdfChange,
}: {
  onPdfChange: (_data: ArrayBuffer, _fileName: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleFilesChange(files: File[]) {
    const file = files[0];
    if (!file) return;
    setError(null);
    const result = await validatePdfFile(file);
    if (!result.valid) {
      setError((result as any).details?.message || (result as any).error);
      return;
    }
    const data = await file.arrayBuffer();
    onPdfChange(data, file.name);
  }

  return (
    <div className='flex h-full flex-col items-center justify-center p-8'>
      <FileUpload
        accept={['application/pdf', '.pdf']}
        maxFiles={1}
        onFileAccept={(details: any) => handleFilesChange(details.files)}
        className='w-full max-w-sm'
      >
        <FileUploadDropzone className='min-h-48'>
          <CloudUploadIcon className='text-muted-foreground size-10 opacity-60' />
          <p className='text-muted-foreground mt-3 text-center text-sm'>
            <span className='text-primary font-medium'>Click to upload</span> or drag and drop
          </p>
          <p className='text-muted-foreground/70 mt-1 text-xs'>PDF files only</p>
        </FileUploadDropzone>
        <FileUploadHiddenInput />
      </FileUpload>
      {error && <p className='text-destructive mt-3 text-sm'>{error}</p>}
    </div>
  );
}
