import { SkillService } from './SkillService';

export { SkillService };
export const skillService = new SkillService();

export {
  normaliseProfile,
  normaliseGap,
  normaliseRecommendation,
  normaliseFrameworkMeta,
} from './skillMappers';

export {
  buildSkillVocabulary,
  groupSkillsByTier,
  frameworkCategories,
  skillName,
  skillGroupName,
  resolveSkillLabel,
  isGrouped,
  type SkillVocabulary,
  type SkillLabel,
  type TierGroup,
  type TaxonomyFrameworkResponse,
} from './skillTree';
