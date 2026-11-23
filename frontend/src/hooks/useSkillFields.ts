import { useMemo } from 'react';
import { useSkillVocabularies } from './useSkillProfile';

/**
 * Framework id -> the content field its skill tags live in (`skill`, `cuisine`, ...), from the
 * same cached framework reads as skill names (`useSkillVocabularies`), so no extra request. A
 * framework still loading, unknown, or not a competency framework maps to undefined: callers then
 * read `skill`.
 */
export function useSkillFields(frameworkIds: Array<string | undefined>): {
  fieldOf: (frameworkId: string | undefined) => string | undefined;
  isLoading: boolean;
} {
  const ids = useMemo(() => frameworkIds.filter((id): id is string => Boolean(id)), [frameworkIds]);
  const { vocabularies, isLoading } = useSkillVocabularies(ids);
  const fieldOf = useMemo(
    () => (frameworkId: string | undefined) => (frameworkId ? vocabularies[frameworkId]?.skillField : undefined),
    [vocabularies]
  );
  return { fieldOf, isLoading };
}
