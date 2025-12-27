/**
 * Study operations for projectActionsStore
 */

import {
  uploadPdf,
  fetchPdfViaProxy,
  downloadPdf,
  deletePdf,
} from '@api/pdf-api.js'
import { cachePdf, clearStudyCache } from '@primitives/pdfCache.js'
import { showToast } from '@corates/ui'
import { importFromGoogleDrive } from '@api/google-drive.js'
import { extractPdfDoi, extractPdfTitle } from '@/lib/pdfUtils.js'
import { fetchFromDOI } from '@/lib/referenceLookup.js'
import projectStore from '../projectStore.js'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get study name from PDF filename (without .pdf extension)
 */
function getStudyNameFromFilename(pdfFileName) {
  if (!pdfFileName) return 'Untitled Study'
  return pdfFileName.replace(/\.pdf$/i, '')
}

/**
 * Extract metadata from PDF and optionally fetch DOI reference data
 * @returns {Object} Updates to apply to study metadata
 */
async function extractPdfMetadata(arrayBuffer, existingDoi, existingTitle) {
  const updates = {}

  const [extractedTitle, extractedDoi] = await Promise.all([
    extractPdfTitle(arrayBuffer.slice(0)),
    extractPdfDoi(arrayBuffer.slice(0)),
  ])

  const resolvedTitle = extractedTitle || existingTitle
  if (resolvedTitle && resolvedTitle !== existingTitle) {
    updates.originalTitle = resolvedTitle
  }

  const resolvedDoi = extractedDoi || existingDoi
  if (extractedDoi && !existingDoi) {
    updates.doi = extractedDoi
  }

  // Fetch additional metadata from DOI if available
  if (resolvedDoi) {
    try {
      const refData = await fetchFromDOI(resolvedDoi)
      if (refData) {
        if (!updates.doi) updates.doi = refData.doi || resolvedDoi
        if (refData.firstAuthor) updates.firstAuthor = refData.firstAuthor
        if (refData.publicationYear)
          updates.publicationYear = refData.publicationYear
        if (refData.authors) updates.authors = refData.authors
        if (refData.journal) updates.journal = refData.journal
        if (refData.abstract !== undefined) updates.abstract = refData.abstract
        updates.importSource = 'pdf'
      }
    } catch (err) {
      console.warn('Failed to fetch DOI metadata:', err)
    }
  }

  return updates
}

/**
 * Filter updates object to only include defined values
 */
function filterDefinedUpdates(updates) {
  const filtered = {}
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      filtered[key] = value
    }
  }
  return filtered
}

/**
 * Add PDF metadata to study, rolling back upload on failure
 */
async function addPdfMetadataToStudy(
  ops,
  studyId,
  pdfInfo,
  projectId,
  tag = 'primary',
) {
  try {
    ops.addPdfToStudy(studyId, pdfInfo, tag)
    return true
  } catch (err) {
    console.error('Failed to add PDF metadata:', err)
    // Rollback: delete the uploaded PDF
    deletePdf(projectId, studyId, pdfInfo.fileName).catch(console.warn)
    throw err
  }
}

/**
 * Handle Google Drive PDF import for a study
 * @returns {boolean} True if PDF was successfully imported
 */
async function handleGoogleDrivePdf(ops, study, studyId, projectId, userId) {
  if (!study.googleDriveFileId) return false

  try {
    const result = await importFromGoogleDrive(
      study.googleDriveFileId,
      projectId,
      studyId,
    )
    const importedFile = result?.file
    if (!importedFile?.fileName) return false

    await addPdfMetadataToStudy(
      ops,
      studyId,
      {
        key: importedFile.key,
        fileName: importedFile.fileName,
        size: importedFile.size,
        uploadedBy: userId,
        uploadedAt: Date.now(),
        source: 'google-drive',
      },
      projectId,
    )

    // Extract and apply metadata from the PDF
    try {
      const arrayBuffer = await downloadPdf(
        projectId,
        studyId,
        importedFile.fileName,
      )
      cachePdf(projectId, studyId, importedFile.fileName, arrayBuffer).catch(
        (err) => console.warn('Failed to cache Google Drive PDF:', err),
      )

      const metadataUpdates = await extractPdfMetadata(
        arrayBuffer,
        study.doi,
        study.title,
      )
      if (importedFile.fileName) {
        metadataUpdates.fileName = importedFile.fileName
      }

      const filtered = filterDefinedUpdates(metadataUpdates)
      if (Object.keys(filtered).length > 0) {
        ops.updateStudy(studyId, filtered)
      }
    } catch (extractErr) {
      console.warn(
        'Failed to extract metadata for Google Drive PDF:',
        extractErr,
      )
    }

    return true
  } catch (err) {
    console.error('Error importing PDF from Google Drive:', err)
    return false
  }
}

/**
 * Fetch PDF from URL via proxy
 * @returns {{pdfData: ArrayBuffer, pdfFileName: string} | null}
 */
async function fetchPdfFromUrl(study) {
  if (!study.pdfUrl || !study.pdfAccessible) return null

  try {
    const pdfData = await fetchPdfViaProxy(study.pdfUrl)
    const safeName = (study.doi || study.title || 'document')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 50)
    return { pdfData, pdfFileName: `${safeName}.pdf` }
  } catch (err) {
    console.warn('Failed to fetch PDF from URL:', err)
    return null
  }
}

/**
 * Upload PDF data and attach to study
 * @returns {boolean} True if upload succeeded
 */
async function uploadAndAttachPdf(
  ops,
  pdfData,
  pdfFileName,
  studyId,
  projectId,
  userId,
) {
  try {
    const result = await uploadPdf(projectId, studyId, pdfData, pdfFileName)
    cachePdf(projectId, studyId, result.fileName, pdfData).catch((err) =>
      console.warn('Failed to cache PDF:', err),
    )

    // Extract PDF metadata (title, DOI, and fetch DOI metadata if available)
    let pdfMetadata = {}
    try {
      const metadataUpdates = await extractPdfMetadata(pdfData, null, null)
      // Map study metadata fields to PDF metadata fields
      if (metadataUpdates.originalTitle)
        pdfMetadata.title = metadataUpdates.originalTitle
      if (metadataUpdates.firstAuthor)
        pdfMetadata.firstAuthor = metadataUpdates.firstAuthor
      if (metadataUpdates.publicationYear)
        pdfMetadata.publicationYear = metadataUpdates.publicationYear
      if (metadataUpdates.journal) pdfMetadata.journal = metadataUpdates.journal
      if (metadataUpdates.doi) pdfMetadata.doi = metadataUpdates.doi
    } catch (extractErr) {
      console.warn('Failed to extract PDF metadata:', extractErr)
    }

    await addPdfMetadataToStudy(
      ops,
      studyId,
      {
        key: result.key,
        fileName: result.fileName,
        size: result.size,
        uploadedBy: userId,
        uploadedAt: Date.now(),
        // Pass extracted citation metadata
        title: pdfMetadata.title || null,
        firstAuthor: pdfMetadata.firstAuthor || null,
        publicationYear: pdfMetadata.publicationYear || null,
        journal: pdfMetadata.journal || null,
        doi: pdfMetadata.doi || null,
      },
      projectId,
    )
    return true
  } catch (err) {
    console.error('Error uploading PDF:', err)
    return false
  }
}

/**
 * Creates study operations
 * @param {Function} getActiveConnection - Function to get current Y.js connection
 * @param {Function} getActiveProjectId - Function to get current project ID
 * @param {Function} getCurrentUserId - Function to get current user ID
 * @returns {Object} Study operations
 */
export function createStudyActions(
  getActiveConnection,
  getActiveProjectId,
  getCurrentUserId,
) {
  /**
   * Create a new study (uses active project)
   * @returns {string|null} The study ID or null if failed
   */
  function create(name, description = '', metadata = {}) {
    const ops = getActiveConnection()
    if (!ops?.createStudy) {
      console.error('No connection for active project')
      return null
    }
    return ops.createStudy(name, description, metadata)
  }

  /**
   * Update a study's properties (uses active project)
   */
  function update(studyId, updates) {
    const ops = getActiveConnection()
    if (!ops?.updateStudy) {
      console.error('No connection for active project')
      showToast.error('Update Failed', 'Not connected to project')
      return
    }
    try {
      ops.updateStudy(studyId, updates)
    } catch (err) {
      console.error('Error updating study:', err)
      showToast.error('Update Failed', 'Failed to update study')
    }
  }

  /**
   * Delete a study (low-level, no confirmation) (uses active project)
   * Cleans up all associated PDFs from R2 and IndexedDB before deleting from Y.js
   */
  async function deleteStudy(studyId) {
    const projectId = getActiveProjectId()
    const ops = getActiveConnection()
    if (!ops?.deleteStudy) {
      console.error('No connection for active project')
      showToast.error('Delete Failed', 'Not connected to project')
      return
    }

    try {
      // Get study data to access PDFs before deletion
      const study = projectStore.getStudy(projectId, studyId)
      const pdfs = study?.pdfs || []

      // Delete each PDF from R2 storage
      if (pdfs.length > 0) {
        const deletePromises = pdfs.map((pdf) => {
          if (!pdf?.fileName) return Promise.resolve()
          return deletePdf(projectId, studyId, pdf.fileName).catch((err) => {
            // Log but don't block - continue with other PDFs
            console.warn(`Failed to delete PDF ${pdf.fileName} from R2:`, err)
          })
        })
        await Promise.all(deletePromises)
      }

      // Clear all PDFs for this study from IndexedDB
      await clearStudyCache(projectId, studyId).catch((err) => {
        // Log but don't block - continue with Y.js deletion
        console.warn('Failed to clear study PDF cache from IndexedDB:', err)
      })

      // Finally, delete the study from Y.js
      ops.deleteStudy(studyId)
    } catch (err) {
      console.error('Error deleting study:', err)
      showToast.error('Delete Failed', 'Failed to delete study')
    }
  }

  /**
   * Add multiple studies in batch (from AddStudiesForm)
   * Handles PDF uploads, Google Drive imports, DOI lookups, etc.
   * Uses active project and current user automatically.
   * @param {Array} studiesToAdd - Studies to add
   * @returns {Promise<{successCount: number, manualPdfCount: number}>}
   */
  async function addBatch(studiesToAdd) {
    const projectId = getActiveProjectId()
    const userId = getCurrentUserId()
    const ops = getActiveConnection()

    if (!ops?.createStudy) {
      showToast.error('Add Failed', 'Not connected to project')
      throw new Error('Not connected to project')
    }

    let successCount = 0
    let manualPdfCount = 0

    try {
      for (const study of studiesToAdd) {
        try {
          // Create study with initial metadata
          const studyId = createStudyFromInput(ops, study)
          if (!studyId) continue

          // Handle PDF attachment (three possible sources)
          const pdfAttached = await attachPdfToStudy(
            ops,
            study,
            studyId,
            projectId,
            userId,
          )

          // Track if user needs to manually download PDF
          if (!pdfAttached && study.pdfUrl && !study.pdfAccessible) {
            manualPdfCount++
          }

          successCount++
        } catch (err) {
          console.error('Error adding study:', err)
        }
      }

      showBatchResultToast(successCount, manualPdfCount)
      return { successCount, manualPdfCount }
    } catch (err) {
      console.error('Error adding studies:', err)
      showToast.error('Addition Failed', 'Failed to add studies')
      throw err
    }
  }

  /**
   * Create a study from form input
   * @returns {string|null} Study ID or null
   */
  function createStudyFromInput(ops, study) {
    const metadata = {
      originalTitle: study.title || study.name || null,
      firstAuthor: study.firstAuthor,
      publicationYear: study.publicationYear,
      authors: study.authors,
      journal: study.journal,
      doi: study.doi,
      abstract: study.abstract,
      importSource: study.importSource,
      pdfUrl: study.pdfUrl,
      pdfSource: study.pdfSource,
    }

    const studyName = getStudyNameFromFilename(study.pdfFileName)
    return ops.createStudy(studyName, study.abstract || '', metadata)
  }

  /**
   * Attach PDF to study from various sources
   * Priority: 1) Direct PDF data, 2) Google Drive, 3) URL fetch
   * @returns {Promise<boolean>} True if PDF was attached
   */
  async function attachPdfToStudy(ops, study, studyId, projectId, userId) {
    // Source 1: Direct PDF data (from file upload)
    if (study.pdfData) {
      return uploadAndAttachPdf(
        ops,
        study.pdfData,
        study.pdfFileName,
        studyId,
        projectId,
        userId,
      )
    }

    // Source 2: Google Drive import
    if (study.googleDriveFileId) {
      const imported = await handleGoogleDrivePdf(
        ops,
        study,
        studyId,
        projectId,
        userId,
      )
      if (imported) return true
    }

    // Source 3: Fetch from URL
    if (study.pdfUrl && study.pdfAccessible) {
      const fetched = await fetchPdfFromUrl(study)
      if (fetched) {
        return uploadAndAttachPdf(
          ops,
          fetched.pdfData,
          fetched.pdfFileName,
          studyId,
          projectId,
          userId,
        )
      }
    }

    return false
  }

  /**
   * Show appropriate toast for batch add results
   */
  function showBatchResultToast(successCount, manualPdfCount) {
    if (successCount === 0) return

    const studyWord = successCount === 1 ? 'study' : 'studies'

    if (manualPdfCount > 0) {
      const pdfWord = manualPdfCount === 1 ? 'PDF requires' : 'PDFs require'
      showToast.info(
        'Studies Added',
        `Added ${successCount} ${studyWord}. ${manualPdfCount} ${pdfWord} manual download from the publisher.`,
      )
    } else {
      showToast.success(
        'Studies Added',
        `Successfully added ${successCount} ${studyWord}.`,
      )
    }
  }

  /**
   * Import references from Zotero/EndNote files (uses active project)
   */
  function importReferences(references) {
    const ops = getActiveConnection()
    if (!ops?.createStudy) {
      showToast.error('Import Failed', 'Not connected to project')
      return 0
    }

    let successCount = 0

    for (const ref of references) {
      try {
        const studyName = ref.pdfFileName
          ? getStudyNameFromFilename(ref.pdfFileName)
          : ref.title || 'Untitled Study'

        ops.createStudy(studyName, ref.abstract || '', {
          originalTitle: ref.title || null,
          firstAuthor: ref.firstAuthor,
          publicationYear: ref.publicationYear,
          authors: ref.authors,
          journal: ref.journal,
          doi: ref.doi,
          abstract: ref.abstract,
          importSource: 'reference-file',
        })
        successCount++
      } catch (err) {
        console.error('Error importing reference:', err)
      }
    }

    if (successCount > 0) {
      showToast.success(
        'Import Complete',
        `Successfully imported ${successCount} ${successCount === 1 ? 'study' : 'studies'}.`,
      )
    }
    return successCount
  }

  return {
    create,
    update,
    delete: deleteStudy,
    addBatch,
    importReferences,
  }
}
