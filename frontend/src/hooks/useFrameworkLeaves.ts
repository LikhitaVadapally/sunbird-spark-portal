import { useQuery } from '@tanstack/react-query';
import { CompetencyFrameworkService } from '@/services/CompetencyFrameworkService';
import { frameworkLeaves, frameworkVocabulary } from '@/services/skill/skillLeaves';
import type { SkillVocabulary, TaxonomyFrameworkResponse } from '@/services/skill/skillTree';

const competencyFrameworkService = new CompetencyFrameworkService();
const NONE: string[] = [];

/**
 * The skills (leaf codes) a role in this framework may require, plus their names and grouping.
 *
 * Read from `/competency-framework/v3/read`, as lern does: the generic `/framework/v1/read` answers
 * 404 for `CompetencyFramework` objects. `isLoaded` lets a caller tell "no skills" from "not
 * loaded yet".
 */
export function useFrameworkLeaves(frameworkId: string): {
  leaves: string[];
  vocabulary: SkillVocabulary | undefined;
  isLoaded: boolean;
} {
  const query = useQuery({
    queryKey: ['competencyFrameworkTree', frameworkId],
    queryFn: () => competencyFrameworkService.read(frameworkId),
    enabled: Boolean(frameworkId),
    select: (res) => {
      const body = res?.data as TaxonomyFrameworkResponse;
      return { leaves: frameworkLeaves(body), vocabulary: frameworkVocabulary(frameworkId, body) };
    },
  });
  return { leaves: query.data?.leaves ?? NONE, vocabulary: query.data?.vocabulary, isLoaded: query.isSuccess };
}
