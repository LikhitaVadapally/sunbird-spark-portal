import { useMemo, useState } from 'react';
import { FiArrowRight } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { useToast } from '@/hooks/useToast';
import { useSkillFrameworks, useSkillLabels, useSkillProfile } from '@/hooks/useSkillProfile';
import { useSkillGap, useSkillRecommend, useUpdateTargetRoles } from '@/hooks/useRoleReadiness';
import { addableRoles, buildRoleCards, pickRoleFramework } from '@/services/skill/roleReadiness';
import { RolePicker } from '@/components/skillProfile/RolePicker';
import { NextStepsList } from '@/components/skillProfile/NextStepsList';
import { RoleReadinessCard } from './RoleReadinessCard';
import { AddTargetRole } from './AddTargetRole';
import type { SkillLabel } from '@/services/skill';

/** One row holds this many cards on a wide screen; past that the row scrolls and "View all" appears. */
const ROW_CARDS = 3;

interface RoleReadinessSectionProps {
  labelOf: (code: string, frameworkId?: string) => SkillLabel;
  className?: string;
}

/**
 * How ready the learner is for the role an admin assigned them and the roles they aim for, and
 * what to take next to close the gap.
 *
 * Hidden when there is nothing to say: no assigned role, no targets, and no live role to aim at.
 */
export function RoleReadinessSection({ labelOf, className = '' }: RoleReadinessSectionProps) {
  const { t } = useAppI18n();
  const { toast } = useToast();
  const { skills } = useSkillProfile();
  const { gap, isLoading, isError, refetch } = useSkillGap();

  const frameworkId = pickRoleFramework(gap?.frameworkId ?? '', skills);
  const { metas } = useSkillFrameworks(frameworkId ? [frameworkId] : []);
  const meta = frameworkId ? metas[frameworkId] : undefined;

  const cards = useMemo(() => buildRoleCards(gap, meta), [gap, meta]);
  const assigned = cards.find((c) => c.kind === 'assigned');
  const targets = cards.filter((c) => c.kind === 'target');
  const addable = addableRoles(meta, gap);
  const roleName = (code: string) => meta?.roleNames[code] ?? code;
  // The page's names cover only frameworks the learner already has skills or paths in; a role's
  // framework may be neither, so its names are loaded here and tried first.
  const { labelOf: roleLabelOf } = useSkillLabels(frameworkId ? [frameworkId] : []);
  const nameOf = (code: string) => {
    const own = roleLabelOf(code, frameworkId);
    return own.resolved ? own.name : labelOf(code, frameworkId).name;
  };

  // Next steps only make sense for a role with something still to earn.
  const actionable = cards
    .filter((c) => c.gap.measurable && c.gap.outstanding.length > 0)
    .map((c) => c.code);
  const [selected, setSelected] = useState<string>();
  const [showAll, setShowAll] = useState(false);
  const activeRole = selected && actionable.includes(selected) ? selected : actionable[0];
  const { recommendation } = useSkillRecommend(frameworkId, activeRole);

  const update = useUpdateTargetRoles(frameworkId, gap);
  const change = (c: { add?: string; remove?: string }) =>
    update.mutate(c, {
      onError: () => toast({ title: t('skillProfile.saveError'), variant: 'destructive' }),
    });

  if (isLoading) return null;
  if (isError) {
    return (
      <div
        className={`${className} flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sunbird-gray-e5 bg-surface px-4 py-3`}
        role="alert"
        data-testid="role-readiness-error"
      >
        <span className="text-sm text-foreground">{t('skillProfile.loadError')}</span>
        <button
          type="button"
          onClick={refetch}
          className="text-sm font-medium text-sunbird-brick hover:underline"
        >
          {t('retry')}
        </button>
      </div>
    );
  }
  if (cards.length === 0 && addable.length === 0) return null;

  return (
    <section
      className={`${className} flex flex-col gap-4 rounded-2xl border border-sunbird-gray-e5 bg-surface p-5`}
      data-testid="role-readiness"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('skillProfile.rolesTitle')}
          </h2>
          <p className="mt-0.5 text-sm text-sunbird-gray-75">{t('skillProfile.rolesSubtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          {1 + targets.length > ROW_CARDS && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="flex shrink-0 items-center gap-1 text-sm font-medium text-sunbird-brick hover:underline"
              data-testid="role-cards-toggle"
            >
              {showAll ? t('viewLess') : t('mySkills.viewAll')}
              {!showAll && <FiArrowRight className="h-3.5 w-3.5" />}
            </button>
          )}
          <AddTargetRole
            roles={addable}
            roleName={roleName}
            onAdd={(code) => change({ add: code })}
            disabled={update.isPending}
          />
        </div>
      </div>

      {/* Same scrolling row as "Skills you could gain next"; "View all" opens it into a grid. */}
      <div
        className={
          showAll
            ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'
            : 'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [&>*]:w-[85%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[calc((100%_-_0.75rem)/2)] xl:[&>*]:w-[calc((100%_-_1.5rem)/3)]'
        }
        data-testid="role-cards"
      >
        <RoleReadinessCard
          kind="assigned"
          {...(assigned ? { card: assigned } : {})}
          nameOf={nameOf}
        />
        {targets.map((card) => (
          <RoleReadinessCard
            key={card.code}
            kind="target"
            card={card}
            nameOf={nameOf}
            onRemove={() => change({ remove: card.code })}
            isRemoving={update.isPending}
          />
        ))}
      </div>
      {targets.length === 0 && (
        <p className="text-sm text-sunbird-gray-75" data-testid="role-readiness-no-targets">
          {t('skillProfile.targetRoleUnset')}
        </p>
      )}

      {activeRole && recommendation && recommendation.candidates.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-sunbird-gray-e5 pt-4">
          {actionable.length > 1 && (
            <RolePicker
              roles={actionable}
              selected={activeRole}
              roleName={roleName}
              onSelect={setSelected}
              label={t('skillProfile.nextStepsChoose')}
            />
          )}
          <NextStepsList candidates={recommendation.candidates} roleName={roleName(activeRole)} />
        </div>
      )}
    </section>
  );
}
