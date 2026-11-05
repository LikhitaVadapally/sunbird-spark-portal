import { FiX } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { SkillTag } from './SkillTag';

interface SkillCelebrationPanelProps {
  /** Skill codes: the path's gained + pending skills. */
  allSkills: string[];
  /** Codes held from any source (skill profile). */
  gainedSkills: ReadonlySet<string>;
  /** Display name for a code. */
  nameOf: (code: string) => string;
  selectedSkill: string | null;
  onSelectSkill: (skill: string) => void;
  onClearSkill: () => void;
}

/** The path-level skill board: every scoped skill as an interactive tag, gained ones celebrated. */
export function SkillCelebrationPanel({
  allSkills,
  gainedSkills,
  nameOf,
  selectedSkill,
  onSelectSkill,
  onClearSkill,
}: SkillCelebrationPanelProps) {
  const { t } = useAppI18n();
  const gained = allSkills.filter((skill) => gainedSkills.has(skill));
  const pending = allSkills.filter((skill) => !gainedSkills.has(skill));

  if (allSkills.length === 0) {
    return (
      <div className="rounded-2xl border border-sunbird-gray-e5 bg-surface p-6 text-center text-sm text-sunbird-gray-75">
        {t('learningPath.noSkillsYet')}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sunbird-gray-e5 bg-surface p-5 shadow-sm" data-testid="skill-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-sunbird-gray-75">
          {t('learningPath.allScopedSkills')}
        </span>
        {selectedSkill ? (
          <button
            type="button"
            onClick={onClearSkill}
            className="flex items-center gap-1 rounded-pill bg-sunbird-brick/10 px-2.5 py-1 text-xs font-medium text-sunbird-brick"
            data-testid="skill-filter-clear"
          >
            {t('learningPath.showingSkill', { skill: nameOf(selectedSkill) })}
            <FiX className="h-3 w-3" />
          </button>
        ) : (
          <span className="text-xs text-sunbird-gray-75">{t('learningPath.tapSkillHint')}</span>
        )}
      </div>

      {gained.length > 0 && (
        <div className="mt-4">
          <span className="mb-2 block text-xs font-medium text-sunbird-green-dark">
            {t('learningPath.skillsGainedCount', { gained: gained.length, total: allSkills.length })}
          </span>
          <div className="flex flex-wrap gap-2">
            {gained.map((skill, i) => (
              <SkillTag
                key={skill}
                skill={skill}
                label={nameOf(skill)}
                gained
                index={i}
                selected={selectedSkill === skill}
                dimmed={!!selectedSkill && selectedSkill !== skill}
                onSelect={onSelectSkill}
              />
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-4 border-t border-dashed border-sunbird-gray-e5 pt-4">
          <span className="mb-2 block text-xs font-medium text-sunbird-gray-75">
            {t('learningPath.skillsPendingCount', { count: pending.length })}
          </span>
          <div className="flex flex-wrap gap-2">
            {pending.map((skill, i) => (
              <SkillTag
                key={skill}
                skill={skill}
                label={nameOf(skill)}
                gained={false}
                index={i}
                selected={selectedSkill === skill}
                dimmed={!!selectedSkill && selectedSkill !== skill}
                onSelect={onSelectSkill}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
