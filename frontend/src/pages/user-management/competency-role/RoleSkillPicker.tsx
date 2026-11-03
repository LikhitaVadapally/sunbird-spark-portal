import { useMemo, useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { CheckboxRow } from '@/components/common/CheckboxRow';
import { filterOptionGroups, type SkillOptionGroup } from '@/services/skill';

interface RoleSkillPickerProps {
  groups: SkillOptionGroup[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Codes the role already requires that are no longer leaves of the framework. */
  stale: string[];
}

/** Grouped, searchable checkboxes over the framework's leaf skills. */
export function RoleSkillPicker({ groups, selected, onChange, stale }: RoleSkillPickerProps) {
  const { t } = useAppI18n();
  const [query, setQuery] = useState('');
  const visible = useMemo(() => filterOptionGroups(groups, query), [groups, query]);

  const toggle = (code: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(code);
    else next.delete(code);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2" data-testid="role-skill-picker">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{t('userManagement.competencyRole.roles.skills')}</span>
        <span className="text-sunbird-gray-75" data-testid="role-skill-count">
          {t('userManagement.competencyRole.roles.selectedCount', { count: selected.size })}
        </span>
      </div>
      <input
        className="rounded-lg border border-sunbird-gray-e5 bg-surface px-3 py-2 text-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('userManagement.competencyRole.roles.searchSkills')}
        aria-label={t('userManagement.competencyRole.roles.searchSkills')}
        data-testid="role-skill-search"
      />

      <div className="max-h-72 overflow-y-auto rounded-lg border border-sunbird-gray-e5 p-3">
        {visible.length === 0 && (
          <p className="text-sm text-sunbird-gray-75">{t('userManagement.competencyRole.roles.noSkillMatch')}</p>
        )}
        {visible.map((group) => (
          <fieldset key={group.groupCode || '_other'} className="mb-3 last:mb-0">
            <legend className="mb-1 text-xs font-semibold uppercase text-sunbird-gray-75">
              {group.groupName || t('userManagement.competencyRole.roles.otherSkills')}
            </legend>
            <div className="flex flex-col gap-2">
              {group.options.map((option) => (
                <CheckboxRow
                  key={option.code}
                  id={`role-skill-${option.code}`}
                  checked={selected.has(option.code)}
                  onCheckedChange={(v) => toggle(option.code, v === true)}
                  label={option.name}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {stale.length > 0 && (
        <p className="text-xs text-sunbird-gray-75" data-testid="role-skill-stale">
          {t('userManagement.competencyRole.roles.staleSkills', { skills: stale.join(', ') })}
        </p>
      )}
    </div>
  );
}
