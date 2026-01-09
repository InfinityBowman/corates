/**
 * AMSTAR2 Checklist Logic
 *
 * This file re-exports checklist logic from @corates/shared while maintaining
 * backward compatibility with existing imports. UI-specific exports (like CSV)
 * are kept here since they're only used in the frontend.
 */

import { amstar2 } from '@corates/shared';
import { AMSTAR_CHECKLIST } from './checklist-map.js';

// Re-export functions from shared package with original names
export const createChecklist = amstar2.createAMSTAR2Checklist;
export const scoreChecklist = amstar2.scoreAMSTAR2Checklist;
export const isAMSTAR2Complete = amstar2.isAMSTAR2Complete;
export const getAnswers = amstar2.getAnswers;
export const consolidateAnswers = amstar2.consolidateAnswers;
export const getSelectedAnswer = amstar2.getSelectedAnswer;

/**
 * Export a checklist (or array of checklists) to CSV using the checklist map for headers.
 * Note: This is UI-specific and stays in the web package.
 * @param {Array|Object} checklists - One or more checklist objects.
 * @returns {string} CSV string.
 */
export function exportChecklistsToCSV(checklists) {
  const list = Array.isArray(checklists) ? checklists : [checklists];
  const questionKeys = Object.keys(AMSTAR_CHECKLIST);

  // CSV headers
  const headers = [
    'Checklist Name',
    'Reviewer',
    'Question',
    'Question Text',
    'Column Label',
    'Option Text',
    'Selected',
    'Selected Answer',
  ];

  const rows = [];

  list.forEach(cl => {
    questionKeys.forEach(q => {
      const question = AMSTAR_CHECKLIST[q];
      const questionText = question?.text || q;
      const columns = question?.columns || [];
      const answers = cl[q]?.answers || [];
      const critical = cl[q]?.critical || false;
      const selectedAnswer = getSelectedAnswer(answers, q) || '';

      columns.forEach((col, colIdx) => {
        const colLabel = col.label || '';
        const options = col.options || [];
        const ansArr = answers[colIdx] || [];
        options.forEach((optText, optIdx) => {
          const selected = ansArr[optIdx] === true ? 'TRUE' : 'FALSE';
          rows.push([
            cl.name || '',
            cl.reviewerName || '',
            critical,
            q,
            questionText,
            colLabel,
            optText,
            selected,
            selectedAnswer,
          ]);
        });
      });
    });
  });

  // CSV encode
  const escape = val => `"${String(val).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
  const csv =
    headers.map(escape).join(',') + '\n' + rows.map(row => row.map(escape).join(',')).join('\n');
  return csv;
}

/**
 * Import checklists from a CSV string.
 * @param {*} csv
 * @returns object matching the checklist structure
 */
// export function importChecklistsFromCSV(csv) {
//   // Parse CSV
//   const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });

//   // Group rows by checklist name + reviewer
//   const grouped = {};
//   data.forEach(async (row) => {
//     const key = `${row['Checklist Name']}|${row['Reviewer']}`;
//     if (!grouped[key]) {
//       grouped[key] = {
//         name: row['Checklist Name'],
//         reviewerName: row['Reviewer'],
//         createdAt: Date.now(),
//         id: await generateUUID(),
//       };
//     }
//     if (!grouped[key][row['Question']]) {
//       // Build empty answers array based on checklistMap
//       const questionDef = AMSTAR_CHECKLIST[row['Question']];
//       grouped[key][row['Question']] = {
//         answers: questionDef?.columns?.map((col) => Array(col.options.length).fill(false)) || [],
//         critical: questionDef?.critical || false,
//       };
//     }
//     // Find column index and option index
//     const questionDef = AMSTAR_CHECKLIST[row['Question']];
//     const colIdx = questionDef?.columns?.findIndex((col) => (col.label || '') === row['Column Label']);
//     const optIdx =
//       colIdx !== -1 ? questionDef.columns[colIdx].options.findIndex((opt) => opt === row['Option Text']) : -1;
//     if (colIdx !== -1 && optIdx !== -1) {
//       grouped[key][row['Question']].answers[colIdx][optIdx] = row['Selected'] === 'TRUE';
//     }
//   });

//   // Return array of checklist objects
//   return Object.values(grouped);
// }
