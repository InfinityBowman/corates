import { createSignal, For, Show } from 'solid-js';
import { BiRegularCloudUpload, BiRegularTrash } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { extractPdfTitle, readFileAsArrayBuffer } from '@/lib/pdfUtils.js';

/**
 * Form for creating a new project with optional PDF uploads
 * @param {Object} props
 * @param {string} props.apiBase - API base URL
 * @param {Function} props.onProjectCreated - Called with the new project when created
 * @param {Function} props.onCancel - Called when form is cancelled
 */
export default function CreateProjectForm(props) {
  const [projectName, setProjectName] = createSignal('');
  const [projectDescription, setProjectDescription] = createSignal('');
  const [isCreating, setIsCreating] = createSignal(false);
  const [uploadedPdfs, setUploadedPdfs] = createSignal([]);
  const [isDragging, setIsDragging] = createSignal(false);

  let fileInputRef;

  // Handle PDF file selection
  const handlePdfSelect = async files => {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    // Add files with extracting state
    const newPdfs = pdfFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      title: null,
      extracting: true,
      data: null,
    }));

    setUploadedPdfs(prev => [...prev, ...newPdfs]);

    // Extract titles for each PDF
    for (const pdf of newPdfs) {
      try {
        const arrayBuffer = await readFileAsArrayBuffer(pdf.file);
        const title = await extractPdfTitle(arrayBuffer);

        setUploadedPdfs(prev =>
          prev.map(p =>
            p.id === pdf.id ?
              {
                ...p,
                title: title || pdf.file.name.replace(/\.pdf$/i, ''),
                extracting: false,
                data: arrayBuffer,
              }
            : p,
          ),
        );
      } catch (error) {
        console.error('Error extracting PDF title:', error);
        setUploadedPdfs(prev =>
          prev.map(p =>
            p.id === pdf.id ?
              {
                ...p,
                title: pdf.file.name.replace(/\.pdf$/i, ''),
                extracting: false,
              }
            : p,
          ),
        );
      }
    }
  };

  const removePdf = id => {
    setUploadedPdfs(prev => prev.filter(p => p.id !== id));
  };

  const updatePdfTitle = (id, newTitle) => {
    setUploadedPdfs(prev => prev.map(p => (p.id === id ? { ...p, title: newTitle } : p)));
  };

  // Handle drag and drop
  const handleDragOver = e => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = e => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = e => {
    e.preventDefault();
    setIsDragging(false);
    handlePdfSelect(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (!projectName().trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch(`${props.apiBase}/api/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName().trim(),
          description: projectDescription().trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to create project');

      const newProject = await response.json();

      // Collect PDFs to pass along
      const pdfsToProcess = uploadedPdfs().filter(p => p.title && !p.extracting);

      // Store in sessionStorage for the project view to pick up
      if (pdfsToProcess.length > 0) {
        sessionStorage.setItem(
          `project-${newProject.id}-pdfs`,
          JSON.stringify(
            pdfsToProcess.map(p => ({
              title: p.title,
              fileName: p.file.name,
              data: Array.from(new Uint8Array(p.data)),
            })),
          ),
        );
      }

      props.onProjectCreated?.(newProject);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setProjectName('');
    setProjectDescription('');
    setUploadedPdfs([]);
    props.onCancel?.();
  };

  return (
    <div class='bg-white p-6 rounded-lg border border-gray-200 shadow-sm'>
      <h3 class='text-lg font-semibold text-gray-900 mb-4'>Create New Project</h3>

      <div class='space-y-4'>
        <div>
          <label class='block text-sm font-semibold text-gray-700 mb-2'>Project Name</label>
          <input
            type='text'
            placeholder='e.g., Sleep Study Meta-Analysis'
            value={projectName()}
            onInput={e => setProjectName(e.target.value)}
            class='w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
          />
        </div>

        <div>
          <label class='block text-sm font-semibold text-gray-700 mb-2'>
            Description (Optional)
          </label>
          <textarea
            placeholder='Brief description of your research project...'
            value={projectDescription()}
            onInput={e => setProjectDescription(e.target.value)}
            rows='3'
            class='w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
          />
        </div>

        {/* PDF Upload Section */}
        <div>
          <label class='block text-sm font-semibold text-gray-700 mb-2'>
            Upload PDFs (Optional)
          </label>
          <p class='text-sm text-gray-500 mb-3'>
            Upload research papers to automatically create reviews. Titles will be extracted from
            each PDF.
          </p>

          {/* Drop zone */}
          <div
            class={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging() ?
                'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef?.click()}
          >
            <BiRegularCloudUpload class='w-10 h-10 mx-auto text-gray-400 mb-2' />
            <p class='text-sm text-gray-600'>
              <span class='font-medium text-blue-600'>Click to upload</span> or drag and drop
            </p>
            <p class='text-xs text-gray-500 mt-1'>PDF files only</p>
            <input
              ref={fileInputRef}
              type='file'
              accept='application/pdf'
              multiple
              class='hidden'
              onChange={e => handlePdfSelect(e.target.files)}
            />
          </div>

          {/* Uploaded PDFs list */}
          <Show when={uploadedPdfs().length > 0}>
            <div class='mt-4 space-y-2'>
              <For each={uploadedPdfs()}>
                {pdf => (
                  <div class='flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200'>
                    <CgFileDocument class='w-5 h-5 text-red-500 shrink-0' />
                    <div class='flex-1 min-w-0'>
                      <Show
                        when={!pdf.extracting}
                        fallback={
                          <div class='flex items-center gap-2'>
                            <div class='w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
                            <span class='text-sm text-gray-500'>Extracting title...</span>
                          </div>
                        }
                      >
                        <input
                          type='text'
                          value={pdf.title || ''}
                          onInput={e => updatePdfTitle(pdf.id, e.target.value)}
                          class='w-full text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0'
                          placeholder='Review title'
                        />
                        <p class='text-xs text-gray-500 truncate'>{pdf.file.name}</p>
                      </Show>
                    </div>
                    <button
                      type='button'
                      onClick={() => removePdf(pdf.id)}
                      class='p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors'
                    >
                      <BiRegularTrash class='w-4 h-4' />
                    </button>
                  </div>
                )}
              </For>
              <p class='text-xs text-gray-500 mt-2'>
                {uploadedPdfs().length} PDF{uploadedPdfs().length !== 1 ? 's' : ''} will create{' '}
                {uploadedPdfs().length} review{uploadedPdfs().length !== 1 ? 's' : ''}
              </p>
            </div>
          </Show>
        </div>
      </div>

      <div class='flex gap-3 mt-6'>
        <button
          onClick={handleSubmit}
          disabled={isCreating() || !projectName().trim()}
          class='inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md'
        >
          {isCreating() ? 'Creating...' : 'Create Project'}
        </button>
        <button
          onClick={handleCancel}
          class='px-4 py-2 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:border-blue-300 hover:text-blue-600 transition-colors'
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
