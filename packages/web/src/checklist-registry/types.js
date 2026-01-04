import { LANDING_URL } from '@/config/api.js';

/**
 * Checklist Type Constants and Metadata
 *
 * This file defines all supported checklist types and their metadata.
 * Add new types here when implementing additional checklists.
 */

/**
 * Checklist type identifiers
 */
export const CHECKLIST_TYPES = {
  AMSTAR2: 'AMSTAR2',
  ROBINS_I: 'ROBINS_I',
  // Future types:
  // ROBINS_E: 'ROBINS_E',
  // ROB2: 'ROB2',
  // GRADE: 'GRADE',
};

/**
 * Metadata for each checklist type
 */
export const CHECKLIST_METADATA = {
  [CHECKLIST_TYPES.AMSTAR2]: {
    name: 'AMSTAR 2',
    shortName: 'AMSTAR 2',
    description: 'Quality assessment of systematic reviews',
    version: '2017',
    url: `${LANDING_URL}/resources`,
    scoreLevels: ['High', 'Moderate', 'Low', 'Critically Low'],
    scoreColors: {
      High: { bg: 'bg-green-100', text: 'text-green-800' },
      Moderate: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      Low: { bg: 'bg-orange-100', text: 'text-orange-800' },
      'Critically Low': { bg: 'bg-red-100', text: 'text-red-800' },
    },
  },
  [CHECKLIST_TYPES.ROBINS_I]: {
    name: 'ROBINS-I V2',
    shortName: 'ROBINS-I',
    description: 'Risk of bias in non-randomized studies of interventions',
    version: 'V2',
    url: `${LANDING_URL}/resources`,
    scoreLevels: ['Low', 'Moderate', 'Serious', 'Critical', 'Incomplete'],
    scoreColors: {
      Low: { bg: 'bg-green-100', text: 'text-green-800' },
      Moderate: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      Serious: { bg: 'bg-orange-100', text: 'text-orange-800' },
      Critical: { bg: 'bg-red-100', text: 'text-red-800' },
      Incomplete: { bg: 'bg-gray-100', text: 'text-gray-600' },
    },
  },
};

/**
 * Default checklist type when none is specified
 */
export const DEFAULT_CHECKLIST_TYPE = CHECKLIST_TYPES.AMSTAR2;

/**
 * Get metadata for a checklist type
 * @param {string} type - The checklist type identifier
 * @returns {Object} The metadata for the type, or AMSTAR2 metadata as default
 */
export function getChecklistMetadata(type) {
  return CHECKLIST_METADATA[type] || CHECKLIST_METADATA[DEFAULT_CHECKLIST_TYPE];
}

/**
 * Get available checklist types as options for UI selectors
 * @returns {Array<{value: string, label: string, description: string}>}
 */
export function getChecklistTypeOptions() {
  return Object.entries(CHECKLIST_METADATA).map(([type, meta]) => ({
    value: type,
    label: meta.name,
    description: meta.description,
  }));
}
