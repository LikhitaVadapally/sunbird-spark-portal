import { useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { Button } from '@/components/common/Button';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useRetireCompetencyFramework } from '@/hooks/useCompetencyFrameworkAdmin';
import {
  FRAMEWORK_EDIT_BLOCKED_STATUSES,
  FRAMEWORK_STATUS,
  SKILL_FRAMEWORK_CATEGORIES,
  type CompetencyFrameworkDetails,
} from '@/services/CompetencyFrameworkService';
import { FrameworkPicker } from './skill-framework/FrameworkPicker';
import { TermSheetWorkflow } from './skill-framework/TermSheetWorkflow';
import { frameworkStatusLabel } from './skill-framework/frameworkStatus';
import { frameworkLevelsOf } from './skill-framework/frameworkLevels';
import { describeFrameworkError } from './skill-framework/frameworkErrors';

interface SkillFrameworkTabProps {
  /** The admin's root-org channel; a new framework belongs to it. */
  channel: string;
  orgName?: string;
}

/**
 * Create or update a competency (skill) framework from a CSV:
 * pick -> download -> edit offline -> upload -> validate (dry run) -> confirm -> commit -> publish.
 *
 * Lives under User Management because, like platform roles, it is an admin taxonomy setting and
 * not authoring content - and a commit can permanently retire skills, a far bigger blast radius
 * than anything a content creator can do. The page is ORG_ADMIN-only (AppRoutes), and the
 * backend repeats that check on every write route it proxies.
 */
export function SkillFrameworkTab({ channel, orgName }: SkillFrameworkTabProps) {
  const { t } = useAppI18n();
  const [selected, setSelected] = useState<{ framework: CompetencyFrameworkDetails; isNew: boolean } | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const retire = useRetireCompetencyFramework();

  const choose = (next: typeof selected) => {
    retire.reset();
    setSelected(next);
  };

  if (!selected) {
    return (
      <div className="flex flex-col gap-4" data-testid="skill-framework-tab">
        <p className="text-sm text-sunbird-gray-75">{t('userManagement.skillFramework.intro')}</p>
        <FrameworkPicker
          channel={channel}
          orgName={orgName}
          onSelected={(framework, isNew) => choose({ framework, isNew })}
        />
      </div>
    );
  }

  const { framework, isNew } = selected;
  const status = framework.status ?? '';
  // The Category values a sheet may use: the framework's attached levels, else the ones a new framework gets.
  const attached = frameworkLevelsOf(framework).map((l) => l.code);
  const categoryCodes = attached.length ? attached : SKILL_FRAMEWORK_CATEGORIES.map((c) => c.code);
  // Nothing to export yet - just created, or opened later with no terms - so only the template is offered.
  const hasSkills = (framework.categories ?? []).some((c) => (c.terms?.length ?? 0) > 0);
  const isEmpty = isNew || !hasSkills;

  return (
    <div className="flex flex-col gap-4" data-testid="skill-framework-tab">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium" data-testid="skill-framework-selected">
            {framework.name ? `${framework.name} (${framework.identifier})` : framework.identifier}
          </h2>
          {status && (
            <p className="text-xs text-sunbird-gray-75">{t('userManagement.skillFramework.status', { status: frameworkStatusLabel(status, t) })}</p>
          )}
        </div>
        <div className="flex gap-2">
          {/* Draft only: a Live framework's skills are already on content, so retiring it would orphan them. */}
          {status === FRAMEWORK_STATUS.draft && (
            <Button variant="outline" size="sm" disabled={retire.isPending} onClick={() => setConfirmRetire(true)} data-testid="skill-framework-retire">
              {retire.isPending ? t('userManagement.skillFramework.retiring') : t('userManagement.skillFramework.retire')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => choose(null)} data-testid="skill-framework-change">
            {t('userManagement.skillFramework.change')}
          </Button>
        </div>
      </div>
      {retire.error && (
        <p className="text-sm text-sunbird-brick" role="alert" data-testid="skill-framework-retire-error">{describeFrameworkError(retire.error, t)}</p>
      )}
      <ConfirmDialog
        open={confirmRetire}
        onClose={() => setConfirmRetire(false)}
        onConfirm={() => {
          setConfirmRetire(false);
          retire.mutate(framework.identifier, { onSuccess: () => setSelected(null) });
        }}
        title={t('userManagement.skillFramework.retireTitle', { name: framework.name || framework.identifier })}
        description={t('userManagement.skillFramework.retireDescription')}
        confirmLabel={t('userManagement.skillFramework.retire')}
        confirmVariant="destructive"
        confirmButtonProps={{ 'data-testid': 'skill-framework-retire-confirm' }}
      />
      {isEmpty && (
        <p className="text-sm text-sunbird-gray-75" data-testid="skill-framework-new-hint">
          {t('userManagement.skillFramework.newHint', { categories: categoryCodes.join(', ') })}
        </p>
      )}
      {!isNew && (framework.categories?.length ?? 0) === 0 && (
        <p className="rounded-lg border border-sunbird-brick p-3 text-sm text-sunbird-brick" role="alert" data-testid="skill-framework-no-categories">
          {t('userManagement.skillFramework.noCategories')}
        </p>
      )}
      <TermSheetWorkflow
        key={framework.identifier}
        frameworkId={framework.identifier}
        isEmpty={isEmpty}
        categoryCodes={categoryCodes}
        editBlocked={FRAMEWORK_EDIT_BLOCKED_STATUSES.includes(status)}
      />
    </div>
  );
}
