import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StudyInfo, ChecklistEntry } from '@/stores/projectStore';
import { amstar2, rob2, robinsI } from '@corates/shared';

type ROB2Domain = (typeof rob2.ROB2_CHECKLIST)[keyof typeof rob2.ROB2_CHECKLIST];
type ROB2Question = ROB2Domain['questions'][string];
type ROBINSDomain = typeof robinsI.DOMAIN_1A;
type ROBINSQuestion = NonNullable<ROBINSDomain['questions']>[string];

interface ExportOptions {
  studies: StudyInfo[];
  projectName?: string;
}

const MARGIN = 14;
const PAGE_BOTTOM_MARGIN = 20;

type RGB = [number, number, number];

const COLORS = {
  primary: [59, 130, 246] as RGB,
  sectionBg: [241, 245, 249] as RGB,
  judgmentColors: {
    Low: [220, 252, 231] as RGB,
    Moderate: [254, 249, 195] as RGB,
    High: [254, 226, 226] as RGB,
    'Critically Low': [254, 226, 226] as RGB,
    'Some concerns': [254, 249, 195] as RGB,
    Serious: [255, 237, 213] as RGB,
    Critical: [254, 226, 226] as RGB,
  } as Record<string, RGB>,
};

function ensureSpace(doc: jsPDF, needed: number, currentY: number): number {
  if (currentY + needed > doc.internal.pageSize.getHeight() - PAGE_BOTTOM_MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return currentY;
}

function drawSectionHeader(doc: jsPDF, text: string, y: number): number {
  y = ensureSpace(doc, 12, y);
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGIN, y, pageWidth - MARGIN * 2, 8, 'F');
  doc.setFontSize(10);
  doc.setTextColor(255);
  doc.text(text, MARGIN + 3, y + 5.5);
  doc.setTextColor(0);
  return y + 10;
}

function drawSubsectionHeader(doc: jsPDF, text: string, y: number): number {
  y = ensureSpace(doc, 10, y);
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.sectionBg);
  doc.rect(MARGIN, y, pageWidth - MARGIN * 2, 7, 'F');
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(text, MARGIN + 3, y + 5);
  doc.setTextColor(0);
  return y + 9;
}

function drawJudgmentBadge(doc: jsPDF, label: string, value: string, y: number): number {
  y = ensureSpace(doc, 10, y);
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(label, MARGIN + 3, y + 5);

  if (value) {
    const color = COLORS.judgmentColors[value];
    const labelWidth = doc.getTextWidth(label);
    const badgeX = MARGIN + 6 + labelWidth;
    const badgeWidth = doc.getTextWidth(value) + 6;
    if (color) {
      doc.setFillColor(...color);
      doc.roundedRect(badgeX, y, badgeWidth, 7, 1.5, 1.5, 'F');
    }
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.text(value, badgeX + 3, y + 5);
  }

  doc.setTextColor(0);
  return y + 9;
}

function drawTextField(doc: jsPDF, label: string, value: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - MARGIN * 2 - 6;

  doc.setFontSize(8);
  const valueLines = value ? doc.splitTextToSize(value, maxWidth) : ['--'];
  const needed = 12 + valueLines.length * 4;
  y = ensureSpace(doc, needed, y);

  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(label, MARGIN + 3, y + 5);
  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.text(valueLines, MARGIN + 3, y + 10);

  return y + 12 + (valueLines.length - 1) * 4;
}

// --- AMSTAR2 ---

function renderAmstar2(doc: jsPDF, cl: ChecklistEntry, studyName: string, y: number): number {
  y = drawSectionHeader(doc, `AMSTAR 2 | ${studyName}`, y);

  if (cl.score) {
    y = drawJudgmentBadge(doc, 'Overall Confidence:', cl.score, y);
    y += 2;
  }

  const schema = amstar2.AMSTAR_CHECKLIST;
  const raw = cl.answers as Record<string, { answers?: boolean[][] }> | null;
  const criticalSet = new Set(amstar2.AMSTAR2_CRITICAL_QUESTIONS);

  const DATA_KEY_LABELS: Record<string, string> = {
    q9a: 'Q9 (RCTs)',
    q9b: 'Q9 (NRSI)',
    q11a: 'Q11 (RCTs)',
    q11b: 'Q11 (NRSI)',
  };

  for (const dataKey of amstar2.AMSTAR2_DATA_KEYS) {
    let schemaKey: string;
    let useColumns2 = false;

    if (dataKey === 'q9b' || dataKey === 'q11b') {
      schemaKey = dataKey.slice(0, -1);
      useColumns2 = true;
    } else if (dataKey === 'q9a' || dataKey === 'q11a') {
      schemaKey = dataKey.slice(0, -1);
    } else {
      schemaKey = dataKey;
    }

    const question = schema[schemaKey];
    if (!question) continue;

    const qLabel = DATA_KEY_LABELS[dataKey] || dataKey.toUpperCase();
    const isCritical = criticalSet.has(dataKey);
    const headerText = `${qLabel}${isCritical ? ' [Critical]' : ''}`;

    const columns = useColumns2 ? question.columns2 || question.columns : question.columns;
    const answerGrid = raw?.[dataKey]?.answers;

    const verdict = amstar2.getSelectedAnswer(answerGrid ?? [], dataKey)?.trim() || '--';

    const rows: string[][] = [];
    for (let colIdx = 0; colIdx < columns.length - 1; colIdx++) {
      const col = columns[colIdx];
      if (col.label) {
        rows.push([col.label, '']);
      }
      for (let optIdx = 0; optIdx < col.options.length; optIdx++) {
        const checked = answerGrid?.[colIdx]?.[optIdx] ? '[x]' : '[ ]';
        rows.push([`  ${checked}  ${col.options[optIdx].trim()}`, '']);
      }
    }
    rows.push(['Verdict:', verdict]);

    y = ensureSpace(doc, 14, y);
    doc.setFontSize(8);
    doc.setTextColor(60);
    doc.text(headerText, MARGIN + 3, y + 4);
    doc.setTextColor(0);
    y += 5;

    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    const questionTextLines = doc.splitTextToSize(question.text, pageWidth - MARGIN * 2 - 6);
    y = ensureSpace(doc, questionTextLines.length * 3.5 + 2, y);
    doc.text(questionTextLines, MARGIN + 3, y + 3);
    y += questionTextLines.length * 3.5 + 2;

    autoTable(doc, {
      startY: y,
      body: rows,
      showHead: false,
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 30 } },
      didParseCell(data) {
        if (data.section === 'body') {
          const text = String(data.cell.raw);
          if (text === 'Verdict:') {
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 1 && data.row.index === rows.length - 1) {
            const color = COLORS.judgmentColors[text];
            if (color) data.cell.styles.fillColor = color;
          }
        }
      },
      margin: { left: MARGIN, right: MARGIN },
    });

    y = (doc as any).lastAutoTable.finalY + 4;
  }

  return y;
}

// --- ROB2 ---

type ROB2Answers = Record<string, unknown>;

function renderRob2Preliminary(doc: jsPDF, answers: ROB2Answers, y: number): number {
  const prelim = answers.preliminary as Record<string, unknown> | undefined;
  if (!prelim) return y;

  y = drawSubsectionHeader(doc, 'Preliminary Information', y);

  const fields: [string, string][] = [
    ['Study design:', String(prelim.studyDesign || '--')],
    ['Experimental intervention:', String(prelim.experimental || '--')],
    ['Comparator:', String(prelim.comparator || '--')],
    ['Numerical result:', String(prelim.numericalResult || '--')],
    [
      'Aim:',
      prelim.aim === 'ADHERING' ?
        'Effect of adhering to intervention (per-protocol effect)'
      : 'Effect of assignment to intervention (intention-to-treat effect)',
    ],
  ];

  for (const [label, value] of fields) {
    y = drawTextField(doc, label, value, y);
  }

  const sources = prelim.sources as Record<string, boolean> | undefined;
  if (sources) {
    y = ensureSpace(doc, 10, y);
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text('Information sources:', MARGIN + 3, y + 5);
    doc.setTextColor(0);
    y += 7;
    for (const source of rob2.INFORMATION_SOURCES) {
      const checked = sources[source] ? '[x]' : '[ ]';
      y = ensureSpace(doc, 5, y);
      doc.setFontSize(7);
      doc.text(`  ${checked}  ${source}`, MARGIN + 3, y + 3);
      y += 4;
    }
    y += 2;
  }

  return y;
}

function renderSignallingQuestions(
  doc: jsPDF,
  questions: Record<string, ROB2Question | ROBINSQuestion>,
  domainAnswers: Record<string, { answer?: string | null; comment?: string }> | undefined,
  responseLabels: Record<string, string>,
  y: number,
): number {
  const rows: string[][] = [];
  for (const q of Object.values(questions)) {
    const answer = domainAnswers?.[q.id];
    const responseLabel = answer?.answer ? responseLabels[answer.answer] || answer.answer : '--';
    rows.push([q.number || '', q.text, responseLabel]);
  }

  if (rows.length === 0) return y;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Signalling question', 'Response']],
    body: rows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: COLORS.sectionBg, textColor: [60, 60, 60], fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 35 },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  return (doc as any).lastAutoTable.finalY + 2;
}

function renderRob2Domain(
  doc: jsPDF,
  domain: ROB2Domain,
  answers: ROB2Answers,
  domainKey: string,
  y: number,
): number {
  const title = domain.subtitle ? `${domain.name} | ${domain.subtitle}` : domain.name;
  y = drawSubsectionHeader(doc, title, y);

  const domainState = answers[domainKey] as
    | {
        answers?: Record<string, { answer?: string | null; comment?: string }>;
        judgement?: string | null;
        direction?: string | null;
      }
    | undefined;

  y = renderSignallingQuestions(
    doc,
    domain.questions,
    domainState?.answers,
    rob2.RESPONSE_LABELS,
    y,
  );

  if (domainState?.judgement) {
    y = drawJudgmentBadge(doc, 'Judgment:', domainState.judgement, y);
  }
  if (domainState?.direction) {
    y = ensureSpace(doc, 6, y);
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`Direction: ${domainState.direction}`, MARGIN + 3, y + 4);
    doc.setTextColor(0);
    y += 6;
  }

  return y + 2;
}

function renderRob2(doc: jsPDF, cl: ChecklistEntry, studyName: string, y: number): number {
  y = drawSectionHeader(doc, `RoB 2 | ${studyName}`, y);

  const answers = (cl.answers || {}) as ROB2Answers;
  const prelim = answers.preliminary as { aim?: string } | undefined;
  const isAdhering = prelim?.aim === 'ADHERING';

  y = renderRob2Preliminary(doc, answers, y);

  const activeDomains = rob2.getActiveDomainKeys(isAdhering);
  for (const domainKey of activeDomains) {
    const domain = rob2.ROB2_CHECKLIST[domainKey as keyof typeof rob2.ROB2_CHECKLIST];
    y = renderRob2Domain(doc, domain, answers, domainKey, y);
  }

  const overall = answers.overall as
    { judgement?: string | null; direction?: string | null } | undefined;
  y = drawSubsectionHeader(doc, 'Overall Risk of Bias', y);
  if (overall?.judgement) {
    y = drawJudgmentBadge(doc, 'Judgment:', overall.judgement, y);
  }
  if (overall?.direction) {
    y = ensureSpace(doc, 6, y);
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`Direction: ${overall.direction}`, MARGIN + 3, y + 4);
    doc.setTextColor(0);
    y += 6;
  }

  return y + 4;
}

// --- ROBINS-I ---

type ROBINSIAnswers = Record<string, unknown>;

function renderRobinsiSections(doc: jsPDF, answers: ROBINSIAnswers, y: number): number {
  const planning = answers.planning as { confoundingFactors?: string } | undefined;
  if (planning?.confoundingFactors) {
    y = drawSubsectionHeader(doc, 'Planning: Confounding Factors', y);
    y = drawTextField(doc, 'P1:', planning.confoundingFactors, y);
  }

  const sectionA = answers.sectionA as Record<string, string> | undefined;
  if (sectionA) {
    y = drawSubsectionHeader(doc, 'Section A: Specify the result being assessed', y);
    y = drawTextField(doc, 'A1 - Numerical result:', sectionA.numericalResult || '', y);
    if (sectionA.furtherDetails) {
      y = drawTextField(doc, 'A2 - Further details:', sectionA.furtherDetails, y);
    }
    y = drawTextField(doc, 'A3 - Outcome:', sectionA.outcome || '', y);
  }

  const sectionB = answers.sectionB as
    | {
        b1?: { answer?: string };
        b2?: { answer?: string };
        b3?: { answer?: string };
        stopAssessment?: boolean;
      }
    | undefined;
  if (sectionB) {
    y = drawSubsectionHeader(doc, 'Section B: Decide whether to proceed', y);
    const bQuestions = robinsI.SECTION_B;
    const bRows: string[][] = [];
    for (const [key, q] of Object.entries(bQuestions)) {
      const ans = (sectionB as Record<string, { answer?: string }>)[key];
      const label = ans?.answer ? robinsI.RESPONSE_LABELS[ans.answer] || ans.answer : '--';
      bRows.push([key.toUpperCase(), q.text, label]);
    }

    autoTable(doc, {
      startY: y,
      head: [['#', 'Question', 'Response']],
      body: bRows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: COLORS.sectionBg, textColor: [60, 60, 60], fontSize: 7 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 35 } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    if (sectionB.stopAssessment) {
      y = drawJudgmentBadge(doc, 'Assessment stopped:', 'Critical', y);
      return y;
    }
  }

  const sectionC = answers.sectionC as Record<string, unknown> | undefined;
  if (sectionC) {
    y = drawSubsectionHeader(doc, 'Section C: Target trial specification', y);
    y = drawTextField(doc, 'C1 - Participants:', String(sectionC.participants || ''), y);
    y = drawTextField(
      doc,
      'C2 - Intervention strategy:',
      String(sectionC.interventionStrategy || ''),
      y,
    );
    y = drawTextField(
      doc,
      'C3 - Comparator strategy:',
      String(sectionC.comparatorStrategy || ''),
      y,
    );
    const isPerProtocol = sectionC.isPerProtocol as boolean;
    y = drawTextField(
      doc,
      'C4 - Analysis type:',
      isPerProtocol ? 'Per-protocol effect' : 'Intention-to-treat effect',
      y,
    );
  }

  return y;
}

function renderRobinsiDomain(
  doc: jsPDF,
  domain: ROBINSDomain,
  answers: ROBINSIAnswers,
  domainKey: string,
  y: number,
): number {
  const title = domain.subtitle ? `${domain.name} | ${domain.subtitle}` : domain.name;
  y = drawSubsectionHeader(doc, title, y);

  const domainState = answers[domainKey] as
    | {
        answers?: Record<string, { answer?: string | null; comment?: string }>;
        judgement?: string | null;
        direction?: string | null;
      }
    | undefined;

  if (domain.subsections) {
    for (const sub of Object.values(domain.subsections)) {
      const subsection = sub as { name: string; questions: Record<string, ROBINSQuestion> };
      y = ensureSpace(doc, 8, y);
      doc.setFontSize(8);
      doc.setTextColor(80);
      doc.text(subsection.name, MARGIN + 3, y + 4);
      doc.setTextColor(0);
      y += 6;
      y = renderSignallingQuestions(
        doc,
        subsection.questions,
        domainState?.answers,
        robinsI.RESPONSE_LABELS,
        y,
      );
    }
  } else if (domain.questions) {
    y = renderSignallingQuestions(
      doc,
      domain.questions,
      domainState?.answers,
      robinsI.RESPONSE_LABELS,
      y,
    );
  }

  if (domainState?.judgement) {
    y = drawJudgmentBadge(doc, 'Judgment:', domainState.judgement, y);
  }
  if (domainState?.direction) {
    y = ensureSpace(doc, 6, y);
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`Direction: ${domainState.direction}`, MARGIN + 3, y + 4);
    doc.setTextColor(0);
    y += 6;
  }

  return y + 2;
}

function renderRobinsI(doc: jsPDF, cl: ChecklistEntry, studyName: string, y: number): number {
  y = drawSectionHeader(doc, `ROBINS-I V2 | ${studyName}`, y);

  const answers = (cl.answers || {}) as ROBINSIAnswers;

  y = renderRobinsiSections(doc, answers, y);

  const sectionC = answers.sectionC as { isPerProtocol?: boolean } | undefined;
  const isPerProtocol = sectionC?.isPerProtocol ?? false;

  const activeDomains = robinsI.getActiveDomainKeys(isPerProtocol);
  for (const domainKey of activeDomains) {
    const domain = robinsI.ROBINS_I_CHECKLIST[
      domainKey as keyof typeof robinsI.ROBINS_I_CHECKLIST
    ] as ROBINSDomain;
    y = renderRobinsiDomain(doc, domain, answers, domainKey, y);
  }

  y = drawSubsectionHeader(doc, 'Section D: Information sources', y);
  const sectionD = answers.sectionD as
    { sources?: Record<string, boolean>; otherSpecify?: string } | undefined;
  if (sectionD?.sources) {
    for (const source of robinsI.INFORMATION_SOURCES) {
      const checked = sectionD.sources[source] ? '[x]' : '[ ]';
      y = ensureSpace(doc, 5, y);
      doc.setFontSize(7);
      doc.text(`  ${checked}  ${source}`, MARGIN + 3, y + 3);
      y += 4;
    }
    if (sectionD.otherSpecify) {
      y = drawTextField(doc, 'Other:', sectionD.otherSpecify, y);
    }
    y += 2;
  }

  const overall = answers.overall as
    { judgement?: string | null; direction?: string | null } | undefined;
  y = drawSubsectionHeader(doc, 'Overall Risk of Bias', y);
  if (overall?.judgement) {
    y = drawJudgmentBadge(doc, 'Judgment:', overall.judgement, y);
  }
  if (overall?.direction) {
    y = ensureSpace(doc, 6, y);
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`Direction: ${overall.direction}`, MARGIN + 3, y + 4);
    doc.setTextColor(0);
    y += 6;
  }

  return y + 4;
}

// --- Main ---

export function buildProjectPdf({ studies, projectName }: ExportOptions): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const title = projectName || 'CoRATES Appraisal Report';
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  doc.setFontSize(18);
  doc.text(title, MARGIN, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(date, MARGIN, 28);
  doc.setTextColor(0);

  const checklistsWithStudies = studies.flatMap(study =>
    study.checklists.map(cl => ({ study, cl })),
  );

  if (checklistsWithStudies.length === 0) {
    doc.setFontSize(12);
    doc.text('No appraisals to export.', MARGIN, 45);
    return doc;
  }

  let y = 35;

  for (let i = 0; i < checklistsWithStudies.length; i++) {
    const { study, cl } = checklistsWithStudies[i];
    const studyName = study.name || study.originalTitle || 'Untitled';

    if (i > 0) {
      doc.addPage();
      y = MARGIN;
    }

    switch (cl.type) {
      case 'AMSTAR2':
        y = renderAmstar2(doc, cl, studyName, y);
        break;
      case 'ROB2':
        y = renderRob2(doc, cl, studyName, y);
        break;
      case 'ROBINS_I':
        y = renderRobinsI(doc, cl, studyName, y);
        break;
    }
  }

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(150);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text('Generated by CoRATES', MARGIN, doc.internal.pageSize.getHeight() - 8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - MARGIN,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    );
  }

  return doc;
}

export function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
