import { useAppI18n } from '@/hooks/useAppI18n';

const SKELETON_CARDS = 6;

/** Held while framework names load, so the learner never sees slugs turn into names. */
export function SkillCardSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="skill-card-skeletons">
      {Array.from({ length: SKELETON_CARDS }, (_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-sunbird-gray-e5 bg-surface p-4">
          <div className="h-2.5 w-1/3 rounded bg-sunbird-gray-e5" />
          <div className="mt-2 h-4 w-2/3 rounded bg-sunbird-gray-e5" />
          <div className="mt-2 h-3 w-1/2 rounded bg-sunbird-gray-e5" />
        </div>
      ))}
    </div>
  );
}

export function EmptyResult({ label }: { label: string }) {
  return (
    <div className="flex min-h-[8rem] items-center justify-center rounded-2xl border border-sunbird-gray-e5 bg-surface">
      <p className="text-sm text-sunbird-gray-75">{label}</p>
    </div>
  );
}

/**
 * The skill profile could not be read. The page still renders - enrolled paths load separately -
 * but without the profile nothing reads as gained, so the learner is told why.
 */
export function ProfileErrorBanner({ onRetry }: { onRetry: () => void }) {
  const { t } = useAppI18n();
  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sunbird-ginger/45 bg-sunbird-warning-bg px-4 py-3"
      role="alert"
      data-testid="my-skills-profile-error"
    >
      <span className="text-sm text-foreground">{t('mySkills.profileError')}</span>
      <button type="button" onClick={onRetry} className="text-sm font-medium text-sunbird-brick hover:underline">
        {t('retry')}
      </button>
    </div>
  );
}
