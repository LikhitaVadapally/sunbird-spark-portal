import type { HierarchyContentNode } from '../../types/collectionTypes';
import type {
  LearningPathModel,
  LearningPathPolicy,
  LPCourseNode,
  LPLevelNode,
  LPUnitNode,
} from '../../types/learningPathTypes';
import { getLeafContentIdsFromHierarchy } from '../collection/hierarchyTree';
import { skillName } from '../skill/skillTree';

const QUESTIONSET_MIME_TYPES = ['application/vnd.sunbird.questionset', 'application/vnd.sunbird.question'];

/**
 * Maps every observed spelling of the root `policy` field to its canonical
 * code. The design doc's PascalCase codes (`Fixed`/`Diagnostic`/
 * `PriorLearning`) and the live authoring tool's lowercase design-label
 * values (`strict`/`adaptive`/`prior learning`, etc.) both need to resolve -
 * matched case-insensitively with non-alphanumeric characters stripped, so
 * `"Prior Learning"`, `"prior_learning"` and `"priorlearning"` all match.
 */
const POLICY_ALIASES: Record<string, LearningPathPolicy> = {
  fixed: 'Fixed',
  strict: 'Fixed',
  diagnostic: 'Diagnostic',
  adaptive: 'Diagnostic',
  priorlearning: 'PriorLearning',
};

/**
 * True when a node is a QuML question set: `objectType === 'QuestionSet'` or
 * one of the QuML mimeTypes. Legacy ECML assessment resources
 * (`application/vnd.ekstep.ecml-archive`) do NOT qualify.
 */
function isQuestionSetNode(node: HierarchyContentNode): boolean {
  if (node.objectType === 'QuestionSet') return true;
  return QUESTIONSET_MIME_TYPES.includes((node.mimeType ?? '').toLowerCase());
}

/** A Course qualifies as an assessment course iff every one of its leaves is a QuML question set. */
function isAssessmentCourse(courseNode: HierarchyContentNode, leafIds: string[]): boolean {
  if (leafIds.length === 0) return false;
  const leaves = collectLeafNodes(courseNode);
  return leaves.length > 0 && leaves.every(isQuestionSetNode);
}

/** Collects leaf (non-collection) nodes under a course node, mirroring getLeafContentIdsFromHierarchy's traversal. */
function collectLeafNodes(node: HierarchyContentNode): HierarchyContentNode[] {
  const isCollection = (node.mimeType ?? '').toLowerCase() === 'application/vnd.ekstep.content-collection';
  if (!isCollection) return [node];
  const children = node.children ?? [];
  return children.flatMap(collectLeafNodes);
}

const COLLECTION_MIME = 'application/vnd.ekstep.content-collection';

function isCollectionNode(node: HierarchyContentNode): boolean {
  return (node.mimeType ?? '').toLowerCase() === COLLECTION_MIME;
}

/**
 * Maps a node under a Course into the `LPUnitNode` tree the rail renders when a
 * course row is expanded. Unlike `getLeafContentIdsFromHierarchy` (which
 * flattens everything to ids), this keeps the CourseUnit nesting intact so the
 * sidebar can show "what's inside this course" as a tree.
 */
function mapUnitNode(node: HierarchyContentNode): LPUnitNode {
  const isUnit = isCollectionNode(node);
  const children = isUnit ? (node.children ?? []).map(mapUnitNode) : [];
  return {
    identifier: node.identifier,
    name: node.name ?? '',
    mimeType: node.mimeType,
    primaryCategory: node.primaryCategory,
    isUnit,
    leafIds: isUnit ? children.flatMap((c) => c.leafIds) : [node.identifier],
    children,
    ...(typeof node.maxAttempts === 'number' ? { maxAttempts: node.maxAttempts } : {}),
  };
}

function unionSkills(...lists: Array<string[] | undefined>): string[] {
  const set = new Set<string>();
  lists.forEach((list) => (list ?? []).forEach((s) => s && set.add(s)));
  return Array.from(set);
}

/**
 * Competency codes for display.
 *
 * The v2 `skills` field carries leaf CODES ("dosage-calculation"); these lists are rendered
 * straight to the learner as chips, so a raw code would surface as a slug. `skillName` with no
 * vocabulary de-slugs it to "Dosage calculation" and leaves an already-readable taxonomy label
 * untouched, which is why the taxonomy facets can pass through the same call safely.
 *
 * A proper label needs the framework, which this mapper has no access to - the competency page
 * resolves names there instead. This only has to stop the Learning Path page showing slugs.
 */
function displayable(codes: string[] | undefined): string[] {
  return (codes ?? []).map((c) => skillName(undefined, c));
}

/**
 * A node's skill tags, read from `skillField`: the field its skill framework stores them in (the
 * framework's last category code - `skill` for most, `cuisine` for one whose last level is Cuisine;
 * see `frameworkSkillField`). Defaults to `skill`, so a path whose framework isn't known reads as
 * before.
 *
 * The field wins; its `se_` copy (`se_skills`) is only a fallback, NOT a union: `se_skills` is the
 * search-enriched copy of `skill`, so unioning listed every competency twice. The fallback stays
 * for older content carrying only `se_skills` (taxonomy labels).
 */
export function skillSource(node: object, skillField = 'skill'): string[] {
  const fields = node as Record<string, unknown>;
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  const own = list(fields[skillField]);
  return own.length > 0 ? own : list(fields[`se_${skillField}s`]);
}

function mapCourseNode(courseNode: HierarchyContentNode, skillField?: string): LPCourseNode {
  const leafIds = getLeafContentIdsFromHierarchy(courseNode);
  // Codes follow the same `skill` -> `se_skills` preference as the display list, so a course
  // carrying only the search-enriched copy still counts toward My Skills.
  const skillCodes = skillSource(courseNode, skillField);
  const skills = displayable(skillCodes);
  const isAssessment = isAssessmentCourse(courseNode, leafIds);
  return {
    identifier: courseNode.identifier,
    name: courseNode.name ?? '',
    primaryCategory: courseNode.primaryCategory,
    mimeType: courseNode.mimeType,
    leafNodesCount: courseNode.leafNodesCount ?? leafIds.length,
    leafIds,
    units: (courseNode.children ?? []).map(mapUnitNode),
    skills,
    skillCodes,
    isAssessmentCourse: isAssessment,
    ...(isAssessment ? { questionCount: leafIds.length } : {}),
  };
}

function mapLevelNode(levelNode: HierarchyContentNode, skillField?: string): LPLevelNode {
  const courses = (levelNode.children ?? []).map((c) => mapCourseNode(c, skillField));
  const ownCodes = skillSource(levelNode, skillField);
  const ownSkills = displayable(ownCodes);
  const skills = ownSkills.length > 0 ? ownSkills : unionSkills(...courses.map((c) => c.skills));
  return {
    identifier: levelNode.identifier,
    name: levelNode.name ?? '',
    index: levelNode.index ?? 0,
    description: levelNode.description,
    skills,
    skillCodes: ownCodes.length > 0 ? ownCodes : [...new Set(courses.flatMap((c) => c.skillCodes))],
    ownSkillCodes: ownCodes,
    courses,
  };
}

function resolvePolicy(raw: string | undefined): LearningPathPolicy {
  const normalized = (raw ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return POLICY_ALIASES[normalized] ?? 'Fixed';
}

/**
 * Parses a Learning Path hierarchy root into the derived `LearningPathModel`.
 * Role of the prior/outcome assessment Levels is derived — never stored:
 * the first Level unwraps to `priorAssessment` and the last to
 * `outcomeAssessment` when each holds exactly one assessment course. An
 * assessment course inside a middle Level stays a normal course in that
 * Level (badged "Question set only" in the UI), not unwrapped.
 */
export function parseLearningPath(
  root: HierarchyContentNode | null | undefined,
  /** The path's skill field (see `skillSource`); `skill` when unknown. */
  skillField?: string,
): LearningPathModel {
  if (!root) {
    return {
      identifier: '',
      name: '',
      policy: 'Fixed',
      levels: [],
      allSkills: [],
    allSkillCodes: [],
      courseTotal: 0,
      leafTotal: 0,
    };
  }

  const levelNodes = [...(root.children ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  let levels = levelNodes.map((l) => mapLevelNode(l, skillField));

  let priorAssessment: LPCourseNode | undefined;
  const first = levels[0];
  if (first && first.courses.length === 1 && first.courses[0]?.isAssessmentCourse) {
    priorAssessment = first.courses[0];
    levels = levels.slice(1);
  }

  let outcomeAssessment: LPCourseNode | undefined;
  const last = levels[levels.length - 1];
  if (levels.length > 0 && last && last.courses.length === 1 && last.courses[0]?.isAssessmentCourse) {
    outcomeAssessment = last.courses[0];
    levels = levels.slice(0, -1);
  }

  const courseTotal =
    levels.reduce((sum, l) => sum + l.courses.length, 0) +
    (priorAssessment ? 1 : 0) +
    (outcomeAssessment ? 1 : 0);

  const allSkills = unionSkills(
    priorAssessment?.skills,
    ...levels.map((l) => l.skills),
    outcomeAssessment?.skills
  );
  // Prefer the root's own tag: it is the authoritative union, written at publish. Fall back to the
  // children's codes for a path published before the root carried one.
  // The root's own field only (no se_ fallback), as before: a taxonomy label there isn't a code.
  const rootRaw = (root as unknown as Record<string, unknown>)[skillField ?? 'skill'];
  const rootCodes = (Array.isArray(rootRaw) ? rootRaw.map(String) : []).filter(Boolean);
  const allSkillCodes = rootCodes.length
    ? [...new Set(rootCodes)]
    : [...new Set([
        ...(priorAssessment?.skillCodes ?? []),
        ...levels.flatMap((l) => l.skillCodes),
        ...(outcomeAssessment?.skillCodes ?? []),
      ])];

  return {
    identifier: root.identifier,
    name: root.name ?? '',
    description: root.description,
    policy: resolvePolicy(root.policy),
    levels,
    priorAssessment,
    outcomeAssessment,
    allSkills,
    allSkillCodes,
    targetRole: root.targetRole,
    // `framework` is the taxonomy framework the content's `skill` terms come from; it stands in
    // for paths authored before `competencyFramework` existed, so their names still resolve.
    competencyFramework: root.competencyFramework ?? root.framework,
    courseTotal,
    leafTotal: root.leafNodesCount ?? getLeafContentIdsFromHierarchy(root).length,
  };
}

export { isAssessmentCourse };
