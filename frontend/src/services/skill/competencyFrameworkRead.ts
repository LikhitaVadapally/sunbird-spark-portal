import { competencyFrameworkService } from '../CompetencyFrameworkService';
import type { FrameworkReadResponse } from './skillTree';

/** A framework changes on publish, not per session; refetching on every focus only re-flashes skeletons. */
export const FRAMEWORK_STALE_MS = 30 * 60 * 1000;

/**
 * One cache entry per `CompetencyFramework` read, shared by the learner's skill names
 * (`useSkillVocabularies`) and the admin's role editor (`useFrameworkLeaves`), so the same
 * framework is fetched once.
 */
export const competencyFrameworkReadKey = (frameworkId: string) => ['competencyFrameworkRead', frameworkId] as const;

export async function readCompetencyFramework(frameworkId: string): Promise<FrameworkReadResponse> {
  const res = await competencyFrameworkService.read(frameworkId);
  return res.data as FrameworkReadResponse;
}
