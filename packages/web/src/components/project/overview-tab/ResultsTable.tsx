/**
 * ResultsTable — styled data table used inside overview table cards.
 */

import { JUDGEMENT_PILLS } from './judgementPills';

export function JudgementPill({ value }: { value: string }) {
  const pill = JUDGEMENT_PILLS[value.toLowerCase()];
  if (!pill) return <span className='text-[13.5px] text-[#98a2b3]'>-</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] leading-none font-medium whitespace-nowrap ${pill.className}`}
    >
      {pill.label}
    </span>
  );
}

interface ResultsTableColumn {
  id: string;
  label: string;
  distributionLabel?: string;
}

interface ResultsTableRow {
  id: string;
  studyName: string;
  values: Record<string, string>;
}

interface ResultsTableProps {
  columns: ResultsTableColumn[];
  rows: ResultsTableRow[];
}

export function ResultsTable({ columns, rows }: ResultsTableProps) {
  return (
    <div className='bg-card overflow-x-auto rounded-xl border border-[#eaecf0]'>
      <table className='min-w-full'>
        <thead className='bg-[#fafbfc]'>
          <tr>
            <th className='px-4 py-[11px] text-left text-[10.5px] font-semibold tracking-[0.07em] text-[#98a2b3] uppercase'>
              Study
            </th>
            {columns.map(column => (
              <th
                key={column.id}
                className='px-4 py-[11px] text-left text-[10.5px] font-semibold tracking-[0.07em] text-[#98a2b3] uppercase'
                title={column.distributionLabel ?? column.label}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className='border-t border-[#f2f4f7] hover:bg-[#fcfcfd]'>
              <td className='px-4 py-3 text-[13.5px] font-normal whitespace-nowrap text-[#101828]'>
                {row.studyName}
              </td>
              {columns.map(column => (
                <td key={column.id} className='px-4 py-3'>
                  <JudgementPill value={row.values[column.id]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
