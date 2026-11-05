import { FiAward, FiDownload } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { Button } from '@/components/ui/button';
import { ScoreRows, type ScoreRow } from './ScoreRows';
import { SkillChips } from './SkillChips';

interface PathCompletionViewProps {
  pathTitle: string;
  levelCount: number;
  scores: ScoreRow[];
  /** Names of the path's skills the learner HOLDS (skill profile) - never the whole scope. */
  skills: string[];
  hasCertificate: boolean;
  onDownload?: () => void;
}

/**
 * Completion screen: stat cards, score rows, certificate card, skills-gained chips (design's `bDone`).
 *
 * Lists only skills actually gained - finishing a path does not by itself prove every skill it
 * scopes, and listing the whole scope here contradicted My Skills.
 */
export function PathCompletionView({ pathTitle, levelCount, scores, skills, hasCertificate, onDownload }: PathCompletionViewProps) {
  const { t } = useAppI18n();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-sunbird-moss bg-sunbird-moss/15">
          <FiAward className="h-7 w-7 text-sunbird-moss" />
        </div>
        <div>
          <h1 className="text-[1.6875rem] font-bold text-foreground">{t('learningPath.pathComplete', { pathTitle })}</h1>
          <p className="text-sm text-sunbird-gray-4a">{t('learningPath.levelsCompleted', { levelCount })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_25rem]">
        <div className="rounded-xl border border-sunbird-gray-e5 bg-surface p-[1.375rem] shadow-sm">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-sunbird-gray-75">
            {t('learningPath.yourScores')}
          </span>
          <ScoreRows rows={scores} />
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-sunbird-ginger/45 bg-gradient-to-br from-sunbird-warning-bg to-sunbird-ivory p-[1.375rem]">
            <span className="block text-lg font-medium text-foreground">{t('learningPath.certificateIssued')}</span>
            <div className="mt-4 flex gap-2.5">
              <Button className="flex-1" disabled={!hasCertificate} onClick={onDownload}>
                <FiDownload className="mr-1.5 h-4 w-4" />
                {t('learningPath.download')}
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-sunbird-gray-e5 bg-surface p-[1.375rem] shadow-sm">
            <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-sunbird-gray-75">
              {t('mySkills.skillsGained')}
            </span>
            <div className="mt-3">
              {skills.length > 0 ? (
                <SkillChips skills={skills} />
              ) : (
                <p className="text-sm text-sunbird-gray-75">{t('learningPath.noSkillsYet')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
