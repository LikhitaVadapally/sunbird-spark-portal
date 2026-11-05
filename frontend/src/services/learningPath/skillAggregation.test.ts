import { describe, it, expect } from 'vitest';
import {
  buildPathSkillSummary,
  courseSkillCodes,
  derivePathSkillCodes,
  filterPathSummaries,
  getFinishedCourseIds,
  splitPathSkills,
} from './skillAggregation';
import type { LearningPathModel, LPCourseNode, LPLevelNode } from '../../types/learningPathTypes';
import type { ViewerSummaryRecord } from '../../types/viewerServiceTypes';

function course(overrides: Partial<LPCourseNode>): LPCourseNode {
  return {
    identifier: 'course',
    name: 'Course',
    leafNodesCount: 1,
    leafIds: ['leaf'],
    skills: [], skillCodes: [],
    isAssessmentCourse: false,
    ...overrides,
  };
}

function level(overrides: Partial<LPLevelNode>): LPLevelNode {
  return { identifier: 'lvl', name: 'Level', index: 0, skills: [], skillCodes: [], ownSkillCodes: [], courses: [], ...overrides };
}

function model(overrides: Partial<LearningPathModel>): LearningPathModel {
  const levels = overrides.levels ?? [];
  const leafTotal = levels.flatMap((l) => l.courses).reduce((n, c) => n + c.leafIds.length, 0);
  return {
    identifier: 'path-1',
    name: 'My Path',
    policy: 'Fixed',
    levels,
    allSkills: [], allSkillCodes: [],
    courseTotal: levels.reduce((n, l) => n + l.courses.length, 0),
    leafTotal,
    ...overrides,
  };
}

/** A path record whose given leaves are marked complete via `contentStatus`. */
function pathSummary(doneLeafIds: string[], extra: Partial<ViewerSummaryRecord> = {}): ViewerSummaryRecord {
  const contentStatus = Object.fromEntries(doneLeafIds.map((id) => [id, 2]));
  return { contentStatus, ...extra } as ViewerSummaryRecord;
}

const twoCourses = model({
  levels: [
    level({
      identifier: 'l1',
      courses: [
        course({ identifier: 'c1', leafIds: ['leaf1'], skillCodes: ['dosage-calculation'] }),
        course({ identifier: 'c2', leafIds: ['leaf2'], skillCodes: ['sterile-field'] }),
      ],
    }),
  ],
});

describe('courseSkillCodes', () => {
  it("uses the course's own tags when it has them", () => {
    const l = level({ ownSkillCodes: ['level-skill'] });
    expect(courseSkillCodes(course({ skillCodes: ['own'] }), l)).toEqual(['own']);
  });

  it("falls back to the Level's own tags, not its siblings' union", () => {
    const l = level({ ownSkillCodes: ['level-skill'], skillCodes: ['level-skill', 'sibling-skill'] });
    expect(courseSkillCodes(course({}), l)).toEqual(['level-skill']);
  });

  it('teaches nothing when neither the course nor its Level is tagged', () => {
    expect(courseSkillCodes(course({}), level({ skillCodes: ['sibling-skill'] }))).toEqual([]);
  });
});

describe('getFinishedCourseIds', () => {
  it('counts a fully completed course as finished', () => {
    expect(getFinishedCourseIds(twoCourses, pathSummary(['leaf1']), new Map())).toEqual(new Set(['c1']));
  });

  it('counts a course waived by the prior assessment as finished', () => {
    const finished = getFinishedCourseIds(twoCourses, pathSummary([], { optionalNodes: ['leaf2'] }), new Map());
    expect(finished.has('c2')).toBe(true);
  });

  it('counts every course in a waived Level as finished', () => {
    const finished = getFinishedCourseIds(twoCourses, pathSummary([], { optionalNodes: ['l1'] }), new Map());
    expect(finished).toEqual(new Set(['c1', 'c2']));
  });
});

describe('derivePathSkillCodes', () => {
  it('lists every taught code and only the unfinished ones as still to do', () => {
    expect(derivePathSkillCodes(twoCourses, new Set(['c1']))).toEqual({
      taughtCodes: ['dosage-calculation', 'sterile-field'],
      unfinishedCodes: ['sterile-field'],
    });
  });

  it('includes the outcome assessment but not the diagnostic prior assessment', () => {
    const m = model({
      priorAssessment: course({ identifier: 'prior', skillCodes: ['diagnosed'] }),
      outcomeAssessment: course({ identifier: 'outcome', skillCodes: ['proven'] }),
    });
    expect(derivePathSkillCodes(m, new Set()).unfinishedCodes).toEqual(['proven']);
  });
});

describe('buildPathSkillSummary', () => {
  it('reports status from progress and carries the framework for names', () => {
    const summary = buildPathSkillSummary(
      { ...twoCourses, competencyFramework: 'nursing_fw' },
      pathSummary(['leaf1']),
      new Map(),
      'ctx-1'
    );
    expect(summary.status).toBe('ongoing');
    expect(summary.frameworkId).toBe('nursing_fw');
    expect(summary.contextId).toBe('ctx-1');
    expect(summary.unfinishedCodes).toEqual(['sterile-field']);
  });

  it('reports not-started with no progress at all', () => {
    expect(buildPathSkillSummary(twoCourses, undefined, new Map()).status).toBe('not-started');
  });

  it('reports completed once every course is done', () => {
    const summary = buildPathSkillSummary(twoCourses, pathSummary(['leaf1', 'leaf2']), new Map());
    expect(summary.status).toBe('completed');
    expect(summary.unfinishedCodes).toEqual([]);
  });
});

describe('splitPathSkills', () => {
  it('gains what is held from any source and leaves the rest of the unfinished work pending', () => {
    const split = splitPathSkills(
      { taughtCodes: ['a', 'b', 'c'], unfinishedCodes: ['b', 'c'] },
      new Set(['a', 'c'])
    );
    expect(split).toEqual({ gained: ['a', 'c'], pending: ['b'] });
  });
});

describe('filterPathSummaries', () => {
  const completed = buildPathSkillSummary(
    model({
      identifier: 'p1',
      name: 'Data Basics',
      levels: [level({ identifier: 'l1', courses: [course({ identifier: 'c1', leafIds: ['leaf1'], skillCodes: ['sql'] })] })],
    }),
    pathSummary(['leaf1']),
    new Map()
  );
  const notStarted = buildPathSkillSummary(
    model({
      identifier: 'p2',
      name: 'Cloud Fundamentals',
      levels: [level({ identifier: 'l2', courses: [course({ identifier: 'c2', leafIds: ['leaf2'], skillCodes: ['aws-basics'] })] })],
    }),
    undefined,
    new Map()
  );

  it('matches by path name, case-insensitively', () => {
    expect(filterPathSummaries([completed, notStarted], { query: 'data' })).toEqual([completed]);
  });

  it('matches by a skill code or its resolved name', () => {
    expect(filterPathSummaries([completed, notStarted], { query: 'aws' })).toEqual([notStarted]);
    const nameOf = (code: string) => (code === 'sql' ? 'Structured Query Language' : code);
    expect(filterPathSummaries([completed, notStarted], { query: 'structured', nameOf })).toEqual([completed]);
  });

  it('filters by status', () => {
    expect(filterPathSummaries([completed, notStarted], { status: 'not-started' })).toEqual([notStarted]);
  });

  it('returns everything with no filters', () => {
    expect(filterPathSummaries([completed, notStarted], {})).toEqual([completed, notStarted]);
  });
});
