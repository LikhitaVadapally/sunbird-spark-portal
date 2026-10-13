export interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'document';
  mimeType?: string;
}

export interface Module {
  id: string;
  title: string;
  subtitle: string;
  lessons: Lesson[];
}

export type TrackableEnabled = "Yes" | "No";
export interface CollectionData {
  id: string;
  title: string;
  lessons: number;
  image: string;
  units: number;
  description: string;
  audience: string[];
  /** Channel (org) of the collection — used for consent API consumerId. */
  channel?: string;
  /** When "Yes", show profile data sharing consent for this course. */
  userConsent?: TrackableEnabled;
  /** Top-level units (main collapsible sections). Multi-level hierarchy preserved in each node's children. */
  children: HierarchyContentNode[];
  /** Full hierarchy root for tree traversal (leaf IDs, first leaf). */
  hierarchyRoot: HierarchyContentNode;
  trackable?: { enabled?: TrackableEnabled };
  createdBy?: string;
  primaryCategory?: string;
  /** Package version from the course hierarchy API. Used for telemetry `object.ver`. */
  pkgVersion?: number | string;
  /** ISO timestamp of the course's most recent publish. Used to flag "course updated after enrolment". */
  lastPublishedOn?: string;
}

export interface HierarchyContentNode {
  identifier: string;
  name?: string;
  description?: string;
  posterImage?: string;
  appIcon?: string;
  primaryCategory?: string;
  mimeType?: string;
  leafNodesCount?: number;
  audience?: string[];
  children?: HierarchyContentNode[];
  trackable?: { enabled?: TrackableEnabled };
  /** User ID of the collection creator (from /course/v1/hierarchy API). */
  createdBy?: string;
  /** JSON string containing counts of content types in the hierarchy. */
  contentTypesCount?: string;
  channel?: string;
  userConsent?: TrackableEnabled;
  contentType?: string;
  maxAttempts?: number;
  /** ISO timestamp of the course's most recent publish (from /course/v1/hierarchy). */
  lastPublishedOn?: string;
  /** Sunbird object type (e.g. 'Content', 'QuestionSet') — used to detect assessment courses in a Learning Path. */
  objectType?: string;
  /** Learning Path consumption policy (root-level only): Fixed | Diagnostic | PriorLearning. */
  policy?: string;
  /** Sort order among siblings (Levels, framework categories). */
  index?: number;
  /**
   * THREE SIMILAR NAMES, TWO DIFFERENT AXES. Do not merge them blindly.
   *
   * `skill` and `se_skills` are TAXONOMY discovery facets: human-readable labels such as
   * "Data literacy", used for browse and search scoping.
   *
   * `skill` is the COMPETENCY field: leaf term CODES such as "dosage-calculation", which is what
   * evidence, roles and the gap are keyed on. It replaced `competencies`, which held labels.
   * NOTE it is `skill`, singular - the plural `skills` is a DIFFERENT, pre-existing taxonomy field
   * locked to [Listening, Speaking, Reading, Writing, Touch, Gestures, Draw]; Knowlg rejects a
   * competency code written there. Content carries framework terms under the category's own name,
   * and the leaf category is `skill`.
   *
   * Codes are not display strings. Anything rendering `skills` to a learner must resolve or
   * de-slug it first, or the page shows raw slugs.
   */
  skill?: string[];
  se_skills?: string[];
  /** The Learning Path root only: the role the programme is built for. */
  targetRole?: string;
  competencyFramework?: string;
  /** Taxonomy framework the content was authored against (the source of its `skill` terms). */
  framework?: string;
}

export interface CourseHierarchyResponse {
  content: HierarchyContentNode;
}

export const BATCH_STATUS = { Upcoming: 0, Ongoing: 1, Expired: 2 } as const;

export interface BatchListItem {
  identifier: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  enrollmentEndDate?: string | null;
  status?: number;
  enrollmentType?: string;
  createdBy?: string;
  batchId?: string;
  [key: string]: unknown;
}

export interface BatchListResponse {
  response?: {
    content?: BatchListItem[];
    count?: number;
  };
}

export interface AvailableBatchesCardProps {
  batches: BatchListItem[];
  selectedBatchId: string;
  onBatchSelect: (batchId: string) => void;
  onJoinCourse: () => void;
  isLoading?: boolean;
  joinLoading?: boolean;
  error?: string;
  joinError?: string;
}

export interface CertTemplate {
  identifier: string;
  previewUrl?: string;
  url?: string;
  name?: string;
  description?: string;
  criteria?: unknown;
  issuer?: unknown;
  signatoryList?: unknown[];
}

export interface BatchReadResponse {
  response?: {
    identifier?: string;
    name?: string;
    startDate?: string;
    endDate?: string;
    cert_templates?: Record<string, CertTemplate>;
    [key: string]: unknown;
  };
}

export interface ContentStateItem {
  contentId: string;
  status?: number;
  lastAccessTime?: number;
  score?: unknown[];
  [key: string]: unknown;
}

export interface ContentStateReadResponse {
  contentList?: ContentStateItem[];
}

export interface ContentStateReadRequest {
  userId: string;
  courseId: string;
  batchId: string;
  contentIds: string[];
  fields?: string[];
}

export interface ContentStateUpdateContent {
  contentId: string;
  status: number;
  lastAccessTime?: string;
}

export interface ContentStateUpdateRequest {
  userId: string;
  courseId: string;
  batchId: string;
  contents: ContentStateUpdateContent[];
  assessments?: ContentStateAssessmentItem[];
}

export interface ContentStateAssessmentItem {
  assessmentTs: number;
  batchId: string;
  courseId: string;
  userId: string;
  attemptId: string;
  contentId: string;
  events: unknown[];
}
import type { ContentSearchItem } from './workspaceTypes';

export type RelatedContentItem = ContentSearchItem & { cardType?: 'collection' | 'resource' };

export interface RelatedContentSearchItem {
  identifier: string;
  name?: string;
  posterImage?: string;
  thumbnail?: string;
  visibility?: string;
  parent?: string;
  primaryCategory?: string;
  mimeType?: string;
  appIcon?: string;
  leafNodesCount?: number;
  resourceType?: string;
  creator?: string;
  createdBy?: string;
}
