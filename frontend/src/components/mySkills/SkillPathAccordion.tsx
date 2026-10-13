import { Link, useLocation } from 'react-router-dom';
import { FiArrowRight, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { SkillTag } from '@/components/learningPath/status/SkillTag';
import { getLearningPathStatusPath } from '@/utils/getContentDetailPath';
import { splitPathSkills } from '@/services/learningPath/skillAggregation';
import type { PathSkillSummary, PathSkillStatus } from '@/services/learningPath/skillAggregation';

interface SkillPathAccordionProps {
  pathName: string;
  summary?: PathSkillSummary;
  /** Codes held from any source - so this card counts exactly what My Skills counts. */
  heldCodes: ReadonlySet<string>;
  nameOf: (code: string, frameworkId?: string) => string;
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

const STATUS_TONE: Record<PathSkillStatus, string> = {
  completed: 'bg-sunbird-success-message-bg text-sunbird-green-dark',
  ongoing: 'bg-sunbird-ivory text-sunbird-brick',
  'not-started': 'bg-sunbird-gray-e5 text-sunbird-gray-75',
};

/** One enrolled Learning Path: a collapsed summary row that expands into its gained/pending skills. */
export function SkillPathAccordion({
  pathName,
  summary,
  heldCodes,
  nameOf,
  isLoading,
  isExpanded,
  onToggle,
}: SkillPathAccordionProps) {
  const { t } = useAppI18n();
  const location = useLocation();

  if (isLoading || !summary) {
    return (
      <div
        className="animate-pulse rounded-2xl border border-sunbird-gray-e5 bg-surface p-4"
        data-testid="skill-path-skeleton"
      >
        <div className="h-4 w-1/3 rounded bg-sunbird-gray-e5" />
        <div className="mt-3 h-2 w-full rounded-pill bg-sunbird-gray-e5" />
      </div>
    );
  }

  const statusLabel: Record<PathSkillStatus, string> = {
    completed: t('status.completed'),
    ongoing: t('status.ongoing'),
    'not-started': t('status.notStarted'),
  };

  const { gained, pending } = splitPathSkills(summary, heldCodes);
  const total = gained.length + pending.length;
  const label = (code: string) => nameOf(code, summary.frameworkId);

  return (
    <div className="rounded-2xl border border-sunbird-gray-e5 bg-surface shadow-sm" data-testid="skill-path-accordion">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full flex-col gap-2 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{pathName}</h3>
            <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[0.6875rem] font-medium ${STATUS_TONE[summary.status]}`}>
              {statusLabel[summary.status]}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 w-32 max-w-[8rem] overflow-hidden rounded-pill bg-sunbird-gray-e5">
              <div
                className="h-full rounded-pill bg-sunbird-brick transition-all duration-500"
                style={{ width: `${summary.progressPct}%` }}
              />
            </div>
            <span className="text-xs text-sunbird-gray-75">
              {t('mySkills.gainedOfTotal', { gained: gained.length, total })}
            </span>
          </div>
        </div>
        {isExpanded ? (
          <FiChevronUp className="h-4 w-4 shrink-0 text-sunbird-gray-75" />
        ) : (
          <FiChevronDown className="h-4 w-4 shrink-0 text-sunbird-gray-75" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-sunbird-gray-e5 p-4">
          {total === 0 ? (
            <p className="text-center text-sm text-sunbird-gray-75">{t('learningPath.noSkillsYet')}</p>
          ) : (
            <>
              {gained.length > 0 && (
                <div>
                  <span className="mb-2 block text-xs font-medium text-sunbird-green-dark">
                    {t('mySkills.skillsGainedSection', { count: gained.length })}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {gained.map((code) => (
                      <SkillTag key={code} skill={code} label={label(code)} gained selected={false} size="sm" onSelect={() => {}} />
                    ))}
                  </div>
                </div>
              )}
              {pending.length > 0 && (
                <div className={gained.length > 0 ? 'mt-4 border-t border-dashed border-sunbird-gray-e5 pt-4' : ''}>
                  <span className="mb-2 block text-xs font-medium text-sunbird-gray-75">
                    {t('mySkills.skillsPendingSection', { count: pending.length })}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {pending.map((code) => (
                      <SkillTag
                        key={code}
                        skill={code}
                        label={label(code)}
                        gained={false}
                        selected={false}
                        size="sm"
                        onSelect={() => {}}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <Link
            to={getLearningPathStatusPath(summary.pathId, summary.contextId)}
            state={{ from: location.pathname + location.search }}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-sunbird-brick hover:underline"
          >
            {t('mySkills.viewPathStatus')}
            <FiArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
