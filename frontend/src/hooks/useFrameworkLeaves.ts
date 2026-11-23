import { useQuery } from '@tanstack/react-query';
import { frameworkLeaves, frameworkVocabulary } from '@/services/skill/skillLeaves';
import {
  FRAMEWORK_STALE_MS,
  competencyFrameworkReadKey,
  readCompetencyFramework,
} from '@/services/skill/competencyFrameworkRead';
import type { SkillVocabulary } from '@/services/skill/skillTree';

const NONE: string[] = [];

/**
 * The skills (leaf codes) a role in this framework may require, plus their names and grouping.
 *
 * Read from `/competency-framework/v3/read`, as lern does: the generic `/framework/v1/read` answers
 * 404 for `CompetencyFramework` objects. Shares its cache entry with the learner's skill names.
 * `isLoaded` lets a caller tell "no skills" from "not loaded yet"; `isError` tells it the read failed.
 */
export function useFrameworkLeaves(frameworkId: string): {
  leaves: string[];
  vocabulary: SkillVocabulary | undefined;
  isLoaded: boolean;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: competencyFrameworkReadKey(frameworkId),
    queryFn: () => readCompetencyFramework(frameworkId),
    enabled: Boolean(frameworkId),
    staleTime: FRAMEWORK_STALE_MS,
    select: (body) => ({ leaves: frameworkLeaves(body), vocabulary: frameworkVocabulary(frameworkId, body) }),
  });
  return {
    leaves: query.data?.leaves ?? NONE,
    vocabulary: query.data?.vocabulary,
    isLoaded: query.isSuccess,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
