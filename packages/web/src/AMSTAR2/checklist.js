import { AMSTAR_CHECKLIST } from './checklist-map.js';

/**
 * Creates a new AMSTAR2 checklist object with default empty answers for all questions.
 *
 * @param {Object} options - Checklist properties.
 * @param {string} options.name - The checklist name (required).
 * @param {string} options.id - Unique checklist ID (required).
 * @param {number} [options.createdAt=Date.now()] - Timestamp of checklist creation.
 * @param {string} [options.reviewerName=''] - Name of the reviewer.
 *
 * @returns {Object} A checklist object with all AMSTAR2 questions initialized to default answers.
 *
 * @throws {Error} If `id` or `name` is missing or not a non-empty string.
 *
 * Example:
 *   createChecklist({ name: 'My Checklist', id: 'chk-123', reviewerName: 'Alice' });
 */
export function createChecklist({
  name = null,
  id = null,
  createdAt = Date.now(),
  reviewerName = '',
}) {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('AMSTAR2Checklist requires a non-empty string id.');
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('AMSTAR2Checklist requires a non-empty string name.');
  }

  let d = new Date(createdAt);
  if (Number.isNaN(d)) d = Date.now();
  // Pad month and day
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  createdAt = `${d.getFullYear()}-${mm}-${dd}`;

  return {
    name: name,
    reviewerName: reviewerName || '',
    createdAt: createdAt,
    id: id,
    q1: { answers: [[false, false, false, false], [false], [false, false]], critical: false },
    q2: {
      answers: [
        [false, false, false, false],
        [false, false, false],
        [false, false, false],
      ],
      critical: true,
    },
    q3: {
      answers: [
        [false, false, false],
        [false, false],
      ],
      critical: false,
    },
    q4: {
      answers: [
        [false, false, false],
        [false, false, false, false, false],
        [false, false, false],
      ],
      critical: true,
    },
    q5: {
      answers: [
        [false, false],
        [false, false],
      ],
      critical: false,
    },
    q6: {
      answers: [
        [false, false],
        [false, false],
      ],
      critical: false,
    },
    q7: { answers: [[false], [false], [false, false, false]], critical: true },
    q8: {
      answers: [
        [false, false, false, false, false],
        [false, false, false, false],
        [false, false, false],
      ],
      critical: false,
    },
    q9a: {
      answers: [
        [false, false],
        [false, false],
        [false, false, false, false],
      ],
      critical: true,
    },
    q9b: {
      answers: [
        [false, false],
        [false, false],
        [false, false, false, false],
      ],
      critical: true,
    },
    q10: { answers: [[false], [false, false]], critical: false },
    q11a: {
      answers: [
        [false, false, false],
        [false, false, false],
      ],
      critical: true,
    },
    q11b: {
      answers: [
        [false, false, false, false],
        [false, false, false],
      ],
      critical: true,
    },
    q12: {
      answers: [
        [false, false],
        [false, false, false],
      ],
      critical: false,
    },
    q13: {
      answers: [
        [false, false],
        [false, false],
      ],
      critical: true,
    },
    q14: {
      answers: [
        [false, false],
        [false, false],
      ],
      critical: false,
    },
    q15: { answers: [[false], [false, false, false]], critical: true },
    q16: {
      answers: [
        [false, false],
        [false, false],
      ],
      critical: false,
    },
  };
}

// Score checklist using the last column of each question taking into account critical vs non-critical
export function scoreChecklist(state) {
  if (!state || typeof state !== 'object') return 'Error';

  let criticalFlaws = 0;
  let nonCriticalFlaws = 0;

  // Partial yes is scored same as yes
  // No MA is not counted as a flaw

  for (const [question, obj] of Object.entries(state)) {
    if (!/^q\d+[a-z]*$/i.test(question)) continue;
    if (!obj || !Array.isArray(obj.answers)) continue;
    const selected = getSelectedAnswer(obj.answers, question);
    if (!selected || selected === 'No') {
      if (obj.critical) {
        criticalFlaws++;
      } else {
        nonCriticalFlaws++;
      }
    }
  }

  if (criticalFlaws > 1) return 'Critically Low';
  if (criticalFlaws === 1) return 'Low';
  if (nonCriticalFlaws > 1) return 'Moderate';
  return 'High';
}

// Helper to get the selected answer from the last column of a question
function getSelectedAnswer(answers, question) {
  // Question patterns
  const customPatternQuestions = ['q11a', 'q11b', 'q12', 'q15'];
  const customLabels = ['Yes', 'No', 'No MA'];
  const defaultLabels = ['Yes', 'Partial Yes', 'No', 'No MA'];

  if (!Array.isArray(answers) || answers.length === 0) return null;
  const lastCol = answers.at(-1);
  if (!Array.isArray(lastCol)) return null;
  const idx = lastCol.indexOf(true);
  if (idx === -1) return null;
  if (customPatternQuestions.includes(question)) return customLabels[idx] || null;
  if (lastCol.length === 2) return idx === 0 ? 'Yes' : 'No';
  if (lastCol.length >= 3) return defaultLabels[idx] || null;
  return null;
}

export function getAnswers(checklist) {
  if (!checklist || typeof checklist !== 'object') return null;
  const result = {};

  for (const [key, value] of Object.entries(checklist)) {
    if (!/^q\d+[a-z]*$/i.test(key)) continue;
    if (!value || !Array.isArray(value.answers)) continue;

    const selected = getSelectedAnswer(value.answers, key);
    result[key] = selected;
  }

  // Consolidate q9a and q9b into q9 by taking the lower score
  if ('q9a' in result && 'q9b' in result) {
    if (result.q9a === null || result.q9b === null) {
      result.q9 = null;
    } else if (result.q9a === 'No' || result.q9b === 'No') {
      result.q9 = 'No';
    } else if (result.q9a === 'No MA' && result.q9b === 'No MA') {
      result.q9 = 'No MA';
    } else {
      result.q9 = 'Yes';
    }
  }
  delete result.q9a;
  delete result.q9b;

  // Consolidate q11a and q11b into q11 by taking the lower score
  if ('q11a' in result && 'q11b' in result) {
    if (result.q11a === null || result.q11b === null) {
      result.q11 = null;
    } else if (result.q11a === 'No' || result.q11b === 'No') {
      result.q11 = 'No';
    } else if (result.q11a === 'No MA' && result.q11b === 'No MA') {
      result.q11 = 'No MA';
    } else {
      result.q11 = 'Yes';
    }
  }
  delete result.q11a;
  delete result.q11b;

  return result;
}

/**
 * Export a checklist (or array of checklists) to CSV using the checklist map for headers.
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
    // 'Created At',
    // 'Checklist ID',
    'Question',
    'Question Text',
    'Column Label',
    'Option Text',
    'Selected',
    'Selected Answer',
  ];

  const rows = [];

  for (const cl of list) {
    for (const q of questionKeys) {
      const question = AMSTAR_CHECKLIST[q];
      const questionText = question?.text || q;
      const columns = question?.columns || [];
      const answers = cl[q]?.answers || [];
      const critical = cl[q]?.critical || false;
      const selectedAnswer = getSelectedAnswer(answers, q) || '';

      for (const [colIdx, col] of columns.entries()) {
        const colLabel = col.label || '';
        const options = col.options || [];
        const ansArray = answers[colIdx] || [];
        for (const [optIdx, optText] of options.entries()) {
          const selected = ansArray[optIdx] === true ? 'TRUE' : 'FALSE';
          rows.push([
            cl.name || '',
            cl.reviewerName || '',
            // cl.createdAt ? new Date(cl.createdAt).toISOString() : '',
            // cl.id || '',
            critical,
            q,
            questionText,
            colLabel,
            optText,
            selected,
            selectedAnswer,
          ]);
        }
      }
    }
  }

  // CSV encode
  const escapeCsv = val => `"${String(val).replaceAll('"', '""').replaceAll('\n', ' ')}"`;
  const csv =
    headers.map(escapeCsv).join(',') +
    '\n' +
    rows.map(row => row.map(escapeCsv).join(',')).join('\n');
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
