/**
 * ROBINS-I Checklist comparison utilities for reconciliation workflow
 * Compares two reviewer checklists and helps create a finalized consensus version
 */

import {
  ROBINS_I_CHECKLIST,
  getDomainQuestions,
  getActiveDomainKeys,
} from './checklist-map.js'
import { CHECKLIST_TYPES } from '@/checklist-registry/types.js'

/**
 * Deep clone a plain object/array via JSON serialization
 * @param {*} value - Value to clone
 * @returns {*} Deep cloned value
 */
function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Get all section B question keys
 * @returns {string[]} Array of section B question keys
 */
export function getSectionBKeys() {
  return Object.keys(ROBINS_I_CHECKLIST.sectionB)
}

/**
 * Get domain keys for comparison (uses ITT variant for domain 1 by default)
 * @param {boolean} isPerProtocol - Whether to use per-protocol variant
 * @returns {string[]} Array of domain keys
 */
export function getDomainKeysForComparison(isPerProtocol = false) {
  return getActiveDomainKeys(isPerProtocol)
}

/**
 * Compare the answers of two checklists and identify differences
 * @param {Object} checklist1 - First reviewer's checklist
 * @param {Object} checklist2 - Second reviewer's checklist
 * @returns {Object} Comparison result with agreements, disagreements, and stats
 */
export function compareChecklists(checklist1, checklist2) {
  if (!checklist1 || !checklist2) {
    return {
      sectionB: { agreements: [], disagreements: [] },
      domains: {},
      stats: { total: 0, agreed: 0, disagreed: 0 },
    }
  }

  // Use the same protocol type for comparison (prefer checklist1's setting)
  const isPerProtocol = checklist1.sectionC?.isPerProtocol || false

  const result = {
    sectionB: compareSectionB(checklist1.sectionB, checklist2.sectionB),
    domains: {},
    overall: compareOverall(checklist1.overall, checklist2.overall),
    stats: { total: 0, agreed: 0, disagreed: 0 },
  }

  // Compare each active domain
  const activeDomains = getActiveDomainKeys(isPerProtocol)

  for (const domainKey of activeDomains) {
    result.domains[domainKey] = compareDomain(
      domainKey,
      checklist1[domainKey],
      checklist2[domainKey],
    )
  }

  // Calculate overall stats
  let totalQuestions = 0
  let agreements = 0

  // Section B stats
  totalQuestions +=
    result.sectionB.agreements.length + result.sectionB.disagreements.length
  agreements += result.sectionB.agreements.length

  // Domain stats
  Object.values(result.domains).forEach((domain) => {
    totalQuestions +=
      domain.questions.agreements.length + domain.questions.disagreements.length
    agreements += domain.questions.agreements.length

    // Count judgement agreement
    if (domain.judgementMatch) {
      totalQuestions += 1
      agreements += 1
    } else if (domain.reviewer1?.judgement || domain.reviewer2?.judgement) {
      totalQuestions += 1
    }
  })

  result.stats = {
    total: totalQuestions,
    agreed: agreements,
    disagreed: totalQuestions - agreements,
    agreementRate: totalQuestions > 0 ? agreements / totalQuestions : 0,
  }

  return result
}

/**
 * Compare Section B answers
 * @param {Object} sectionB1 - First reviewer's Section B
 * @param {Object} sectionB2 - Second reviewer's Section B
 * @returns {Object} Comparison result
 */
function compareSectionB(sectionB1, sectionB2) {
  const keys = getSectionBKeys()
  const agreements = []
  const disagreements = []

  for (const key of keys) {
    const ans1 = sectionB1?.[key]?.answer
    const ans2 = sectionB2?.[key]?.answer

    const comparison = {
      key,
      reviewer1: { answer: ans1, comment: sectionB1?.[key]?.comment || '' },
      reviewer2: { answer: ans2, comment: sectionB2?.[key]?.comment || '' },
    }

    if (ans1 === ans2) {
      agreements.push({ ...comparison, isAgreement: true })
    } else {
      disagreements.push({ ...comparison, isAgreement: false })
    }
  }

  return { agreements, disagreements }
}

/**
 * Compare a domain between two checklists
 * @param {string} domainKey - The domain key
 * @param {Object} domain1 - First reviewer's domain
 * @param {Object} domain2 - Second reviewer's domain
 * @returns {Object} Comparison result
 */
export function compareDomain(domainKey, domain1, domain2) {
  const questions = getDomainQuestions(domainKey)
  const questionKeys = Object.keys(questions)

  const agreements = []
  const disagreements = []

  for (const qKey of questionKeys) {
    const ans1 = domain1?.answers?.[qKey]?.answer
    const ans2 = domain2?.answers?.[qKey]?.answer

    const comparison = {
      key: qKey,
      questionDef: questions[qKey],
      reviewer1: {
        answer: ans1,
        comment: domain1?.answers?.[qKey]?.comment || '',
      },
      reviewer2: {
        answer: ans2,
        comment: domain2?.answers?.[qKey]?.comment || '',
      },
    }

    if (ans1 === ans2) {
      agreements.push({ ...comparison, isAgreement: true })
    } else {
      disagreements.push({ ...comparison, isAgreement: false })
    }
  }

  // Compare domain-level judgement
  const judgementMatch = domain1?.judgement === domain2?.judgement
  const directionMatch = domain1?.direction === domain2?.direction

  return {
    questions: { agreements, disagreements },
    judgementMatch,
    directionMatch,
    reviewer1: {
      judgement: domain1?.judgement,
      direction: domain1?.direction,
    },
    reviewer2: {
      judgement: domain2?.judgement,
      direction: domain2?.direction,
    },
  }
}

/**
 * Compare overall judgements
 * @param {Object} overall1 - First reviewer's overall
 * @param {Object} overall2 - Second reviewer's overall
 * @returns {Object} Comparison result
 */
function compareOverall(overall1, overall2) {
  return {
    judgementMatch: overall1?.judgement === overall2?.judgement,
    directionMatch: overall1?.direction === overall2?.direction,
    reviewer1: overall1,
    reviewer2: overall2,
  }
}

/**
 * Create a merged/reconciled checklist from two source checklists
 * @param {Object} checklist1 - First reviewer's checklist
 * @param {Object} checklist2 - Second reviewer's checklist
 * @param {Object} selections - Object mapping keys to 'reviewer1' | 'reviewer2' | custom value
 * @param {Object} metadata - Metadata for the reconciled checklist
 * @returns {Object} The reconciled checklist
 */
export function createReconciledChecklist(
  checklist1,
  checklist2,
  selections,
  metadata = {},
) {
  const isPerProtocol = checklist1.sectionC?.isPerProtocol || false

  const reconciled = {
    name: metadata.name || 'Reconciled Checklist',
    reviewerName: metadata.reviewerName || 'Consensus',
    createdAt: metadata.createdAt || new Date().toISOString().split('T')[0],
    id: metadata.id || `reconciled-${Date.now()}`,
    checklistType: CHECKLIST_TYPES.ROBINS_I,
    sourceChecklists: [checklist1.id, checklist2.id],

    // Copy structural elements from checklist1
    planning: deepClone(checklist1.planning || {}),
    sectionA: deepClone(checklist1.sectionA || {}),
    sectionC: deepClone(checklist1.sectionC || {}),
    sectionD: deepClone(checklist1.sectionD || {}),
    confoundingEvaluation: deepClone(checklist1.confoundingEvaluation || {}),
  }

  // Reconcile Section B
  reconciled.sectionB = reconcileSection(
    checklist1.sectionB,
    checklist2.sectionB,
    selections.sectionB || {},
    getSectionBKeys(),
  )

  // Reconcile domains
  const activeDomains = getActiveDomainKeys(isPerProtocol)

  for (const domainKey of activeDomains) {
    reconciled[domainKey] = reconcileDomain(
      domainKey,
      checklist1[domainKey],
      checklist2[domainKey],
      selections[domainKey] || {},
    )
  }

  // Copy inactive domain from checklist1 (for completeness)
  const inactiveDomain = isPerProtocol ? 'domain1a' : 'domain1b'
  reconciled[inactiveDomain] = deepClone(checklist1[inactiveDomain] || {})

  // Reconcile overall
  reconciled.overall = reconcileOverall(
    checklist1.overall,
    checklist2.overall,
    selections.overall || {},
  )

  return reconciled
}

/**
 * Reconcile a section with question answers
 * @param {Object} section1 - First reviewer's section
 * @param {Object} section2 - Second reviewer's section
 * @param {Object} selections - Selection choices
 * @param {string[]} keys - Question keys
 * @returns {Object} Reconciled section
 */
function reconcileSection(section1, section2, selections, keys) {
  const reconciled = {}

  for (const key of keys) {
    const selection = selections[key]

    if (!selection || selection === 'reviewer1') {
      reconciled[key] = JSON.parse(
        JSON.stringify(section1?.[key] || { answer: null, comment: '' }),
      )
    } else if (selection === 'reviewer2') {
      reconciled[key] = JSON.parse(
        JSON.stringify(section2?.[key] || { answer: null, comment: '' }),
      )
    } else if (typeof selection === 'object') {
      reconciled[key] = JSON.parse(JSON.stringify(selection))
    }
  }

  return reconciled
}

/**
 * Reconcile a domain
 * @param {string} domainKey - Domain key
 * @param {Object} domain1 - First reviewer's domain
 * @param {Object} domain2 - Second reviewer's domain
 * @param {Object} selections - Selection choices
 * @returns {Object} Reconciled domain
 */
function reconcileDomain(domainKey, domain1, domain2, selections) {
  const questions = getDomainQuestions(domainKey)
  const questionKeys = Object.keys(questions)

  const reconciledAnswers = {}

  for (const qKey of questionKeys) {
    const selection = selections.answers?.[qKey]

    if (!selection || selection === 'reviewer1') {
      reconciledAnswers[qKey] = deepClone(
        domain1?.answers?.[qKey] || { answer: null, comment: '' },
      )
    } else if (selection === 'reviewer2') {
      reconciledAnswers[qKey] = deepClone(
        domain2?.answers?.[qKey] || { answer: null, comment: '' },
      )
    } else if (typeof selection === 'object') {
      reconciledAnswers[qKey] = deepClone(selection)
    }
  }

  // Handle judgement selection
  let judgement
  if (!selections.judgement || selections.judgement === 'reviewer1') {
    judgement = domain1?.judgement
  } else if (selections.judgement === 'reviewer2') {
    judgement = domain2?.judgement
  } else {
    judgement = selections.judgement
  }

  // Handle direction selection
  let direction
  if (!selections.direction || selections.direction === 'reviewer1') {
    direction = domain1?.direction
  } else if (selections.direction === 'reviewer2') {
    direction = domain2?.direction
  } else {
    direction = selections.direction
  }

  return {
    answers: reconciledAnswers,
    judgement,
    direction,
  }
}

/**
 * Reconcile overall judgement
 * @param {Object} overall1 - First reviewer's overall
 * @param {Object} overall2 - Second reviewer's overall
 * @param {Object} selections - Selection choices
 * @returns {Object} Reconciled overall
 */
function reconcileOverall(overall1, overall2, selections) {
  let judgement
  if (!selections.judgement || selections.judgement === 'reviewer1') {
    judgement = overall1?.judgement
  } else if (selections.judgement === 'reviewer2') {
    judgement = overall2?.judgement
  } else {
    judgement = selections.judgement
  }

  let direction
  if (!selections.direction || selections.direction === 'reviewer1') {
    direction = overall1?.direction
  } else if (selections.direction === 'reviewer2') {
    direction = overall2?.direction
  } else {
    direction = selections.direction
  }

  return { judgement, direction }
}

/**
 * Get a summary of what needs reconciliation
 * @param {Object} comparison - Result from compareChecklists
 * @returns {Object} Summary with counts and lists
 */
export function getReconciliationSummary(comparison) {
  const { stats, sectionB, domains, overall } = comparison

  const domainDisagreements = []
  const judgementDisagreements = []

  Object.entries(domains).forEach(([domainKey, domain]) => {
    if (domain.questions.disagreements.length > 0) {
      domainDisagreements.push({
        domain: domainKey,
        count: domain.questions.disagreements.length,
        questions: domain.questions.disagreements.map((d) => d.key),
      })
    }

    if (
      !domain.judgementMatch &&
      (domain.reviewer1?.judgement || domain.reviewer2?.judgement)
    ) {
      judgementDisagreements.push(domainKey)
    }
  })

  return {
    totalQuestions: stats.total,
    agreementCount: stats.agreed,
    disagreementCount: stats.disagreed,
    agreementPercentage: Math.round(stats.agreementRate * 100),
    sectionBDisagreements: sectionB.disagreements.length,
    domainDisagreements,
    judgementDisagreements,
    overallDisagreement: !overall.judgementMatch,
    needsReconciliation: stats.disagreed > 0 || !overall.judgementMatch,
  }
}

/**
 * Get readable question text from domain and question key
 * @param {string} domainKey - The domain key
 * @param {string} questionKey - The question key
 * @returns {string} The question text
 */
export function getQuestionText(domainKey, questionKey) {
  const questions = getDomainQuestions(domainKey)
  const q = questions[questionKey]
  return q ? `${q.number}: ${q.text}` : questionKey
}

/**
 * Get the domain definition
 * @param {string} domainKey - The domain key
 * @returns {Object} The domain definition
 */
export function getDomainDef(domainKey) {
  return ROBINS_I_CHECKLIST[domainKey]
}

/**
 * Get the domain name/title
 * @param {string} domainKey - The domain key
 * @returns {string} The domain name
 */
export function getDomainName(domainKey) {
  return ROBINS_I_CHECKLIST[domainKey]?.name || domainKey
}
