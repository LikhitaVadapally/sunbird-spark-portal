import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { getContentDetailPath } from '@/utils/getContentDetailPath';
import type { SkillSuggestion } from '@/hooks/useSkillSuggestions';

interface SkillSuggestionRowProps {
  suggestions: SkillSuggestion[];
  /** Display name for a skill code. */
  nameOf: (code: string) => string;
}

const CHIP_PREVIEW_COUNT = 3;

/** A static skill chip — display only, unlike the interactive `SkillTag` used elsewhere on this page. */
function SkillChip({ skill }: { skill: string }) {
  return (
    <span className="whitespace-nowrap rounded-pill border border-dashed border-sunbird-gray-d0 px-2.5 py-0.5 text-xs font-medium text-sunbird-gray-75">
      {skill}
    </span>
  );
}

function SuggestionCard({ suggestion, nameOf }: { suggestion: SkillSuggestion; nameOf: (code: string) => string }) {
  const { t } = useAppI18n();
  const { pathId, pathName, contextId, source, progressPct, newSkills } = suggestion;
  const previewSkills = newSkills.slice(0, CHIP_PREVIEW_COUNT);
  const extraCount = newSkills.length - previewSkills.length;

  return (
    <Link
      to={getContentDetailPath(pathId, 'Learning Path', contextId)}
      className="flex w-64 shrink-0 snap-start flex-col gap-3 rounded-xl border border-sunbird-gray-e5 bg-surface p-4 shadow-sm transition-shadow hover:shadow-sunbird-sm"
      data-testid={`skill-suggestion-card-${source}`}
    >
      <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-sunbird-brick">
        {source === 'enrolled' ? t('mySkills.sourceEnrolled') : t('mySkills.sourceDiscover')}
      </span>

      <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{pathName}</h3>

      <div className="flex flex-wrap gap-1.5">
        {previewSkills.map((skill) => (
          <SkillChip key={skill} skill={nameOf(skill)} />
        ))}
        {extraCount > 0 && (
          <span className="whitespace-nowrap text-xs font-medium text-sunbird-gray-75">
            {t('mySkills.moreSkills', { count: extraCount })}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-xs text-sunbird-gray-75">{t('mySkills.newSkillCount', { count: newSkills.length })}</span>
        {source === 'enrolled' && (
          <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-pill bg-sunbird-gray-e5">
            <div className="h-full rounded-pill bg-sunbird-brick" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * "Skills you could gain next" — a horizontal row of Learning Paths, ranked
 * by how many not-yet-gained skills each would add. Draws from both
 * enrolled-incomplete paths and unenrolled Live paths.
 */
export function SkillSuggestionRow({ suggestions, nameOf }: SkillSuggestionRowProps) {
  const { t } = useAppI18n();

  if (suggestions.length === 0) return null;

  return (
    <section className="rounded-2xl border border-sunbird-gray-e5 bg-surface p-4 shadow-sm" data-testid="skill-suggestion-row">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{t('mySkills.suggestionsTitle')}</h2>
        <Link
          to="/explore"
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-sunbird-brick hover:underline"
        >
          {t('mySkills.viewAll')}
          <FiArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mb-3 text-xs text-sunbird-gray-75">{t('mySkills.suggestionsSubtitle')}</p>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
        {suggestions.map((suggestion) => (
          <SuggestionCard key={`${suggestion.source}-${suggestion.pathId}`} suggestion={suggestion} nameOf={nameOf} />
        ))}
      </div>
    </section>
  );
}
