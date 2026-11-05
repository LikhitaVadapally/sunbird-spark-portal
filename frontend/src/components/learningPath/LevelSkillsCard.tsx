import { useAppI18n } from '@/hooks/useAppI18n';
import type { PathSkill } from '@/services/learningPath/pathSkillStatus';

interface LevelSkillsCardProps {
  /** Competency leaf codes for this level. */
  codes: string[];
  /** Per-skill state, when the learner is enrolled. Same gained/pending rule as My Skills. */
  stateOf?: (code: string) => PathSkill | undefined;
  name: (code: string) => string;
}

const DOT: Record<PathSkill['state'], string> = {
  held: 'bg-sunbird-green',
  pending: 'bg-sunbird-gray-e5',
};

/**
 * "Skills in this level" rail card.
 *
 * The right-hand label used to read "In scope" for every skill, which is true from the day the
 * path is published and tells a learner nothing: mastered and never-opened looked identical. It
 * now reports gained/pending by the My Skills rule, falling back to "In scope" only when there is
 * no state to show - an unenrolled visitor, or a finished course's skill the profile has not
 * recorded (neither gained nor pending).
 */
export function LevelSkillsCard({ codes, stateOf, name }: LevelSkillsCardProps) {
  const { t } = useAppI18n();

  const label = (s: PathSkill | undefined) => {
    if (!s) return t('learningPath.inScope');
    return s.state === 'held' ? t('learningPath.skillHeld') : t('learningPath.skillPending');
  };

  return (
    <div className="rounded-xl border border-sunbird-gray-e5 bg-surface p-5 shadow-sm">
      <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-sunbird-gray-75">
        {t('learningPath.skillsInThisLevel')}
      </span>
      <div className="mt-2 flex flex-col">
        {codes.length === 0 && (
          <p className="py-2.5 text-sm text-sunbird-gray-75">{t('learningPath.noSkillsYet')}</p>
        )}
        {codes.map((code) => {
          const s = stateOf?.(code);
          return (
            <div
              key={code}
              data-testid={`level-skill-${code}`}
              className="flex items-center justify-between gap-2.5 border-t border-sunbird-gray-e5 py-2.5 first:border-t-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                {s && <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[s.state]}`} aria-hidden="true" />}
                <span className="truncate text-sm text-foreground">{name(code)}</span>
              </span>
              <span
                className={`shrink-0 text-[0.6875rem] ${
                  s?.state === 'held' ? 'text-sunbird-green' : 'text-sunbird-gray-75'
                }`}
              >
                {label(s)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-sunbird-gray-82">{t('learningPath.skillScopeNote')}</p>
    </div>
  );
}
