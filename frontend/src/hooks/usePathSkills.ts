import { useCallback, useMemo } from 'react';
import { useSkillFrameworks, useSkillLabels, useSkillProfile } from './useSkillProfile';
import { getFinishedCourseIds } from '@/services/learningPath/skillAggregation';
import {
  computePathSkills,
  computeRoleReadiness,
  type PathSkill,
  type PathSkillSummary,
  type RoleReadiness,
} from '@/services/learningPath/pathSkillStatus';
import { heldCodeSet } from '@/services/skill/mySkills';
import { withSkillCodes } from '@/services/skill/skillCodes';
import type { LearningPathModel } from '@/types/learningPathTypes';
import type { ViewerSummaryRecord } from '@/types/viewerServiceTypes';

export interface UsePathSkillsResult {
  summary: PathSkillSummary | undefined;
  /** Codes held from any source - the same "gained" set My Skills uses. */
  heldCodes: ReadonlySet<string>;
  /** State of one code on this path; undefined for a code outside the gained/pending sets. */
  stateOf: (code: string) => PathSkill | undefined;
  /** Display name for a leaf code, from the framework; de-slugs when no framework knows it. */
  name: (code: string) => string;
  /**
   * Readiness for the role this path is built for. Undefined until the path declares a
   * `targetRole` AND the framework maps skills to it - so it stays hidden while roles are deferred.
   */
  role?: { code: string; name: string } & RoleReadiness;
  isLoading: boolean;
}

/**
 * Skill progress for the path the learner is currently on, by the same rule as My Skills:
 * gained = in the skill profile (any source, any framework - codes are the key), pending = still
 * on a course here the learner has not finished.
 *
 * Not scoped to the path's framework any more. A skill earned from a standalone course or an
 * external certificate is held all the same, and filtering by framework made this page disagree
 * with My Skills. The framework is used for names only.
 */
export function usePathSkills(
  rawModel: LearningPathModel,
  summaryByCollectionId: Map<string, ViewerSummaryRecord>,
  pathSummary?: ViewerSummaryRecord
): UsePathSkillsResult {
  const { skills, frameworkIds, isLoading: profileLoading } = useSkillProfile();
  const ids = useMemo(
    () => [...(rawModel.competencyFramework ? [rawModel.competencyFramework] : []), ...frameworkIds],
    [rawModel.competencyFramework, frameworkIds]
  );
  const { labelOf, codeOf, isLoading: labelsLoading } = useSkillLabels(ids);
  // USF paths are tagged by skill NAME; the profile holds codes. Everything below matches on codes.
  const model = useMemo(() => withSkillCodes(rawModel, codeOf), [rawModel, codeOf]);

  const heldCodes = useMemo(() => heldCodeSet(skills), [skills]);
  const finishedCourseIds = useMemo(
    () => getFinishedCourseIds(model, pathSummary, summaryByCollectionId),
    [model, pathSummary, summaryByCollectionId]
  );

  const summary = useMemo(() => {
    const result = computePathSkills(model, heldCodes, finishedCourseIds);
    return result.total === 0 ? undefined : result;
  }, [model, heldCodes, finishedCourseIds]);

  // The competency read (roles) only when the path names a role: a learner on a role-less path
  // never pays for it.
  const roleFrameworkIds = useMemo(
    () => (model.targetRole && model.competencyFramework ? [model.competencyFramework] : []),
    [model.targetRole, model.competencyFramework]
  );
  const { metas, isLoading: roleLoading } = useSkillFrameworks(roleFrameworkIds);
  const meta = model.competencyFramework ? metas[model.competencyFramework] : undefined;

  const role = useMemo(() => {
    const code = model.targetRole;
    const readiness = code ? computeRoleReadiness(meta?.roles?.[code], heldCodes, model.allSkillCodes) : undefined;
    if (!code || !readiness) return undefined;
    // The authored name wins; de-slug only for a role with no name on record.
    return { code, name: meta?.roleNames?.[code] ?? labelOf(code, model.competencyFramework).name, ...readiness };
  }, [model.targetRole, model.allSkillCodes, model.competencyFramework, meta, heldCodes, labelOf]);

  const stateOf = useCallback((code: string) => summary?.skills.find((s) => s.code === code), [summary]);
  const name = useCallback(
    (code: string) => labelOf(code, model.competencyFramework).name,
    [labelOf, model.competencyFramework]
  );

  return { summary, heldCodes, stateOf, name, role, isLoading: profileLoading || labelsLoading || roleLoading };
}
