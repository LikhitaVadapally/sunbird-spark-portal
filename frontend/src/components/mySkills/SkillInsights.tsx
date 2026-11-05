import { FiLayers } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import type { MySkillEntry } from '@/services/skill/mySkills';

interface SkillInsightsProps {
  mostReinforced: MySkillEntry[];
  /** Display name for an entry - insights list names, never codes. */
  nameOf: (entry: MySkillEntry) => string;
  onSelectSkill: (entry: MySkillEntry) => void;
}

/** What a flat skill list can't answer: which skills does my plan reinforce across several paths. */
export function SkillInsights({ mostReinforced, nameOf, onSelectSkill }: SkillInsightsProps) {
  const { t } = useAppI18n();

  if (mostReinforced.length === 0) return null;

  return (
    <div className="flex flex-col gap-4" data-testid="skill-insights">
      {mostReinforced.length > 0 && (
        <section className="rounded-2xl border border-sunbird-gray-e5 bg-surface p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-wider text-sunbird-gray-75">
            <FiLayers className="h-3.5 w-3.5" />
            {t('mySkills.mostReinforced')}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {mostReinforced.map((entry) => (
              <li key={entry.code} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectSkill(entry)}
                  className="truncate text-left text-sm font-medium text-foreground hover:underline"
                >
                  {nameOf(entry)}
                </button>
                <span className="shrink-0 rounded-pill bg-sunbird-ivory px-2 py-0.5 text-xs font-medium text-sunbird-brick">
                  {t('mySkills.pathCount', { count: entry.paths.length })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
