import { useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { RoleDefinitions } from './competency-role/RoleDefinitions';
import { AssignRoleForm } from './competency-role/AssignRoleForm';

interface CompetencyRoleTabProps {
  /** Frameworks an admin may author and assign roles in. */
  frameworkIds: string[];
}

/**
 * Job roles of a competency framework, in two sections: define the roles (which skills each one
 * requires), then assign one to a learner. Both talk to lern's `role_skill` table, so they share
 * the framework choice.
 */
export function CompetencyRoleTab({ frameworkIds }: CompetencyRoleTabProps) {
  const { t } = useAppI18n();
  const [framework, setFramework] = useState(frameworkIds[0] ?? '');

  return (
    <div className="flex flex-col gap-8" data-testid="competency-role-tab">
      {frameworkIds.length > 1 && (
        <label className="flex flex-col gap-1 text-sm">
          {t('userManagement.competencyRole.framework')}
          <select
            className="rounded-lg border border-sunbird-gray-e5 bg-surface px-3 py-2"
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            data-testid="competency-role-framework"
          >
            {frameworkIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </label>
      )}

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
    </div>
  );
}
