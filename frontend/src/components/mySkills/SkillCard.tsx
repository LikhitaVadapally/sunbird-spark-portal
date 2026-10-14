import { Link, useLocation } from 'react-router-dom';
import { FiCheck, FiChevronDown, FiLock } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { getLearningPathStatusPath } from '@/utils/getContentDetailPath';
import { toSourceKind } from '@/services/skill/mySkills';
import type { MySkillEntry, SkillPathRef, SkillSourceKind } from '@/services/skill/mySkills';
import type { SkillLabel } from '@/services/skill';
import type { SkillEvidence } from '@/types/skillServiceTypes';

interface SkillCardProps {
  entry: MySkillEntry;
  label: SkillLabel;
  isExpanded: boolean;
  onToggle: () => void;
}

function formatSkillDate(ms: number | undefined): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * What to call an evidence source. A content id means nothing to a learner, so an unnamed one is
 * left out; an outside certificate's id is its certificate number, so that one stays. A path's own
 * name is not repeated here - the path line below already shows it.
 */
function evidenceName(ev: SkillEvidence): string | undefined {
  if (ev.sourcePath && ev.sourcePath.pathId === ev.sourceId) return undefined;
  if (ev.sourceName) return ev.sourceName;
  return toSourceKind(ev.sourceType) === 'external' && ev.sourceId ? ev.sourceId : undefined;
}

/**
 * One evidence row, minus what the card header already says. The header shows the skill's source
 * and date, so a row repeats them only where they differ - which happens when several pieces of
 * evidence back one skill. A row with nothing else to show keeps its kind.
 */
function evidenceRow(ev: SkillEvidence, entry: MySkillEntry): { kind?: SkillSourceKind; name?: string; date?: string } {
  const kind = toSourceKind(ev.sourceType);
  const name = evidenceName(ev);
  const date = formatSkillDate(ev.occurredOn);
  const showDate = Boolean(date) && date !== formatSkillDate(entry.gainedAt);
  const showKind = kind !== entry.source || (!name && !showDate && !ev.sourcePath);
  return { ...(showKind ? { kind } : {}), ...(name ? { name } : {}), ...(showDate ? { date } : {}) };
}

const Dot = () => <span className="text-xs text-sunbird-gray-75">·</span>;

function PathLinks({ heading, paths }: { heading: string; paths: SkillPathRef[] }) {
  const location = useLocation();
  if (paths.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-sunbird-gray-75">{heading}</span>
      {paths.map((path) => (
        <Link
          key={path.pathId}
          to={getLearningPathStatusPath(path.pathId, path.contextId)}
          state={{ from: location.pathname + location.search }}
          className="block truncate text-sm font-medium text-sunbird-brick hover:underline"
        >
          {path.pathName}
        </Link>
      ))}
    </div>
  );
}

/**
 * One skill: its name, the group it sits under, gained or pending - and, expanded, either what
 * proved it ("how I earned this") or which enrolled paths still teach it.
 */
export function SkillCard({ entry, label, isExpanded, onToggle }: SkillCardProps) {
  const { t } = useAppI18n();
  const location = useLocation();
  const { gained, source, gainedAt, evidence, paths } = entry;
  const sourceLabel = (kind: string) => t(`mySkills.source.${kind}`);

  return (
    <div
      className={`flex flex-col rounded-xl border bg-surface shadow-sm transition-colors ${
        gained ? 'border-sunbird-success-message/40' : 'border-dashed border-sunbird-gray-d0'
      }`}
      data-testid={gained ? 'skill-card-gained' : 'skill-card-pending'}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          {label.group && (
            <span className="mb-1 block truncate pl-7 text-[0.6875rem] font-medium uppercase tracking-wider text-sunbird-gray-75">
              {label.group}
            </span>
          )}
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                gained ? 'bg-sunbird-success-message text-white' : 'bg-sunbird-gray-e5 text-sunbird-gray-75'
              }`}
            >
              {gained ? <FiCheck className="h-3 w-3" /> : <FiLock className="h-2.5 w-2.5" />}
            </span>
            <h3 className="truncate text-sm font-semibold text-foreground">{label.name}</h3>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-7">
            <span className={`text-xs font-medium ${gained ? 'text-sunbird-green-dark' : 'text-sunbird-gray-75'}`}>
              {gained ? t('mySkills.gained') : t('mySkills.pending')}
            </span>
            {gained && source && (
              <>
                <Dot />
                <span className="text-xs text-sunbird-gray-75">{sourceLabel(source)}</span>
              </>
            )}
            {gained && gainedAt !== undefined && (
              <>
                <Dot />
                <span className="text-xs text-sunbird-gray-75">{formatSkillDate(gainedAt)}</span>
              </>
            )}
            {!gained && (
              <>
                <Dot />
                <span className="text-xs text-sunbird-gray-75">{t('mySkills.pathCount', { count: paths.length })}</span>
              </>
            )}
          </div>
        </div>
        <FiChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-sunbird-gray-75 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-3 border-t border-sunbird-gray-e5 px-4 py-3" data-testid="skill-card-details">
          {gained ? (
            <>
              <div className="flex flex-col gap-1.5" data-testid="skill-evidence">
                <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-sunbird-gray-75">
                  {t('mySkills.howEarned')}
                </span>
                {evidence.length === 0 ? (
                  <p className="text-xs text-sunbird-gray-75">{t('mySkills.noEvidence')}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {evidence.map((ev) => {
                      const row = evidenceRow(ev, entry);
                      return (
                        <li key={ev.evidenceId} className="flex flex-col gap-0.5 text-xs">
                          <div className="flex flex-wrap items-center gap-x-2">
                            {row.kind && <span className="font-medium text-foreground">{sourceLabel(row.kind)}</span>}
                            {row.name && <span className="truncate font-medium text-foreground">{row.name}</span>}
                            {row.date && (
                              <>
                                {(row.kind || row.name) && <Dot />}
                                <span className="text-sunbird-gray-75">{row.date}</span>
                              </>
                            )}
                          </div>
                          {ev.sourcePath && (
                            <div className="flex min-w-0 items-center gap-x-1" data-testid="skill-evidence-path">
                              <span className="text-sunbird-gray-75">{t('mySkills.earnedIn')}</span>
                              <Link
                                to={getLearningPathStatusPath(ev.sourcePath.pathId, ev.sourcePath.contextId)}
                                state={{ from: location.pathname + location.search }}
                                className="truncate font-medium text-sunbird-brick hover:underline"
                              >
                                {ev.sourcePath.pathName}
                              </Link>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <PathLinks heading={t('mySkills.alsoTaughtIn')} paths={paths} />
            </>
          ) : (
            <PathLinks heading={t('mySkills.stillToDoIn')} paths={paths} />
          )}
        </div>
      )}
    </div>
  );
}
