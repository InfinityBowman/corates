/** Judgment pill styling keyed by lowercased consolidatedAnswers value. */

export const JUDGEMENT_PILLS: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-[#ecfdf3] text-[#067647]' },
  'low (except for concerns about uncontrolled confounding)': {
    label: 'Low (confounding concerns)',
    className: 'bg-[#ecfdf3] text-[#067647]',
  },
  'some concerns': { label: 'Some concerns', className: 'bg-[#fef7c3] text-[#a15c07]' },
  moderate: { label: 'Moderate', className: 'bg-[#fef7c3] text-[#a15c07]' },
  'partial yes': { label: 'Partial yes', className: 'bg-[#fef7c3] text-[#a15c07]' },
  serious: { label: 'Serious', className: 'bg-[#fee4e2] text-[#b42318]' },
  high: { label: 'High', className: 'bg-[#fee4e2] text-[#b42318]' },
  critical: { label: 'Critical', className: 'bg-[#fee4e2] text-[#b42318]' },
  'critically low': { label: 'Critically low', className: 'bg-[#fee4e2] text-[#b42318]' },
  'no information': { label: 'No information', className: 'bg-[#f2f4f7] text-[#667085]' },
};
