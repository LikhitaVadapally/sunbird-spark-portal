import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import './configs/i18n';
import './index.css';
import { LearningPathStatusView } from './pages/learningPath/LearningPathStatusView';

const levels = [
  {
    identifier: 'level_1',
    name: 'Level-1',
    index: 1,
    skills: ['Python Programming', 'Java Programming'],
    courses: [
      {
        identifier: 'c1',
        name: 'LP-Course-1-JP-PP',
        leafNodesCount: 2,
        leafIds: ['r1', 'r2'],
        skills: [],
        isAssessmentCourse: false,
      },
    ],
  },
  {
    identifier: 'level_2',
    name: 'Level-2',
    index: 2,
    skills: ['JavaScript'],
    courses: [
      { identifier: 'c2', name: 'LP-Course-2-JS', leafNodesCount: 1, leafIds: ['r3'], skills: [], isAssessmentCourse: false },
    ],
  },
  {
    identifier: 'level_3',
    name: 'Level-3',
    index: 3,
    skills: ['System Design', 'Cloud Basics'],
    courses: [
      { identifier: 'c3', name: 'LP-Course-3-SD', leafNodesCount: 4, leafIds: ['r4'], skills: [], isAssessmentCourse: false },
      { identifier: 'c4', name: 'LP-Assessment-3', leafNodesCount: 1, leafIds: ['r5'], skills: [], isAssessmentCourse: true },
    ],
  },
];

const lp = {
  model: {
    identifier: 'lp1',
    name: 'lp-1',
    policy: 'Fixed',
    levels,
    allSkills: ['Python Programming', 'Java Programming', 'JavaScript', 'System Design', 'Cloud Basics'],
    courseTotal: 4,
    leafTotal: 8,
  },
  progress: { pct: 62, completed: 5, total: 8, doneLevels: 2, levelCount: 3 },
  levelProgress: [
    { pct: 100, completed: 2, total: 2, doneCourses: 1 },
    { pct: 100, completed: 1, total: 1, doneCourses: 1 },
    { pct: 25, completed: 1, total: 4, doneCourses: 0 },
  ],
  levelStatuses: ['completed', 'completed', 'locked'],
  pathSummary: undefined,
  summaryByCollectionId: new Map(),
  isCreatorViewingOwnPath: false,
  isMentorViewingPath: false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const pathSkills = {
  summary: {
    skills: [
      { code: 'Python Programming', state: 'held' as const },
      { code: 'System Design', state: 'pending' as const },
    ],
    held: 1,
    total: 2,
  },
  heldCodes: new Set(['Python Programming']),
  stateOf: () => undefined,
  name: (code: string) => code,
  isLoading: false,
};

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-[hsl(var(--sunbird-beige-light))] font-rubik">
      <LearningPathStatusView lp={lp} pathLink="/learning-path/lp1" pathSkills={pathSkills} />
    </div>
  </MemoryRouter>
);
