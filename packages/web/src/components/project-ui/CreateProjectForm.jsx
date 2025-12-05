import { createSignal, Show } from 'solid-js';
import { BiRegularImport, BiRegularSearch } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { showToast } from '@components/zag/Toast.jsx';
import { extractPdfTitle, readFileAsArrayBuffer } from '@/lib/pdfUtils.js';
import { parseReferenceFile } from '@/lib/referenceParser.js';
import { fetchReferenceByIdentifier, parseIdentifiers } from '@/lib/referenceLookup.js';
import {
  PdfUploadTab,
  ReferenceImportTab,
  DoiLookupTab,
  StudyAddSummary,
} from './create-form/index.js';

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

  // Reference import state
  const [importedRefs, setImportedRefs] = createSignal([]);
  const [selectedRefIds, setSelectedRefIds] = createSignal(new Set());
  const [refFileName, setRefFileName] = createSignal('');
  const [parsingRefs, setParsingRefs] = createSignal(false);

  // DOI/PMID lookup state
  const [identifierInput, setIdentifierInput] = createSignal('');
  const [lookupRefs, setLookupRefs] = createSignal([]);
  const [selectedLookupIds, setSelectedLookupIds] = createSignal(new Set());
  const [lookingUp, setLookingUp] = createSignal(false);
  const [lookupErrors, setLookupErrors] = createSignal([]);

  // Tab state: 'pdfs', 'references', or 'lookup'
  const [activeTab, setActiveTab] = createSignal('pdfs');

  // ============ PDF Handlers ============
  const handlePdfSelect = async files => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    const newPdfs = pdfFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      title: null,
      extracting: true,
      data: null,
    }));

    setUploadedPdfs(prev => [...prev, ...newPdfs]);

    for (const pdf of newPdfs) {
      try {
        const arrayBuffer = await readFileAsArrayBuffer(pdf.file);
        const bufferForExtraction = arrayBuffer.slice(0);
        const title = await extractPdfTitle(bufferForExtraction);
        const dataArray = Array.from(new Uint8Array(arrayBuffer));

        setUploadedPdfs(prev =>
          prev.map(p =>
            p.id === pdf.id ?
              {
                ...p,
                title: title || pdf.file.name.replace(/\.pdf$/i, ''),
                extracting: false,
                data: dataArray,
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

  // ============ Reference Import Handlers ============
  const handleReferenceFileSelect = async files => {
    if (!files || files.length === 0) return;

    const file = files[0];
    setRefFileName(file.name);
    setParsingRefs(true);

    try {
      const refs = await parseReferenceFile(file);

      if (refs.length === 0) {
        showToast.warning('No References Found', 'The file does not contain any valid references.');
        setImportedRefs([]);
        setSelectedRefIds(new Set());
        return;
      }

      const refsWithIds = refs.map((ref, index) => ({
        ...ref,
        _id: `ref-${index}`,
      }));

      setImportedRefs(refsWithIds);
      setSelectedRefIds(new Set(refsWithIds.map(r => r._id)));

      showToast.success(
        'References Parsed',
        `Found ${refs.length} reference${refs.length === 1 ? '' : 's'}.`,
      );
    } catch (error) {
      console.error('Error parsing reference file:', error);
      showToast.error('Parse Error', 'Failed to parse the reference file.');
      setImportedRefs([]);
      setSelectedRefIds(new Set());
    } finally {
      setParsingRefs(false);
    }
  };

  const toggleRefSelection = id => {
    setSelectedRefIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllRefs = () => {
    if (selectedRefIds().size === importedRefs().length) {
      setSelectedRefIds(new Set());
    } else {
      setSelectedRefIds(new Set(importedRefs().map(r => r._id)));
    }
  };

  const clearImportedRefs = () => {
    setImportedRefs([]);
    setSelectedRefIds(new Set());
    setRefFileName('');
  };

  const selectedRefs = () => {
    const ids = selectedRefIds();
    return importedRefs().filter(r => ids.has(r._id));
  };

  // ============ DOI/PMID Lookup Handlers ============
  const handleLookup = async () => {
    const input = identifierInput().trim();
    if (!input) return;

    const identifiers = parseIdentifiers(input);
    if (identifiers.length === 0) {
      showToast.warning('No Identifiers', 'Could not find any valid DOIs or PMIDs in the input.');
      return;
    }

    setLookingUp(true);
    setLookupErrors([]);

    const results = [];
    const errors = [];

    for (const id of identifiers) {
      try {
        const ref = await fetchReferenceByIdentifier(id);
        if (ref) {
          results.push({
            ...ref,
            _id: `lookup-${lookupRefs().length + results.length}`,
          });
        }
      } catch (error) {
        console.error(`Error looking up ${id}:`, error);
        errors.push({ identifier: id, error: error.message });
      }
    }

    if (results.length > 0) {
      setLookupRefs(prev => [...prev, ...results]);
      setSelectedLookupIds(prev => {
        const next = new Set(prev);
        results.forEach(r => next.add(r._id));
        return next;
      });
      showToast.success(
        'References Found',
        `Found ${results.length} reference${results.length === 1 ? '' : 's'}.`,
      );
    }

    if (errors.length > 0) {
      setLookupErrors(errors);
      if (results.length === 0) {
        showToast.error(
          'Lookup Failed',
          `Could not find references for ${errors.length} identifier(s).`,
        );
      }
    }

    setIdentifierInput('');
    setLookingUp(false);
  };

  const toggleLookupSelection = id => {
    setSelectedLookupIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllLookup = () => {
    if (selectedLookupIds().size === lookupRefs().length) {
      setSelectedLookupIds(new Set());
    } else {
      setSelectedLookupIds(new Set(lookupRefs().map(r => r._id)));
    }
  };

  const clearLookupRefs = () => {
    setLookupRefs([]);
    setSelectedLookupIds(new Set());
    setIdentifierInput('');
    setLookupErrors([]);
  };

  const selectedLookupRefs = () => {
    const ids = selectedLookupIds();
    return lookupRefs().filter(r => ids.has(r._id));
  };

  const removeLookupRef = id => {
    setLookupRefs(prev => prev.filter(r => r._id !== id));
    setSelectedLookupIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // ============ Form Handlers ============
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

      // Collect PDFs
      const pdfsToProcess = uploadedPdfs().filter(p => p.title && !p.extracting && p.data);
      const pendingPdfs = pdfsToProcess.map(p => ({
        title: p.title,
        fileName: p.file.name,
        data: p.data,
      }));

      // Collect file-imported references
      const refsToImport = selectedRefs().map(({ _id, ...ref }) => ({
        title: ref.title,
        metadata: {
          firstAuthor: ref.firstAuthor,
          publicationYear: ref.publicationYear,
          authors: ref.authors,
          journal: ref.journal,
          doi: ref.doi,
          abstract: ref.abstract,
          importSource: 'reference-file',
        },
      }));

      // Collect DOI/PMID lookup references
      const lookupRefsToImport = selectedLookupRefs().map(({ _id, ...ref }) => ({
        title: ref.title,
        metadata: {
          firstAuthor: ref.firstAuthor,
          publicationYear: ref.publicationYear,
          authors: ref.authors,
          journal: ref.journal,
          doi: ref.doi,
          abstract: ref.abstract,
          importSource: ref.importSource || 'doi-lookup',
        },
      }));

      const allRefsToImport = [...refsToImport, ...lookupRefsToImport];
      props.onProjectCreated?.(newProject, pendingPdfs, allRefsToImport);
    } catch (error) {
      console.error('Error creating project:', error);
      showToast.error('Creation Failed', 'Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setProjectName('');
    setProjectDescription('');
    setUploadedPdfs([]);
    setImportedRefs([]);
    setSelectedRefIds(new Set());
    setRefFileName('');
    setLookupRefs([]);
    setSelectedLookupIds(new Set());
    setIdentifierInput('');
    setLookupErrors([]);
    props.onCancel?.();
  };

  // Count of items to be added
  const pdfCount = () => uploadedPdfs().filter(p => p.title && !p.extracting).length;
  const refCount = () => selectedRefIds().size;
  const lookupCount = () => selectedLookupIds().size;

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

        {/* Add Studies Section with Tabs */}
        <div>
          <label class='block text-sm font-semibold text-gray-700 mb-2'>
            Add Studies (Optional)
          </label>

          {/* Tab buttons */}
          <div class='flex border-b border-gray-200 mb-4'>
            <button
              type='button'
              onClick={() => setActiveTab('pdfs')}
              class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab() === 'pdfs' ?
                  'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span class='flex items-center gap-2'>
                <CgFileDocument class='w-4 h-4' />
                Upload PDFs
                <Show when={uploadedPdfs().length > 0}>
                  <span class='bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full'>
                    {uploadedPdfs().length}
                  </span>
                </Show>
              </span>
            </button>
            <button
              type='button'
              onClick={() => setActiveTab('references')}
              class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab() === 'references' ?
                  'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span class='flex items-center gap-2'>
                <BiRegularImport class='w-4 h-4' />
                Import References
                <Show when={selectedRefIds().size > 0}>
                  <span class='bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full'>
                    {selectedRefIds().size}
                  </span>
                </Show>
              </span>
            </button>
            <button
              type='button'
              onClick={() => setActiveTab('lookup')}
              class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab() === 'lookup' ?
                  'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span class='flex items-center gap-2'>
                <BiRegularSearch class='w-4 h-4' />
                DOI / PMID
                <Show when={selectedLookupIds().size > 0}>
                  <span class='bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full'>
                    {selectedLookupIds().size}
                  </span>
                </Show>
              </span>
            </button>
          </div>

          {/* Tab Content */}
          <Show when={activeTab() === 'pdfs'}>
            <PdfUploadTab
              uploadedPdfs={uploadedPdfs}
              onFilesChange={handlePdfSelect}
              onRemove={removePdf}
              onUpdateTitle={updatePdfTitle}
            />
          </Show>

          <Show when={activeTab() === 'references'}>
            <ReferenceImportTab
              importedRefs={importedRefs}
              selectedRefIds={selectedRefIds}
              refFileName={refFileName}
              parsingRefs={parsingRefs}
              onFileSelect={handleReferenceFileSelect}
              onToggleSelection={toggleRefSelection}
              onToggleSelectAll={toggleSelectAllRefs}
              onClear={clearImportedRefs}
            />
          </Show>

          <Show when={activeTab() === 'lookup'}>
            <DoiLookupTab
              identifierInput={identifierInput}
              setIdentifierInput={setIdentifierInput}
              lookupRefs={lookupRefs}
              selectedLookupIds={selectedLookupIds}
              lookingUp={lookingUp}
              lookupErrors={lookupErrors}
              onLookup={handleLookup}
              onToggleSelection={toggleLookupSelection}
              onToggleSelectAll={toggleSelectAllLookup}
              onRemove={removeLookupRef}
              onClear={clearLookupRefs}
            />
          </Show>
        </div>

        <StudyAddSummary pdfCount={pdfCount} refCount={refCount} lookupCount={lookupCount} />
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
