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
 * not ignored - it is permanently RETIRED, and its code can never be reused - so the admin has
 * to tick a box that states the exact retire count before the commit button enables.
 */
export function CommitConfirm({ summary, fileName, isPending, onCommit }: CommitConfirmProps) {
  const { t } = useAppI18n();
  const [acknowledged, setAcknowledged] = useState(false);
  const retiring = summary.toRetire ?? 0;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4" data-testid="skill-framework-confirm">
      <h3 className="font-medium">{t('userManagement.skillFramework.confirm.title')}</h3>
      <p className="text-sm">
        {t('userManagement.skillFramework.confirm.changes', {
          file: fileName,
          create: summary.toCreate ?? 0,
          update: summary.toUpdate ?? 0,
          retire: retiring,
        })}
      </p>
      <p
        className={`text-sm ${retiring > 0 ? 'text-sunbird-brick font-medium' : 'text-sunbird-gray-75'}`}
        data-testid="skill-framework-retire-warning"
      >
        {t('userManagement.skillFramework.confirm.retireRule')}
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          data-testid="skill-framework-acknowledge"
        />
        {retiring > 0
          ? t('userManagement.skillFramework.confirm.acknowledgeRetire', { count: retiring })
          : t('userManagement.skillFramework.confirm.acknowledgeNoRetire')}
      </label>
      <div>
        <Button
          variant={retiring > 0 ? 'destructive' : 'default'}
          disabled={!acknowledged || isPending}
          onClick={onCommit}
          data-testid="skill-framework-commit"
        >
          {isPending ? t('userManagement.skillFramework.confirm.committing') : t('userManagement.skillFramework.confirm.commit')}
        </Button>
      </div>
    </section>
  );
}
