import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  RELIABILITY_TOOLS,
  summarizeLevel,
  MIN_PAIRS_FOR_KAPPA,
  type ToolReliability,
} from '@corates/shared/checklists/reliability';
import { ReliabilitySection } from '../ReliabilitySection';

function repeat<T>(value: T, times: number): T[] {
  return Array.from({ length: times }, () => value);
}

function rob2Tool(): ToolReliability {
  const definition = RELIABILITY_TOOLS.ROB2;
  const judgements = summarizeLevel(
    [
      ...repeat({ item: 'domain1', a: 'Low', b: 'Low' }, MIN_PAIRS_FOR_KAPPA),
      ...repeat({ item: 'domain3', a: 'High', b: 'High' }, 4),
      ...repeat({ item: 'domain3', a: 'Low', b: 'High' }, 4),
      { item: 'domain4', a: null, b: 'Low' },
      { item: 'domain4', a: 'NA', b: 'Low' },
    ],
    definition.judgementScale,
    definition.items,
  );
  const overall = summarizeLevel(
    [
      { item: 'overall', a: 'Low', b: 'Low' },
      { item: 'overall', a: 'Low', b: 'High' },
    ],
    definition.overallScale,
    [{ key: 'overall', label: 'Overall', title: 'Overall judgement' }],
  );
  const questions = summarizeLevel(
    [
      ...repeat({ item: 'd1_1', a: 'Y', b: 'Y' }, 9),
      { item: 'd1_2', a: 'Y', b: 'N' },
      { item: 'd3_2', a: 'NA', b: 'Y' },
    ],
    null,
    [],
  );
  return { definition, cells: 8, studies: 6, judgements, overall, questions };
}

describe('ReliabilitySection', () => {
  it('renders one card per tool with agreement, kappa, overall and breakdown', () => {
    render(<ReliabilitySection tools={[rob2Tool()]} dualReviewedStudies={6} />);

    expect(screen.getByRole('heading', { name: 'RoB 2' })).toBeInTheDocument();
    expect(screen.getByText('8 outcomes across 6 studies')).toBeInTheDocument();
    expect(screen.getByText('85.7%')).toBeInTheDocument();
    expect(screen.getByText('24 of 28 matched')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 matched')).toBeInTheDocument();

    const kappaTile = screen.getByText('Weighted kappa').parentElement!;
    expect(kappaTile).toHaveTextContent(/95% CI -?\d\.\d\d to \d\.\d\d/);

    const breakdown = screen.getByRole('list', { name: 'Agreement by item' });
    expect(breakdown).toHaveTextContent('D1100%');
    expect(breakdown).toHaveTextContent('D350%');
    expect(breakdown).not.toHaveTextContent('D4');

    expect(
      screen.getByText(
        'Signaling questions: 90.0% agreement across 10 compared, 1 applicable to one reviewer only',
      ),
    ).toBeInTheDocument();
  });

  it('explains a missing kappa by how many comparisons are still needed', () => {
    const tool = rob2Tool();
    tool.judgements = summarizeLevel(
      [{ item: 'domain1', a: 'Low', b: 'Low' }],
      tool.definition.judgementScale,
      tool.definition.items,
    );
    render(<ReliabilitySection tools={[tool]} dualReviewedStudies={6} />);
    expect(
      screen.getByText(`Needs ${MIN_PAIRS_FOR_KAPPA - 1} more comparisons`),
    ).toBeInTheDocument();
  });

  it('opens a dialog with the tool notes and the confusion matrix', () => {
    render(<ReliabilitySection tools={[rob2Tool()]} dualReviewedStudies={6} />);
    fireEvent.click(screen.getByRole('button', { name: 'How this is calculated' }));

    const dialog = screen.getByRole('dialog', {
      name: 'How reliability is calculated for RoB 2',
    });
    for (const note of RELIABILITY_TOOLS.ROB2.notes) expect(dialog).toHaveTextContent(note);

    const matrix = screen.getByRole('table');
    const rows = matrix.querySelectorAll('tbody tr');
    expect(rows[0]).toHaveTextContent('Low2004');
    expect(rows[2]).toHaveTextContent('High004');
  });

  it('explains what is missing when no reviewer pair has finished yet', () => {
    render(<ReliabilitySection tools={[]} dualReviewedStudies={1} />);

    expect(screen.getByRole('heading', { name: 'Inter-rater reliability' })).toBeInTheDocument();
    expect(screen.getByText(/1 study has two reviewers/)).toBeInTheDocument();
    expect(screen.queryByText(/pooled across reviewer pairs/)).not.toBeInTheDocument();
  });
});
