import { FiBriefcase, FiTarget, FiX } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import type { RoleCard, RoleKind } from '@/services/skill/roleReadiness';

interface RoleReadinessCardProps {
  kind: RoleKind;
  /** Undefined for the assigned slot when no admin has assigned a role yet. */
  card?: RoleCard;
  nameOf: (code: string) => string;
  /** Targets only - the assigned role is an admin's to change. */
  onRemove?: () => void;
  isRemoving?: boolean;
}

/**
 * Readiness for one role: which of its skills the learner holds, and which are still missing.
 *
 * Neither "no role assigned" nor "role cannot be measured" renders a percentage: either as 0% would
 * tell a qualified learner they are unqualified.
 */
interface SkillChipsProps {
  label: string;
  codes: string[];
  nameOf: (code: string) => string;
  tone: 'held' | 'needed';
  testId: string;
}

function SkillChips({ label, codes, nameOf, tone, testId }: SkillChipsProps) {
  if (codes.length === 0) return null;
  const chip =
    tone === 'held' ? 'bg-sunbird-success-message-bg text-sunbird-green-dark' : 'bg-sunbird-ivory text-sunbird-gray-75';
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-sunbird-gray-75">{label}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5" data-testid={testId}>
        {codes.map((code) => (
          <li key={code} className={`rounded-full px-2 py-0.5 text-xs ${chip}`}>
            {nameOf(code)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RoleReadinessCard({ kind, card, nameOf, onRemove, isRemoving }: RoleReadinessCardProps) {
  const { t } = useAppI18n();
  const isAssigned = kind === 'assigned';
  const gap = card?.gap;
  const complete = gap?.measurable && gap.readiness === 100;
  const testId = card ? `role-card-${card.code}` : 'role-card-unassigned';

  return (
    <div className="flex flex-col rounded-xl border border-sunbird-gray-e5 bg-surface p-4" data-testid={testId}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sunbird-ivory text-sunbird-gray-75">
          {isAssigned ? <FiBriefcase className="h-4 w-4" /> : <FiTarget className="h-4 w-4" />}
        </span>
        <span className="text-xs font-medium text-sunbird-gray-75">
          {t(isAssigned ? 'skillProfile.currentRole' : 'skillProfile.targetRole')}
        </span>
        {card?.retired && (
          <span className="rounded-pill bg-sunbird-gray-e5 px-2 py-0.5 text-[0.6875rem] font-medium text-sunbird-gray-75">
            {t('skillProfile.retired')}
          </span>
        )}
        {onRemove && card && (
          <button
            type="button"
            onClick={onRemove}
            disabled={isRemoving}
            aria-label={t('skillProfile.removeTarget', { role: card.name })}
            className="ml-auto rounded-full p-1 text-sunbird-gray-75 hover:bg-sunbird-ivory hover:text-foreground disabled:opacity-50"
            data-testid={`remove-role-${card.code}`}
          >
            <FiX className="h-4 w-4" />
          </button>
        )}
      </div>

      {!card || !gap ? (
        <p className="mt-2 text-sm text-sunbird-gray-75">{t('skillProfile.currentRoleUnset')}</p>
      ) : (
        <>
          <p className="mt-2 truncate text-sm font-semibold text-foreground">{card.name}</p>
          {!gap.measurable ? (
            <p className="mt-2 text-sm text-sunbird-gray-75" data-testid={`${testId}-unmeasurable`}>
              {t('skillProfile.notMeasurable')}
            </p>
          ) : (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-lg font-bold ${complete ? 'text-sunbird-green-dark' : 'text-sunbird-ink'}`}>
                  {gap.readiness}%
                </span>
                <span className="text-xs text-sunbird-gray-75">
                  {t('skillProfile.metOf', { met: gap.met, required: gap.required })}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sunbird-gray-e5">
                <div
                  className={`h-full rounded-full transition-all ${complete ? 'bg-sunbird-success-message' : 'bg-sunbird-brick'}`}
                  style={{ width: `${Math.min(100, Math.max(0, gap.readiness))}%` }}
                />
              </div>
              <SkillChips
                label={t('skillProfile.alreadyHave')}
                codes={gap.held}
                nameOf={nameOf}
                tone="held"
                testId={`${testId}-held`}
              />
              <SkillChips
                label={t('skillProfile.stillNeeded')}
                codes={gap.outstanding}
                nameOf={nameOf}
                tone="needed"
                testId={`${testId}-outstanding`}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
