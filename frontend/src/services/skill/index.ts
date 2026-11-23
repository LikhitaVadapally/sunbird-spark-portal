import { SkillService } from './SkillService';

export { SkillService };
export const skillService = new SkillService();

export {
  normaliseProfile,
  normaliseGap,
  normaliseRecommendation,
  normaliseFrameworkMeta,
  normaliseAuthoredRoles,
  normaliseRoleDiff,
} from './skillMappers';

export {
  groupLeafOptions,
  filterOptionGroups,
  toRoleCode,
  type SkillOption,
  type SkillOptionGroup,
} from './roleSkillOptions';

export {
  frameworkCategories,
  skillName,
  resolveSkillLabel,
  type SkillVocabulary,
  type SkillLabel,
  type FrameworkReadResponse,
} from './skillTree';

