import { FiPlus, FiX } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { Button } from '@/components/common/Button';
import type { FrameworkLevel } from '@/services/CompetencyFrameworkService';
import { levelCodeFromName, levelErrors, MAX_LEVELS } from './frameworkLevels';

interface LevelsEditorProps {
  levels: FrameworkLevel[];
  onChange: (levels: FrameworkLevel[]) => void;
  disabled?: boolean;
}

const inputClass = 'w-[13.5rem] rounded-lg border border-sunbird-gray-e5 bg-surface px-3 py-2';

/** The new framework's levels, top to bottom. The last one holds the skills. */
export function LevelsEditor({ levels, onChange, disabled }: LevelsEditorProps) {
  const { t } = useAppI18n();
  const errors = levelErrors(levels);

  const update = (i: number, patch: Partial<FrameworkLevel>) =>
    onChange(levels.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  // The code follows the name until the admin edits the code themselves.
  const rename = (i: number, name: string) => {
    const level = levels[i];
    if (!level) return;
    const follows = level.code === levelCodeFromName(level.name);
    update(i, follows ? { name, code: levelCodeFromName(name) } : { name });
  };

  return (
    <fieldset className="flex flex-col gap-2" data-testid="skill-framework-levels">
      <legend className="mb-1">{t('userManagement.skillFramework.levels.title')}</legend>
      <span className="text-xs text-sunbird-gray-75">{t('userManagement.skillFramework.levels.hint')}</span>
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-sunbird-gray-75" aria-hidden="true">
        <span className="w-20" />
        <span className="w-[13.5rem]">{t('userManagement.skillFramework.levels.name')}</span>
        <span className="w-[13.5rem]">{t('userManagement.skillFramework.levels.codeHeader')}</span>
      </div>
      {levels.map((level, i) => {
        const error = errors[i];
        const isSkills = i === levels.length - 1;
        return (
          <div key={i} className="flex flex-col gap-1" data-testid={`skill-framework-level-${i}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-xs text-sunbird-gray-75">
                {isSkills
                  ? t('userManagement.skillFramework.levels.skillsLevel')
                  : t('userManagement.skillFramework.levels.level', { n: i + 1 })}
              </span>
              <input
                className={inputClass}
                aria-label={t('userManagement.skillFramework.levels.name')}
                placeholder={t('userManagement.skillFramework.levels.name')}
                value={level.name}
                disabled={disabled}
                onChange={(e) => rename(i, e.target.value)}
                data-testid={`skill-framework-level-name-${i}`}
              />
              <input
                className={inputClass}
                aria-label={t('userManagement.skillFramework.levels.code')}
                placeholder={t('userManagement.skillFramework.levels.code')}
                value={level.code}
                disabled={disabled}
                onChange={(e) => update(i, { code: e.target.value.trim() })}
                data-testid={`skill-framework-level-code-${i}`}
              />
              {levels.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={t('userManagement.skillFramework.levels.remove')}
                  onClick={() => onChange(levels.filter((_, j) => j !== i))}
                  data-testid={`skill-framework-level-remove-${i}`}
                >
                  <FiX />
                </Button>
              )}
            </div>
            {error && (
              <span className="text-xs text-sunbird-brick" role="alert" data-testid={`skill-framework-level-error-${i}`}>
                {t(`userManagement.skillFramework.levels.errors.${error}`)}
              </span>
            )}
          </div>
        );
      })}
      {levels.length < MAX_LEVELS && (
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange([...levels, { code: '', name: '' }])}
            data-testid="skill-framework-level-add"
          >
            <FiPlus /> {t('userManagement.skillFramework.levels.add')}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
