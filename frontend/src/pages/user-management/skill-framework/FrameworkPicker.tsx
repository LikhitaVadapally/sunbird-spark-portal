import { useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { Button } from '@/components/common/Button';
import { FrameworkSelect } from './FrameworkSelect';
import {
  useCompetencyFrameworkOptions,
  useCreateCompetencyFramework,
  useReadCompetencyFramework,
} from '@/hooks/useCompetencyFrameworkAdmin';
import { SKILL_FRAMEWORK_CATEGORIES, type CompetencyFrameworkDetails, type FrameworkLevel } from '@/services/CompetencyFrameworkService';
import { describeFrameworkError } from './frameworkErrors';
import { LevelsEditor } from './LevelsEditor';
import { levelsValid } from './frameworkLevels';

interface FrameworkPickerProps {
  /** The admin's root-org channel. The portal proxy sends it as X-Channel-Id, which Knowlg applies over any body value. */
  channel: string;
  orgName?: string;
  onSelected: (framework: CompetencyFrameworkDetails, isNew: boolean) => void;
}

// Becomes the framework identifier and a URL path segment, so keep it to safe characters.
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

/** The framework code a name suggests: "Nursing Skills" -> nursing_skills. */
export const frameworkCodeFromName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
const inputClass = 'rounded-lg border border-sunbird-gray-e5 bg-surface px-3 py-2';

/** Step 1: pick an existing competency framework, or create a new one. */
export function FrameworkPicker({ channel, orgName, onSelected }: FrameworkPickerProps) {
  const { t } = useAppI18n();
  const options = useCompetencyFrameworkOptions(channel);
  const read = useReadCompetencyFramework();
  const create = useCreateCompetencyFramework();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [frameworkId, setFrameworkId] = useState('');
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [levels, setLevels] = useState<FrameworkLevel[]>(() => SKILL_FRAMEWORK_CATEGORIES.map((l) => ({ ...l })));

  const code = form.code.trim();
  const codeInvalid = code !== '' && !CODE_PATTERN.test(code);
  const canCreate = Boolean(form.name.trim() && code && channel) && !codeInvalid && levelsValid(levels) && !create.isPending;
  const error = read.error ?? create.error;

  const load = (id: string, isNew: boolean) =>
    read.mutate(id, { onSuccess: (fw) => onSelected(fw, isNew) });

  const handleCreate = () =>
    create.mutate(
      { name: form.name.trim(), code, channel, description: form.description.trim(), levels },
      { onSuccess: (id) => load(id, true) }
    );

  return (
    <section className="flex flex-col gap-4" data-testid="skill-framework-picker">
      <div className="flex gap-4 text-sm" role="radiogroup">
        {(['existing', 'new'] as const).map((m) => (
          <label key={m} className="flex items-center gap-2">
            <input type="radio" name="sf-mode" checked={mode === m} onChange={() => setMode(m)} data-testid={`skill-framework-mode-${m}`} />
            {t(`userManagement.skillFramework.mode.${m}`)}
          </label>
        ))}
      </div>

      {mode === 'existing' ? (
        <div className="flex flex-col gap-1 text-sm">
          <span id="skill-framework-id-label">{t('userManagement.skillFramework.frameworkId')}</span>
          {options.length === 0 ? (
            <p className="text-sunbird-gray-75" data-testid="skill-framework-none">{t('userManagement.skillFramework.noFrameworks')}</p>
          ) : (
            <FrameworkSelect
              options={options}
              value={frameworkId}
              disabled={read.isPending}
              onChange={(id) => {
                setFrameworkId(id);
                load(id, false);
              }}
              placeholder={t('userManagement.skillFramework.chooseFramework')}
              labelledBy="skill-framework-id-label"
              testId="skill-framework-id"
            />
          )}
          {read.isPending && <span className="text-xs text-sunbird-gray-75">{t('userManagement.skillFramework.loading')}</span>}
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            {t('userManagement.skillFramework.name')}
            <input
              className={inputClass}
              value={form.name}
              // The code follows the name until the admin edits the code themselves.
              onChange={(e) => setForm({
                ...form,
                name: e.target.value,
                code: form.code === frameworkCodeFromName(form.name) ? frameworkCodeFromName(e.target.value) : form.code,
              })}
              data-testid="skill-framework-name"
            />
          </label>
          <label className="flex flex-col gap-1">
            {t('userManagement.skillFramework.code')}
            <input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="nursing_skills" data-testid="skill-framework-code" />
            <span className={`text-xs ${codeInvalid ? 'text-sunbird-brick' : 'text-sunbird-gray-75'}`}>
              {t('userManagement.skillFramework.codeHint')}
            </span>
          </label>
          <div className="flex flex-col gap-1">
            {t('userManagement.skillFramework.organisation')}
            <span className="font-medium" data-testid="skill-framework-org">{orgName || channel || t('userManagement.skillFramework.noOrganisation')}</span>
          </div>
          <label className="flex flex-col gap-1">
            {t('userManagement.skillFramework.description')}
            <textarea className={inputClass} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="skill-framework-description" />
          </label>
          <LevelsEditor levels={levels} onChange={setLevels} disabled={create.isPending} />
          <div>
            <Button disabled={!canCreate} onClick={handleCreate} data-testid="skill-framework-create">
              {create.isPending ? t('userManagement.skillFramework.creating') : t('userManagement.skillFramework.create')}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-sunbird-brick" role="alert" data-testid="skill-framework-picker-error">
          {describeFrameworkError(error, t)}
        </p>
      )}
    </section>
  );
}
