/**
 * Y.js sync utilities for useProject
 * Handles syncing Y.Doc state to the project store
 */

import projectStore from '@/stores/projectStore.js'

/**
 * Creates sync utilities for syncing Y.Doc to store
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @returns {Object} Sync utilities
 */
export function createSyncManager(projectId, getYDoc) {
  /**
   * Sync the Y.Doc state to the project store
   */
  function syncFromYDoc() {
    const ydoc = getYDoc()
    if (!ydoc) return

    const studiesMap = ydoc.getMap('reviews')
    const studiesList = []

    for (const [studyId, studyYMap] of studiesMap.entries()) {
      const studyData = studyYMap.toJSON ? studyYMap.toJSON() : studyYMap
      const study = buildStudyFromYMap(studyId, studyData, studyYMap)
      studiesList.push(study)
    }

    // Sort by createdAt
    studiesList.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))

    // Sync meta
    const metaMap = ydoc.getMap('meta')
    const metaData = metaMap.toJSON ? metaMap.toJSON() : {}

    // Sync members
    const membersMap = ydoc.getMap('members')
    const membersList = buildMembersList(membersMap)

    // Update store with all data
    projectStore.setProjectData(projectId, {
      studies: studiesList,
      meta: metaData,
      members: membersList,
    })
  }

  return {
    syncFromYDoc,
  }
}

/**
 * Build a study object from Y.Map data
 */
function buildStudyFromYMap(studyId, studyData, studyYMap) {
  const study = {
    id: studyId,
    name: studyData.name || '',
    description: studyData.description || '',
    // Reference metadata fields
    originalTitle: studyData.originalTitle || null,
    firstAuthor: studyData.firstAuthor || null,
    publicationYear: studyData.publicationYear || null,
    authors: studyData.authors || null,
    journal: studyData.journal || null,
    doi: studyData.doi || null,
    abstract: studyData.abstract || null,
    importSource: studyData.importSource || null,
    pdfUrl: studyData.pdfUrl || null,
    pdfSource: studyData.pdfSource || null,
    pdfAccessible: Boolean(studyData.pdfAccessible || false),
    pmid: studyData.pmid || null,
    url: studyData.url || null,
    volume: studyData.volume || null,
    issue: studyData.issue || null,
    pages: studyData.pages || null,
    type: studyData.type || null,
    // Reviewer assignments
    reviewer1: studyData.reviewer1 || null,
    reviewer2: studyData.reviewer2 || null,
    createdAt: studyData.createdAt,
    updatedAt: studyData.updatedAt,
    checklists: [],
    pdfs: [],
  }

  // Get checklists from nested Y.Map
  const checklistsMap = studyYMap.get ? studyYMap.get('checklists') : null
  if (checklistsMap && typeof checklistsMap.entries === 'function') {
    for (const [checklistId, checklistYMap] of checklistsMap.entries()) {
      const checklistData = checklistYMap.toJSON
        ? checklistYMap.toJSON()
        : checklistYMap
      study.checklists.push({
        id: checklistId,
        type: checklistData.type || 'AMSTAR2',
        title: checklistData.title || null,
        assignedTo: checklistData.assignedTo || null,
        status: checklistData.status || 'pending',
        createdAt: checklistData.createdAt,
        updatedAt: checklistData.updatedAt,
      })
    }
  }

  // Get PDFs from nested Y.Map
  const pdfsMap = studyYMap.get ? studyYMap.get('pdfs') : null
  if (pdfsMap && typeof pdfsMap.entries === 'function') {
    for (const [pdfId, pdfYMap] of pdfsMap.entries()) {
      const pdfData = pdfYMap.toJSON ? pdfYMap.toJSON() : pdfYMap
      study.pdfs.push({
        id: pdfData.id || pdfId,
        fileName: pdfData.fileName || pdfId, // fallback for old structure where pdfId was fileName
        key: pdfData.key,
        size: pdfData.size,
        uploadedBy: pdfData.uploadedBy,
        uploadedAt: pdfData.uploadedAt,
        tag: pdfData.tag || 'secondary',
        // Citation metadata
        title: pdfData.title || null,
        firstAuthor: pdfData.firstAuthor || null,
        publicationYear: pdfData.publicationYear || null,
        journal: pdfData.journal || null,
        doi: pdfData.doi || null,
      })
    }
  }

  // Get reconciliation progress if any
  const reconciliationMap = studyYMap.get
    ? studyYMap.get('reconciliation')
    : null
  if (reconciliationMap) {
    const reconciliationData = reconciliationMap.toJSON
      ? reconciliationMap.toJSON()
      : reconciliationMap
    if (reconciliationData.checklist1Id && reconciliationData.checklist2Id) {
      study.reconciliation = {
        checklist1Id: reconciliationData.checklist1Id,
        checklist2Id: reconciliationData.checklist2Id,
        reconciledChecklistId: reconciliationData.reconciledChecklistId || null,
        currentPage: reconciliationData.currentPage || 0,
        viewMode: reconciliationData.viewMode || 'questions',
        updatedAt: reconciliationData.updatedAt,
      }
    }
  }

  return study
}

/**
 * Build members list from Y.Map
 */
function buildMembersList(membersMap) {
  const membersList = []
  for (const [userId, memberYMap] of membersMap.entries()) {
    const memberData = memberYMap.toJSON ? memberYMap.toJSON() : memberYMap
    membersList.push({
      userId,
      role: memberData.role,
      joinedAt: memberData.joinedAt,
      name: memberData.name,
      email: memberData.email,
      displayName: memberData.displayName,
      image: memberData.image,
    })
  }
  return membersList
}
