import { Link } from 'react-router-dom';
import { useAppI18n } from '@/hooks/useAppI18n';
import type { PathSkill, PathSkillSummary, RoleReadiness } from '@/services/learningPath/pathSkillStatus';

interface PathSkillProgressCardProps {
  summary: PathSkillSummary;
  name: (code: string) => string;
  /** Readiness for the path's target role; omitted (and nothing role-related shown) until roles are mapped. */
  role?: { name: string } & RoleReadiness;
}

const DOT: Record<PathSkill['state'], string> = {
  held: 'bg-sunbird-green',
  pending: 'bg-sunbird-gray-e5',
};

/**
 * "What does this path give me, and what have I got?" for a learner on it.
 *
 * Counts exactly what My Skills counts for this path (see `computePathSkills`): gained from the
 * skill profile, pending on unfinished courses. Role readiness appears only when `role` is given,
 * which `usePathSkills` does only once the path's target role has skills mapped to it.
 */
export function PathSkillProgressCard({ summary, name, role }: PathSkillProgressCardProps) {
  const { t } = useAppI18n();
  const order: Record<PathSkill['state'], number> = { held: 0, pending: 1 };
  const skills = [...summary.skills].sort(
    (a, b) => order[a.state] - order[b.state] || name(a.code).localeCompare(name(b.code))
  );
  const pct = summary.total > 0 ? Math.round((summary.held / summary.total) * 100) : 0;

  return (
    <div
      className="rounded-xl border border-sunbird-gray-e5 bg-surface p-5 shadow-sm"
      data-testid="path-skill-progress"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {role ? t('learningPath.progressTowardRole', { role: role.name }) : t('learningPath.skillsFromThisPath')}
        </span>
        <span className="text-xs text-sunbird-gray-75" data-testid="path-skill-count">
          {t('learningPath.skillsHeldOf', { held: summary.held, total: summary.total })}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunbird-gray-e5" aria-hidden="true">
        <div className="h-full rounded-full bg-sunbird-green transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>

      {role && (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs" data-testid="path-skill-readiness">
          <span className="text-sunbird-gray-75">
            {t('skillProfile.metOf', { met: role.held, required: role.required })}
          </span>
          <span className="text-sm font-semibold text-foreground">{role.readiness}%</span>
        </div>
      )}

      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {skills.map((s) => (
          <li key={s.code} className="flex items-center gap-2 text-sm" data-testid={`path-skill-${s.code}`}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[s.state]}`} aria-hidden="true" />
            <span className={s.state === 'held' ? 'text-foreground' : 'text-sunbird-gray-75'}>{name(s.code)}</span>
          </li>
        ))}
        {/* The role needs these but nothing on this path teaches them - finishing here is not enough. */}
        {role?.notTaught.map((code) => (
          <li key={code} className="flex items-center gap-2 text-sm" data-testid={`path-skill-${code}`}>
            <span className="h-2 w-2 shrink-0 rounded-full bg-sunbird-gray-e5" aria-hidden="true" />
            <span className="text-sunbird-gray-75">{name(code)}</span>
            <span className="text-[0.6875rem] text-sunbird-gray-82">{t('learningPath.notOnThisPath')}</span>
          </li>
        ))}
      </ul>

      <Link to="/profile/skills" className="mt-4 inline-block text-xs font-medium text-sunbird-brick hover:underline">
        {t('learningPath.viewMySkills')}
      </Link>
    </div>
  );
}
