/**
 * Per-checklist-type configuration for the traffic light and distribution figures.
 * Layout and print symbols follow the robvis conventions (McGuinness & Higgins,
 * 2021); symbols are lucide icon paths (24x24 viewBox) drawn over each cell so
 * figures stay readable in print and greyscale.
 */

export type ChartPalette = 'default' | 'cochrane' | 'greyscale';

export const CHART_PALETTES: Array<{ value: ChartPalette; label: string; description: string }> = [
  { value: 'default', label: 'Default', description: 'CoRATES colors' },
  { value: 'cochrane', label: 'Cochrane', description: 'Palette used by robvis and RevMan' },
  { value: 'greyscale', label: 'Greyscale', description: 'Print-friendly greys' },
];

export interface ChartCategory {
  /** Lowercased key matched against consolidatedAnswers values */
  key: string;
  label: string;
  colors: Record<ChartPalette, string>;
  /** lucide icon path data (24x24 viewBox) drawn inside traffic light cells */
  iconPaths: string[];
}

// lucide-react path data: plus, minus, x, the question mark from circle-help,
// and the exclamation mark from circle-alert
export const ICON_PLUS = ['M5 12h14', 'M12 5v14'];
export const ICON_MINUS = ['M5 12h14'];
export const ICON_X = ['M18 6 6 18', 'm6 6 12 12'];
export const ICON_QUESTION = ['M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'];
export const ICON_EXCLAMATION = ['M12 8v4', 'M12 16h.01'];

export interface ChartColumn {
  /** Key into a checklist's consolidatedAnswers record */
  id: string;
  /** Short label used for traffic light column headers */
  label: string;
  /** Longer label used for distribution rows; falls back to label */
  distributionLabel?: string;
}

export interface ChecklistChartConfig {
  columns: ChartColumn[];
  categories: ChartCategory[];
  /** Left-to-right segment order in the distribution bars */
  stackOrder: string[];
  /** Category assigned to missing/unrecognized values */
  fallbackCategory: string;
  /** Footnote lines rendered under the traffic light plot */
  caption?: string[];
  distributionXAxisLabel: (n: number) => string;
  distributionYAxisLabel?: string;
  distributionMarginLeft?: number;
  distributionRowHeight?: number;
}

// Default palette: green/yellow/red matching the original AMSTAR figures,
// blue for "No information". Cochrane values come from robvis
// (reference/robvis/R/helpers.R get_colour). positiveQualified covers the
// ROBINS-I V2 "Low (except for concerns about uncontrolled confounding)"
// judgement, which has no robvis equivalent; we use a lime between low and
// moderate in both color palettes.
const COLORS = {
  positive: { default: '#10b981', cochrane: '#02C100', greyscale: '#1b1b1b' },
  positiveQualified: { default: '#84cc16', cochrane: '#7CB518', greyscale: '#303030' },
  intermediate: { default: '#facc15', cochrane: '#E2DF07', greyscale: '#484848' },
  // default negative red matches --chart-cat-6 (light theme) used by the rest
  // of the app's charts; critical is the same hue darkened
  negative: { default: '#e34948', cochrane: '#BF0000', greyscale: '#727272' },
  critical: { default: '#932f2f', cochrane: '#820000', greyscale: '#8a8a8a' },
  noInformation: { default: '#3b82f6', cochrane: '#4EA1F7', greyscale: '#a2a2a2' },
  notApplicable: { default: '#9ca3af', cochrane: '#cccccc', greyscale: '#a2a2a2' },
};

export const AMSTAR2_CHART_CONFIG: ChecklistChartConfig = {
  columns: Array.from({ length: 16 }, (_, i) => ({
    id: `q${i + 1}`,
    label: `Q${i + 1}`,
  })),
  categories: [
    {
      key: 'yes',
      label: 'Yes',
      colors: COLORS.positive,
      iconPaths: ICON_PLUS,
    },
    {
      key: 'partial yes',
      label: 'Partial Yes',
      colors: COLORS.intermediate,
      iconPaths: ICON_MINUS,
    },
    {
      key: 'no',
      label: 'No',
      colors: COLORS.negative,
      iconPaths: ICON_X,
    },
    {
      key: 'no ma',
      label: 'No MA',
      colors: COLORS.notApplicable,
      iconPaths: [],
    },
  ],
  stackOrder: ['yes', 'partial yes', 'no ma', 'no'],
  fallbackCategory: 'no ma',
  distributionXAxisLabel: n => `Percentage of SRs (%), N=${n}`,
  distributionYAxisLabel: 'Items of AMSTAR-2',
};

export const ROB2_CHART_CONFIG: ChecklistChartConfig = {
  columns: [
    { id: 'd1', label: 'D1', distributionLabel: 'Bias arising from the randomization process' },
    {
      id: 'd2',
      label: 'D2',
      distributionLabel: 'Bias due to deviations from intended interventions',
    },
    { id: 'd3', label: 'D3', distributionLabel: 'Bias due to missing outcome data' },
    { id: 'd4', label: 'D4', distributionLabel: 'Bias in measurement of the outcome' },
    { id: 'd5', label: 'D5', distributionLabel: 'Bias in selection of the reported result' },
    { id: 'overall', label: 'Overall', distributionLabel: 'Overall risk of bias' },
  ],
  categories: [
    {
      key: 'low',
      label: 'Low',
      colors: COLORS.positive,
      iconPaths: ICON_PLUS,
    },
    {
      key: 'some concerns',
      label: 'Some concerns',
      colors: COLORS.intermediate,
      iconPaths: ICON_MINUS,
    },
    {
      key: 'high',
      label: 'High',
      colors: COLORS.negative,
      iconPaths: ICON_X,
    },
    {
      key: 'no information',
      label: 'No information',
      colors: COLORS.noInformation,
      iconPaths: ICON_QUESTION,
    },
  ],
  stackOrder: ['low', 'some concerns', 'high', 'no information'],
  fallbackCategory: 'no information',
  caption: [
    'Domains:',
    'D1: Bias arising from the randomization process.',
    'D2: Bias due to deviations from intended intervention.',
    'D3: Bias due to missing outcome data.',
    'D4: Bias in measurement of the outcome.',
    'D5: Bias in selection of the reported result.',
  ],
  distributionXAxisLabel: n => `Percentage of studies (%), N=${n}`,
  distributionMarginLeft: 240,
  distributionRowHeight: 40,
};

export const ROBINS_I_CHART_CONFIG: ChecklistChartConfig = {
  columns: [
    { id: 'd1', label: 'D1', distributionLabel: 'Bias due to confounding' },
    { id: 'd2', label: 'D2', distributionLabel: 'Bias in classification of interventions' },
    {
      id: 'd3',
      label: 'D3',
      distributionLabel: 'Bias in selection of participants into the study',
    },
    { id: 'd4', label: 'D4', distributionLabel: 'Bias due to missing data' },
    { id: 'd5', label: 'D5', distributionLabel: 'Bias in measurement of the outcome' },
    { id: 'd6', label: 'D6', distributionLabel: 'Bias in selection of the reported result' },
    { id: 'overall', label: 'Overall', distributionLabel: 'Overall risk of bias' },
  ],
  categories: [
    {
      key: 'low',
      label: 'Low',
      colors: COLORS.positive,
      iconPaths: ICON_PLUS,
    },
    {
      key: 'low (except for concerns about uncontrolled confounding)',
      label: 'Low (confounding concerns)',
      colors: COLORS.positiveQualified,
      iconPaths: ICON_PLUS,
    },
    {
      key: 'moderate',
      label: 'Moderate',
      colors: COLORS.intermediate,
      iconPaths: ICON_MINUS,
    },
    {
      key: 'serious',
      label: 'Serious',
      colors: COLORS.negative,
      iconPaths: ICON_X,
    },
    {
      key: 'critical',
      label: 'Critical',
      colors: COLORS.critical,
      iconPaths: ICON_EXCLAMATION,
    },
    {
      key: 'no information',
      label: 'No information',
      colors: COLORS.noInformation,
      iconPaths: ICON_QUESTION,
    },
  ],
  stackOrder: [
    'low',
    'low (except for concerns about uncontrolled confounding)',
    'moderate',
    'serious',
    'critical',
    'no information',
  ],
  fallbackCategory: 'no information',
  caption: [
    'Domains (ROBINS-I V2):',
    'D1: Bias due to confounding.',
    'D2: Bias in classification of interventions.',
    'D3: Bias in selection of participants into the study (or into the analysis).',
    'D4: Bias due to missing data.',
    'D5: Bias in measurement of the outcome.',
    'D6: Bias in selection of the reported result.',
  ],
  distributionXAxisLabel: n => `Percentage of studies (%), N=${n}`,
  distributionMarginLeft: 240,
  distributionRowHeight: 40,
};

/**
 * Right margin needed to fit the legend: swatch (16) + gap (8) + label text at
 * ~7.5px per character (13px font), plus padding on both sides.
 */
export function legendMarginRight(config: ChecklistChartConfig): number {
  const maxLabelChars = Math.max(...config.categories.map(c => c.label.length));
  return Math.max(120, Math.ceil(maxLabelChars * 7.5) + 70);
}

/**
 * Pick the higher-contrast symbol/text color (black or white) for a given
 * fill, based on perceived luminance.
 */
export function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5 ? '#ffffff' : '#000000';
}
