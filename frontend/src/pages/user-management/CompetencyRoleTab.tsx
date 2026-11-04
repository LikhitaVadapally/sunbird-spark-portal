import { useEffect } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { useCompetencyFrameworkOptions } from '@/hooks/useCompetencyFrameworkAdmin';
import { FrameworkSelect } from './skill-framework/FrameworkSelect';
import { RoleDefinitions } from './competency-role/RoleDefinitions';
import { AssignRoleForm } from './competency-role/AssignRoleForm';

interface CompetencyRoleTabProps {
  /** The admin's root-org channel; only that org's frameworks are offered. */
  channel: string;
  /** Chosen framework, held by the page so switching tabs keeps it. '' until one is chosen. */
  frameworkId: string;
  onFrameworkChange: (id: string) => void;
}

/**
 * Job roles of a competency framework, in two sections: define the roles (which skills each one
 * requires), then assign one to a learner. Both talk to lern's `role_skill` table, so they share
 * the framework choice.
 */
export function CompetencyRoleTab({ channel, frameworkId: framework, onFrameworkChange }: CompetencyRoleTabProps) {
  const { t } = useAppI18n();
  // An org can have several frameworks. Roles are built from a framework's published skills,
  // so a Draft one is listed but can't be picked yet.
  const options = useCompetencyFrameworkOptions(channel);
  const live = options.filter((o) => o.status === 'Live');
  const onlyLiveId = live.length === 1 ? live[0]?.id : undefined;

  useEffect(() => {
    if (!framework && onlyLiveId) onFrameworkChange(onlyLiveId);
  }, [framework, onlyLiveId, onFrameworkChange]);

  return (
    <div className="flex flex-col gap-8" data-testid="competency-role-tab">
      <div className="flex flex-col gap-1 text-sm">
        <span id="competency-role-framework-label">{t('userManagement.competencyRole.framework')}</span>
        <FrameworkSelect
          options={options}
          value={framework}
          onChange={onFrameworkChange}
          placeholder={t('userManagement.competencyRole.chooseFramework')}
          labelledBy="competency-role-framework-label"
          testId="competency-role-framework"
          disabledReason={(o) => (o.status === 'Live' ? undefined : t('userManagement.competencyRole.publishFirst'))}
        />
      </div>

      {!framework ? (
        <p className="text-sm text-sunbird-gray-75" data-testid="competency-role-choose-hint">
          {t('userManagement.competencyRole.chooseFrameworkHint')}
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-4" aria-labelledby="competency-roles-heading">
            <h2 id="competency-roles-heading" className="text-lg font-semibold font-rubik">
              {t('userManagement.competencyRole.roles.heading')}
            </h2>
            <RoleDefinitions frameworkId={framework} />
          </section>

          <section
            className="flex flex-col gap-4 border-t border-sunbird-gray-e5 pt-6"
            aria-labelledby="competency-assign-heading"
          >
            <h2 id="competency-assign-heading" className="text-lg font-semibold font-rubik">
              {t('userManagement.competencyRole.assignHeading')}
            </h2>
            {/* keyed so switching framework clears the half-filled form */}
            <AssignRoleForm key={framework} frameworkId={framework} />
          </section>
        </>
      )}
    </div>
  );
}
