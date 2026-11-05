/**
 * Derived view model for a Learning Path (LP → Level → Course → CourseUnit →
 * Resource hierarchy). Built from `HierarchyContentNode` by
 * `services/learningPath/learningPathMapper.ts` — never persisted, never
 * read back from the API.
 */

export type LearningPathPolicy = 'Fixed' | 'Diagnostic' | 'PriorLearning';

export type LevelStatusKey =
  | 'completed'
  | 'active'
  | 'notStarted'
  | 'locked'
  | 'waived'
  | 'credited'
  | 'creditedPending';

/**
 * A node inside a Course's own hierarchy — either a CourseUnit (`isUnit`, may
 * nest further) or a playable leaf. Kept alongside the course's flattened
 * `leafIds` so the rail can show what's actually inside a course without
 * refetching its hierarchy.
 */
export interface LPUnitNode {
  identifier: string;
  name: string;
  mimeType?: string;
  primaryCategory?: string;
  isUnit: boolean;
  /** Leaf ids under this node (the node's own id when it is a leaf). */
  leafIds: string[];
  children: LPUnitNode[];
  /**
   * Attempt limit for self-assess leaves, carried through from the course
   * hierarchy so the rail can render "attempt N of M" the way the course
   * player's `ContentRow` does.
   */
  maxAttempts?: number;
}

export interface LPCourseNode {
  identifier: string;
  name: string;
  primaryCategory?: string;
  mimeType?: string;
  leafNodesCount: number;
  leafIds: string[];
  /** The course's own children (units/leaves), preserved for the expandable rail rows. */
  units?: LPUnitNode[];
  /** De-slugged for display. */
  skills: string[];
  /** The raw competency leaf CODES, for matching against the learner's held skills. */
  skillCodes: string[];
  /** True when every leaf under this course is a QuML question set. */
  isAssessmentCourse: boolean;
  questionCount?: number;
}

export interface LPLevelNode {
  identifier: string;
  name: string;
  index: number;
  description?: string;
  skills: string[];
  /** The Level's own codes, or - when it carries none - the union of its courses' codes. */
  skillCodes: string[];
  /**
   * Only the codes tagged on the Level itself. An untagged course falls back to these (not to
   * the union above, which would borrow its siblings' skills).
   */
  ownSkillCodes?: string[];
  courses: LPCourseNode[];
}

export interface LearningPathModel {
  identifier: string;
  name: string;
  description?: string;
  policy: LearningPathPolicy;
  /** Content levels only — prior/outcome assessment levels are unwrapped and excluded. */
  levels: LPLevelNode[];
  /** Unwrapped from the first level, when it held exactly one assessment course. */
  priorAssessment?: LPCourseNode;
  /** Unwrapped from the last level, when it held exactly one assessment course. */
  outcomeAssessment?: LPCourseNode;
  allSkills: string[];
  /** Raw leaf codes across the whole path. */
  allSkillCodes: string[];
  /** The role this programme is built for, from the LP root. Drives the gap view. */
  targetRole?: string;
  competencyFramework?: string;
  courseTotal: number;
  leafTotal: number;
}

/** Per-course/level/path progress, derived from Viewer Service summary records. */
export interface ProgressInfo {
  pct: number;
  completed: number;
  total: number;
}

export interface LevelProgressInfo extends ProgressInfo {
  doneCourses: number;
}

export interface PathProgressInfo extends ProgressInfo {
  doneLevels: number;
  levelCount: number;
}

/** Waiver/credit status for a Level, derived from the Viewer Service's `optional_nodes` - see `deriveWaiversFromOptionalNodes`. */
export interface WaiverInfo {
  status: 'waived' | 'credited' | 'creditedPending';
  note: string;
}

export interface ResumeTarget {
  collectionId: string;
  contentId: string;
  contextId: string;
}

export interface AssessmentScore {
  score: number;
  maxScore: number;
}
