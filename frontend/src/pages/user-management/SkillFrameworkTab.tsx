import { useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { Button } from '@/components/common/Button';
import {
  FRAMEWORK_EDIT_BLOCKED_STATUSES,
  type CompetencyFrameworkDetails,
} from '@/services/CompetencyFrameworkService';
import { FrameworkPicker } from './skill-framework/FrameworkPicker';
import { TermSheetWorkflow } from './skill-framework/TermSheetWorkflow';

interface SkillFrameworkTabProps {
  /** Frameworks the deployment is configured with, offered first in the picker. */
  frameworkIds: string[];
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
export function SkillFrameworkTab({ frameworkIds, channel, orgName }: SkillFrameworkTabProps) {
  const { t } = useAppI18n();
  const [selected, setSelected] = useState<{ framework: CompetencyFrameworkDetails; isNew: boolean } | null>(null);

  if (!selected) {
    return (
      <div className="flex flex-col gap-4" data-testid="skill-framework-tab">
        <p className="text-sm text-sunbird-gray-75">{t('userManagement.skillFramework.intro')}</p>
        <FrameworkPicker
          configuredIds={frameworkIds}
          channel={channel}
          orgName={orgName}
          onSelected={(framework, isNew) => setSelected({ framework, isNew })}
        />
      </div>
    );
  }

  const { framework, isNew } = selected;
  const status = framework.status ?? '';

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
      {isNew && <p className="text-sm text-sunbird-gray-75">{t('userManagement.skillFramework.newHint')}</p>}
      <TermSheetWorkflow
        key={framework.identifier}
        frameworkId={framework.identifier}
        editBlocked={FRAMEWORK_EDIT_BLOCKED_STATUSES.includes(status)}
      />
    </div>
  );
}
