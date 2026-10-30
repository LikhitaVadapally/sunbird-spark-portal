import { useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { Button } from '@/components/common/Button';
import {
  useCommitTermSheet,
  useDownloadTermSheet,
  usePublishCompetencyFramework,
  useValidateTermSheet,
} from '@/hooks/useCompetencyFrameworkAdmin';
import { buildBlankTermSheet } from '@/services/CompetencyFrameworkService';
import { TermSheetReport } from './TermSheetReport';
import { CommitConfirm } from './CommitConfirm';
import { describeFrameworkError } from './frameworkErrors';

interface TermSheetWorkflowProps {
  frameworkId: string;
  /** Blocked statuses (Review/Processing) get a banner; the server rejects the upload anyway. */
  editBlocked: boolean;
}

const stepTitle = 'font-medium text-sm';

const saveBlankTemplate = (frameworkId: string) => {
  const blob = new Blob([buildBlankTermSheet()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${frameworkId}-skills.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Steps 2-8: download -> (edit offline) -> upload -> validate (dry run) -> confirm -> commit -> publish.
 *
 * Skills only. Roles are not authored here yet: a role is a term in a "role" category whose
 * Associated Terms list the skills it requires. When that design lands, this is where the one
 * rule Knowlg does not enforce belongs - every role association must point at a LEAF skill, not
 * a grouping node - checked on the validate report before the commit is offered.
 */
export function TermSheetWorkflow({ frameworkId, editBlocked }: TermSheetWorkflowProps) {
  const { t } = useAppI18n();
  const download = useDownloadTermSheet();
  const validate = useValidateTermSheet();
  const commit = useCommitTermSheet();
  const publish = usePublishCompetencyFramework();
  const [file, setFile] = useState<File | null>(null);

  const report = validate.data;
  const committed = commit.data?.committed === true;

  const chooseFile = (next: File | null) => {
    // A new file invalidates every result computed from the old one.
    setFile(next);
    validate.reset();
    commit.reset();
    publish.reset();
  };

  const runValidate = () => {
    if (!file) return;
    commit.reset();
    validate.mutate({ frameworkId, file });
  };

  return (
    <div className="flex flex-col gap-6" data-testid="skill-framework-workflow">
      {editBlocked && (
        <p className="rounded-lg border border-sunbird-brick p-3 text-sm text-sunbird-brick" role="alert" data-testid="skill-framework-blocked">
          {t('userManagement.skillFramework.errors.editBlocked')}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h3 className={stepTitle}>{t('userManagement.skillFramework.steps.download')}</h3>
        <p className="text-sm text-sunbird-gray-75">{t('userManagement.skillFramework.downloadHint')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={download.isPending} onClick={() => download.mutate(frameworkId)} data-testid="skill-framework-download">
            {download.isPending ? t('userManagement.skillFramework.preparing') : t('userManagement.skillFramework.downloadCurrent')}
          </Button>
          <Button variant="outline" onClick={() => saveBlankTemplate(frameworkId)} data-testid="skill-framework-template">
            {t('userManagement.skillFramework.downloadTemplate')}
          </Button>
        </div>
        {/* The CSV lives in cloud storage; a link (not window.open after an await) avoids popup blockers. */}
        {download.data && (
          <a className="text-sm underline text-sunbird-theme-accent" href={download.data} target="_blank" rel="noopener noreferrer" data-testid="skill-framework-download-link">
            {t('userManagement.skillFramework.downloadReady')}
          </a>
        )}
        {download.error && <p className="text-sm text-sunbird-brick" role="alert">{describeFrameworkError(download.error, t)}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={stepTitle}>{t('userManagement.skillFramework.steps.upload')}</h3>
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-sm"
          onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
          data-testid="skill-framework-file"
        />
        <div>
          <Button disabled={!file || editBlocked || validate.isPending} onClick={runValidate} data-testid="skill-framework-validate">
            {validate.isPending ? t('userManagement.skillFramework.validating') : t('userManagement.skillFramework.validate')}
          </Button>
        </div>
        {validate.error && <p className="text-sm text-sunbird-brick" role="alert" data-testid="skill-framework-validate-error">{describeFrameworkError(validate.error, t)}</p>}
      </section>

      {report && (
        <section className="flex flex-col gap-3">
          <h3 className={stepTitle}>{t('userManagement.skillFramework.steps.review')}</h3>
          <p className={`text-sm ${report.valid ? 'text-sunbird-gray-75' : 'text-sunbird-brick'}`} data-testid="skill-framework-validity">
            {report.valid ? t('userManagement.skillFramework.validNoWrites') : t('userManagement.skillFramework.invalid')}
          </p>
          <TermSheetReport
            testId="skill-framework-report"
            counts={[
              ['toCreate', report.summary.toCreate],
              ['toUpdate', report.summary.toUpdate],
              ['toRetire', report.summary.toRetire],
              ['errors', report.summary.errors],
            ]}
            rows={report.rows ?? []}
            fileWarnings={report.fileWarnings}
          />
          {report.valid && file && !committed && (
            <CommitConfirm
              key={`${file.name}-${file.lastModified}`}
              summary={report.summary}
              fileName={file.name}
              isPending={commit.isPending}
              onCommit={() => commit.mutate({ frameworkId, file })}
            />
          )}
        </section>
      )}

      {commit.error && <p className="text-sm text-sunbird-brick" role="alert">{describeFrameworkError(commit.error, t)}</p>}
      {commit.data && (
        <section className="flex flex-col gap-3" data-testid="skill-framework-commit-result">
          <h3 className={stepTitle}>{t('userManagement.skillFramework.steps.commit')}</h3>
          <p className={`text-sm ${committed ? 'text-sunbird-success-green' : 'text-sunbird-brick'}`}>
            {committed
              ? t('userManagement.skillFramework.committed')
              : commit.data.errCode === 'ERR_COMMIT_FAILED' || commit.data.errCode === 'ERR_ASSOCIATE_FAILED'
                ? t('userManagement.skillFramework.commitPartial')
                : t('userManagement.skillFramework.commitRejected')}
          </p>
          <TermSheetReport
            testId="skill-framework-commit-report"
            counts={committed
              ? [['created', commit.data.summary.created], ['updated', commit.data.summary.updated], ['retired', commit.data.summary.retired]]
              : [['errors', commit.data.summary.errors], ['warnings', commit.data.summary.warnings]]}
            rows={commit.data.rows ?? []}
            fileWarnings={commit.data.fileWarnings}
          />
        </section>
      )}

      {committed && (
        <section className="flex flex-col gap-2">
          <h3 className={stepTitle}>{t('userManagement.skillFramework.steps.publish')}</h3>
          {/* Review/reject (POST /competency-framework/v3/review|reject/:id) is skipped for now:
              publish works straight from Draft. Insert the review hand-off here once a reviewer flow exists. */}
          <div>
            <Button disabled={publish.isPending || publish.isSuccess} onClick={() => publish.mutate(frameworkId)} data-testid="skill-framework-publish">
              {publish.isPending ? t('userManagement.skillFramework.publishing') : t('userManagement.skillFramework.publish')}
            </Button>
          </div>
          {publish.isSuccess && <p className="text-sm text-sunbird-success-green" data-testid="skill-framework-published">{t('userManagement.skillFramework.published')}</p>}
          {publish.error && <p className="text-sm text-sunbird-brick" role="alert">{describeFrameworkError(publish.error, t)}</p>}
        </section>
      )}
    </div>
  );
}
