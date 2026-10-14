import { useMemo } from 'react';
import { FiCheck } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { useSkillLabels, useSkillProfile } from '@/hooks/useSkillProfile';
import { heldCodeSet } from '@/services/skill/mySkills';

interface CourseSkillsSectionProps {
  /** The course's skill tags (`skill`, falling back to `se_skills`): codes, or USF names. Render only when non-empty. */
  codes: string[];
  /** Framework the codes belong to, when the course names one - for display names only. */
  frameworkId?: string;
}

/**
 * "Skills you will learn" on the course page, with a tick on each skill the learner already
 * holds - from any source, the same "gained" as My Skills.
 *
 * A separate component so its profile/framework reads only happen for a course that actually
 * carries skills; an anonymous visitor's profile read is disabled and simply shows no ticks.
 */
export function CourseSkillsSection({ codes, frameworkId }: CourseSkillsSectionProps) {
  const { t } = useAppI18n();
  const { skills, frameworkIds } = useSkillProfile();
  const held = useMemo(() => heldCodeSet(skills), [skills]);
  const ids = useMemo(() => [...(frameworkId ? [frameworkId] : []), ...frameworkIds], [frameworkId, frameworkIds]);
  const { labelOf, codeOf, isLoading } = useSkillLabels(ids);

  return (
    <div className="mb-6" data-testid="course-skills">
      <h3 className="collection-suited-title">{t('courseDetails.skills')}</h3>
      {isLoading ? (
        <div className="flex flex-wrap gap-2" data-testid="course-skills-loading">
          {codes.map((code) => (
            <span key={code} className="h-7 w-28 animate-pulse rounded-pill bg-sunbird-gray-e5" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {codes.map((tag) => {
            // A USF course is tagged by name ("Data Visualization"); the profile holds the code.
            const code = codeOf(tag, frameworkId);
            const isHeld = held.has(code);
            return (
              <li
                key={tag}
                data-testid={isHeld ? 'course-skill-held' : 'course-skill'}
                title={isHeld ? t('courseDetails.skillAlreadyHeld') : undefined}
                className={`flex items-center gap-1.5 rounded-pill border px-3 py-1 text-sm ${
                  isHeld
                    ? 'border-sunbird-success-message/40 bg-sunbird-success-message-bg text-sunbird-green-dark'
                    : 'border-sunbird-gray-e5 text-foreground'
                }`}
              >
                {isHeld && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sunbird-success-message text-white">
                    <FiCheck className="h-2.5 w-2.5" aria-label={t('courseDetails.skillAlreadyHeld')} />
                  </span>
                )}
                {labelOf(code, frameworkId).name}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
