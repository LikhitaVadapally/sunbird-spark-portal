import { FiClock, FiLayers } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import type { MySkillEntry } from '@/services/skill/mySkills';

interface SkillInsightsProps {
  recentlyGained: MySkillEntry[];
  mostReinforced: MySkillEntry[];
  /** Display name for an entry - insights list names, never codes. */
  nameOf: (entry: MySkillEntry) => string;
  onSelectSkill: (entry: MySkillEntry) => void;
}

function relativeDay(timestamp: number | undefined, t: (key: string, params?: Record<string, unknown>) => string) {
  if (timestamp === undefined) return '';
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return t('mySkills.today');
  if (days === 1) return t('mySkills.yesterday');
  return t('mySkills.daysAgo', { count: days });
}

/**
 * The two questions a flat skill list can't answer: what did I earn most
 * recently, and which skills does my plan reinforce across several paths.
 */
export function SkillInsights({ recentlyGained, mostReinforced, nameOf, onSelectSkill }: SkillInsightsProps) {
  const { t } = useAppI18n();

  if (recentlyGained.length === 0 && mostReinforced.length === 0) return null;

  return (
    <div className="flex flex-col gap-4" data-testid="skill-insights">
      {recentlyGained.length > 0 && (
        <section className="rounded-2xl border border-sunbird-gray-e5 bg-surface p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-wider text-sunbird-gray-75">
            <FiClock className="h-3.5 w-3.5" />
            {t('mySkills.recentlyGained')}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {recentlyGained.map((entry) => (
              <li key={entry.code}>
                <button
                  type="button"
                  onClick={() => onSelectSkill(entry)}
                  className="flex w-full items-baseline justify-between gap-2 text-left"
                >
                  <span className="truncate text-sm font-medium text-sunbird-green-dark hover:underline">
                    {nameOf(entry)}
                  </span>
                  <span className="shrink-0 text-xs text-sunbird-gray-75">{relativeDay(entry.gainedAt, t)}</span>
                </button>
                {entry.source && (
                  <span className="block truncate text-xs text-sunbird-gray-75">
                    {t(`mySkills.source.${entry.source}`)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
