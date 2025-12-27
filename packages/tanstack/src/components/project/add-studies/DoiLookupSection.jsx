/**
 * DoiLookupSection - DOI/PMID lookup section for AddStudiesForm
 * Handles identifier input, lookup, and result selection
 * Only allows selecting references that have PDFs available (via Unpaywall)
 * Supports manual PDF upload for publisher-hosted articles that can't be auto-downloaded
 */

import { For, Show, createMemo } from 'solid-js'
import {
  BiRegularTrash,
  BiRegularSearch,
  BiRegularLinkExternal,
  BiRegularUpload,
} from 'solid-icons/bi'
import {
  FiFile,
  FiFileText,
  FiAlertCircle,
  FiCheck,
  FiDownload,
} from 'solid-icons/fi'
import { Checkbox, Tooltip, showToast } from '@corates/ui'
import { getRefDisplayName } from '@/lib/referenceParser.js'
import { useStudiesContext } from './AddStudiesContext.jsx'

export default function DoiLookupSection() {
  const studies = useStudiesContext()

  // Count refs with PDFs available
  const refsWithPdf = createMemo(() =>
    studies.lookupRefs().filter((r) => r.pdfAvailable),
  )
  const refsWithoutPdf = createMemo(() =>
    studies.lookupRefs().filter((r) => !r.pdfAvailable),
  )

  return (
    <div class="space-y-3">
      <p class="text-sm text-gray-500">
        Paste DOIs or PubMed IDs to find references with open-access PDFs. Only
        references with available PDFs can be added.
      </p>

      <div class="space-y-2">
        <textarea
          placeholder="10.1000/xyz123&#10;32615397&#10;10.1016/j.example.2023.01.001"
          value={studies.identifierInput()}
          onInput={(e) => studies.setIdentifierInput(e.target.value)}
          rows="4"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 placeholder-gray-400 transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => studies.handleLookup()}
          disabled={studies.lookingUp() || !studies.identifierInput().trim()}
          class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Show
            when={!studies.lookingUp()}
            fallback={
              <>
                <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Looking up...
              </>
            }
          >
            <BiRegularSearch class="h-4 w-4" />
            Look Up References
          </Show>
        </button>
      </div>

      <Show when={studies.lookupErrors().length > 0}>
        <div class="rounded-lg border border-red-200 bg-red-50 p-3">
          <p class="mb-1 text-sm font-medium text-red-700">
            Some lookups failed:
          </p>
          <ul class="list-inside list-disc text-xs text-red-600">
            <For each={studies.lookupErrors()}>
              {(err) => (
                <li>
                  <code class="font-mono">{err.identifier}</code>: {err.error}
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>

      <Show when={studies.lookupRefs().length > 0}>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">
              Found references:{' '}
              <span class="font-medium text-green-600">
                {refsWithPdf().length} with PDF
              </span>
              <Show when={refsWithoutPdf().length > 0}>
                <span class="mx-1 text-gray-400">|</span>
                <span class="text-amber-600">
                  {refsWithoutPdf().length} without PDF
                </span>
              </Show>
            </span>
            <button
              type="button"
              onClick={() => studies.clearLookupRefs()}
              class="text-xs text-red-600 hover:text-red-700 hover:underline"
            >
              Clear all
            </button>
          </div>

          <Show when={refsWithPdf().length > 0}>
            <div class="flex items-center gap-2 border-b border-gray-200 pb-2">
              <Checkbox
                checked={
                  studies.selectedLookupIds().size === refsWithPdf().length
                }
                indeterminate={
                  studies.selectedLookupIds().size > 0 &&
                  studies.selectedLookupIds().size < refsWithPdf().length
                }
                onChange={studies.toggleSelectAllLookup}
                label={`Select all with PDF (${studies.selectedLookupIds().size}/${refsWithPdf().length})`}
              />
            </div>
          </Show>

          <div class="max-h-64 space-y-1 overflow-y-auto pr-1">
            {/* References with PDF available */}
            <For each={refsWithPdf()}>
              {(ref) => {
                let fileInputRef

                const handleManualPdfSelect = async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return

                  if (file.type !== 'application/pdf') {
                    showToast.error('Invalid File', 'Please select a PDF file')
                    return
                  }

                  try {
                    const arrayBuffer = await file.arrayBuffer()
                    studies.attachPdfToLookupRef?.(
                      ref._id,
                      file.name,
                      arrayBuffer,
                    )
                    showToast.success('PDF Attached', `Attached ${file.name}`)
                  } catch (err) {
                    const { handleError } = await import('@/lib/error-utils.js')
                    await handleError(err, {
                      toastTitle: 'Error',
                    })
                  }

                  if (fileInputRef) fileInputRef.value = ''
                }

                return (
                  <div
                    class={`flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors ${
                      studies.selectedLookupIds().has(ref._id)
                        ? 'border border-green-200 bg-green-50 hover:bg-green-100'
                        : 'border border-transparent bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => studies.toggleLookupSelection(ref._id)}
                  >
                    {/* Hidden file input for manual PDF upload */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      class="hidden"
                      onChange={handleManualPdfSelect}
                    />
                    <Checkbox
                      checked={studies.selectedLookupIds().has(ref._id)}
                      onChange={() => studies.toggleLookupSelection(ref._id)}
                      class="mt-0.5"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start gap-2">
                        <p class="line-clamp-2 flex-1 text-sm font-medium text-gray-900">
                          {ref.title}
                        </p>
                        <div class="flex shrink-0 items-center gap-1">
                          <Show
                            when={ref.manualPdfData}
                            fallback={
                              <Show
                                when={ref.pdfAccessible}
                                fallback={
                                  <>
                                    <Tooltip content="Click to manually upload PDF after downloading from publisher">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          fileInputRef?.click()
                                        }}
                                        class="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200"
                                      >
                                        <BiRegularUpload class="h-3 w-3" />
                                        Upload PDF
                                      </button>
                                    </Tooltip>
                                    <Show when={ref.pdfUrl}>
                                      <Tooltip content="Download PDF from publisher (then upload)">
                                        <a
                                          href={ref.pdfUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          class="inline-flex h-6 w-6 items-center justify-center rounded text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                                        >
                                          <FiDownload class="h-4 w-4" />
                                        </a>
                                      </Tooltip>
                                    </Show>
                                  </>
                                }
                              >
                                <Tooltip
                                  content={`PDF available via ${ref.pdfSource || 'repository'} - will auto-download`}
                                >
                                  <span class="inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                                    <FiFileText class="h-3 w-3" />
                                    PDF
                                  </span>
                                </Tooltip>
                              </Show>
                            }
                          >
                            <Tooltip
                              content={`PDF uploaded: ${ref.manualPdfFileName}`}
                            >
                              <span class="inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                                <FiCheck class="h-3 w-3" />
                                PDF Ready
                              </span>
                            </Tooltip>
                          </Show>
                          <Show when={ref.pdfUrl && ref.pdfAccessible}>
                            <Tooltip content="View PDF">
                              <a
                                href={ref.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                class="inline-flex h-6 w-6 items-center justify-center rounded text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                              >
                                <BiRegularLinkExternal class="h-4 w-4" />
                              </a>
                            </Tooltip>
                          </Show>
                        </div>
                      </div>
                      <p class="mt-0.5 text-xs text-gray-500">
                        {getRefDisplayName(ref)}
                        <Show when={ref.journal}>
                          <span class="mx-1">-</span>
                          <span class="italic">{ref.journal}</span>
                        </Show>
                      </p>
                      <Show when={ref.doi}>
                        <p class="mt-0.5 font-mono text-xs text-blue-500">
                          {ref.doi}
                        </p>
                      </Show>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        studies.removeLookupRef(ref._id)
                      }}
                      class="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <BiRegularTrash class="h-4 w-4" />
                    </button>
                  </div>
                )
              }}
            </For>

            {/* References without PDF - shown but not selectable */}
            <Show when={refsWithoutPdf().length > 0}>
              <div class="mt-2 border-t border-gray-200 pt-2">
                <p class="mb-2 flex items-center gap-1 text-xs font-medium text-amber-600">
                  <FiAlertCircle class="h-3.5 w-3.5" />
                  No open-access PDF available:
                </p>
                <For each={refsWithoutPdf()}>
                  {(ref) => (
                    <div class="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/50 p-2 opacity-75">
                      <div class="mt-0.5 flex h-5 w-5 items-center justify-center">
                        <FiFile class="h-4 w-4 text-amber-400" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="line-clamp-2 text-sm font-medium text-gray-700">
                          {ref.title}
                        </p>
                        <p class="mt-0.5 text-xs text-gray-500">
                          {getRefDisplayName(ref)}
                          <Show when={ref.journal}>
                            <span class="mx-1">-</span>
                            <span class="italic">{ref.journal}</span>
                          </Show>
                        </p>
                        <Show when={ref.doi}>
                          <div class="mt-1 flex items-center gap-2">
                            <span class="font-mono text-xs text-gray-400">
                              {ref.doi}
                            </span>
                            <a
                              href={`https://doi.org/${ref.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              class="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-600"
                            >
                              View <BiRegularLinkExternal class="h-3 w-3" />
                            </a>
                          </div>
                        </Show>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          studies.removeLookupRef(ref._id)
                        }}
                        class="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <BiRegularTrash class="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
