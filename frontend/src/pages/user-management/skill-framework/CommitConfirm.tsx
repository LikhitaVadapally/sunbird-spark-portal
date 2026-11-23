import { useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { Button } from '@/components/common/Button';
import type { TermValidationSummary } from '@/services/CompetencyFrameworkService';

interface CommitConfirmProps {
  summary: TermValidationSummary;
  fileName: string;
  isPending: boolean;
  onCommit: () => void;
}

/**
 * The one chance to catch a mistake before it is irreversible. A term left out of the sheet is
 * not ignored - it is permanently RETIRED, and its code can never be reused. When the commit
 * would retire anything, the admin must tick a box stating the exact count before the commit
 * button enables; when it retires nothing, there is nothing to warn about and it commits directly.
 */
export function CommitConfirm({ summary, fileName, isPending, onCommit }: CommitConfirmProps) {
  const { t } = useAppI18n();
  const [acknowledged, setAcknowledged] = useState(false);
  const retiring = summary.toRetire;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4" data-testid="skill-framework-confirm">
      <h3 className="font-medium">{t('userManagement.skillFramework.confirm.title')}</h3>
      <p className="text-sm">
        {t('userManagement.skillFramework.confirm.changes', {
          file: fileName,
          create: summary.toCreate,
          update: summary.toUpdate,
          retire: retiring,
        })}
      </p>
      {retiring > 0 && (
        <>
          <p className="text-sm text-sunbird-brick font-medium" data-testid="skill-framework-retire-warning">
            {t('userManagement.skillFramework.confirm.retireWarning', { count: retiring })}
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              data-testid="skill-framework-acknowledge"
            />
            {t('userManagement.skillFramework.confirm.acknowledgeRetire', { count: retiring })}
          </label>
        </>
      )}
      <div>
        <Button
          variant={retiring > 0 ? 'destructive' : 'default'}
          disabled={(retiring > 0 && !acknowledged) || isPending}
          onClick={onCommit}
          data-testid="skill-framework-commit"
        >
          {isPending ? t('userManagement.skillFramework.confirm.committing') : t('userManagement.skillFramework.confirm.commit')}
        </Button>
      </div>
    </section>
  );
}
