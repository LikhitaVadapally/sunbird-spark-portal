import { useAppI18n } from '@/hooks/useAppI18n';
import type { TermIssue, TermRowOutcome } from '@/services/CompetencyFrameworkService';

interface TermSheetReportProps {
  /** Summary counts to show, in order; keys are i18n suffixes under skillFramework.summary. */
  counts: Array<[string, number | undefined]>;
  rows: TermRowOutcome[];
  fileWarnings?: TermIssue[];
  testId: string;
}

const isFailed = (row: TermRowOutcome) => row.status === 'FAILED' || Boolean(row.errCode);

/**
 * Per-row outcome of a validate or commit. Knowlg only returns rows that carry an error or a
 * warning, so an empty table means every row was clean. Errors are listed first: they block the
 * commit, warnings do not.
 */
export function TermSheetReport({ counts, rows, fileWarnings = [], testId }: TermSheetReportProps) {
  const { t } = useAppI18n();
  const sorted = [...rows].sort((a, b) => Number(isFailed(b)) - Number(isFailed(a)) || a.index - b.index);

  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {counts.map(([key, value]) => (
          <div key={key} className="rounded-lg border border-border px-3 py-2">
            <dt className="text-sunbird-gray-75">{t(`userManagement.skillFramework.summary.${key}`)}</dt>
            <dd className="text-lg font-semibold" data-testid={`${testId}-${key}`}>{value ?? 0}</dd>
          </div>
        ))}
      </dl>

      {fileWarnings.length > 0 && (
        <ul className="text-sm text-sunbird-gray-75 list-disc ps-5" data-testid={`${testId}-file-warnings`}>
          {fileWarnings.map((w, i) => <li key={`${w.code}-${i}`}>{w.msg}</li>)}
        </ul>
      )}

      {sorted.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-sunbird-gray-75">
                <th className="py-1 pe-3">{t('userManagement.skillFramework.report.row')}</th>
                <th className="py-1 pe-3">{t('userManagement.skillFramework.report.term')}</th>
                <th className="py-1 pe-3">{t('userManagement.skillFramework.report.action')}</th>
                <th className="py-1">{t('userManagement.skillFramework.report.details')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.index} className="border-t border-border align-top" data-testid={`${testId}-row`}>
                  {/* index counts non-blank data rows from 0, so this is the data row number with blank rows skipped */}
                  <td className="py-1 pe-3">{row.index + 1}</td>
                  <td className="py-1 pe-3 font-mono">{`${row.category}:${row.code}`}</td>
                  <td className="py-1 pe-3">{t(`userManagement.skillFramework.report.${row.rowType === 'update' ? 'update' : 'create'}`)}</td>
                  <td className="py-1">
                    {isFailed(row) && (
                      <p className="text-sunbird-brick">{row.errMsg || row.errCode}</p>
                    )}
                    {(row.warnings ?? []).map((w, i) => (
                      <p key={`${w.code}-${i}`} className="text-sunbird-gray-75">{w.msg}</p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
