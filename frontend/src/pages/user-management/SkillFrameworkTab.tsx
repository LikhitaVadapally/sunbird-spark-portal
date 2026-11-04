import { useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { Button } from '@/components/common/Button';
import {
  FRAMEWORK_EDIT_BLOCKED_STATUSES,
  SKILL_FRAMEWORK_CATEGORIES,
  type CompetencyFrameworkDetails,
} from '@/services/CompetencyFrameworkService';
import { FrameworkPicker } from './skill-framework/FrameworkPicker';
import { TermSheetWorkflow } from './skill-framework/TermSheetWorkflow';

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

  if (!selected) {
    return (
      <div className="flex flex-col gap-4" data-testid="skill-framework-tab">
        <p className="text-sm text-sunbird-gray-75">{t('userManagement.skillFramework.intro')}</p>
        <FrameworkPicker
          channel={channel}
          orgName={orgName}
          onSelected={(framework, isNew) => setSelected({ framework, isNew })}
        />
      </div>
    );
  }

  const { framework, isNew } = selected;
  const status = framework.status ?? '';
  // The Category values a sheet may use: the framework's attached levels, else the ones a new framework gets.
  const attached = (framework.categories ?? []).map((c) => c.code).filter((c): c is string => Boolean(c));
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
            <p className="text-xs text-sunbird-gray-75">{t('userManagement.skillFramework.status', { status })}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setSelected(null)} data-testid="skill-framework-change">
          {t('userManagement.skillFramework.change')}
        </Button>
      </div>
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
        editBlocked={FRAMEWORK_EDIT_BLOCKED_STATUSES.includes(status)}
      />
    </div>
  );
}
