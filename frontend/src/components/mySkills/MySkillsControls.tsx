import { FiChevronDown, FiSearch } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/common/DropdownMenu';

export type SkillsView = 'skills' | 'paths';

interface MySkillsControlsProps {
  view: SkillsView;
  onViewChange: (view: SkillsView) => void;
  query: string;
  onQueryChange: (query: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  /** Filter options for the active view, in display order. */
  filterOptions: { value: string; label: string }[];
  resultLabel: string;
  /** Skill-group labels to narrow by (the skill's parent term). Hidden when there are none. */
  groupOptions?: string[];
  group?: string;
  onGroupChange?: (group: string) => void;
}

interface FilterMenuProps {
  label: string;
  ariaLabel: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
}

function FilterMenu({ label, ariaLabel, options, onSelect }: FilterMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex min-w-[8rem] max-w-[14rem] shrink-0 items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-normal text-foreground transition-colors hover:bg-gray-50"
          aria-label={ariaLabel}
        >
          <span className="truncate">{label}</span>
          <FiChevronDown className="h-4 w-4 shrink-0 text-sunbird-theme-accent" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50 max-h-80 min-w-[9.5rem] overflow-y-auto bg-white">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="cursor-pointer hover:bg-sunbird-theme-accent-muted/10 hover:text-sunbird-theme-accent-muted"
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** View switch, search, a view-appropriate status narrow and (skills view) a group narrow, on one row. */
export function MySkillsControls({
  view,
  onViewChange,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  filterOptions,
  resultLabel,
  groupOptions = [],
  group = '',
  onGroupChange,
}: MySkillsControlsProps) {
  const { t } = useAppI18n();
  const activeLabel = filterOptions.find((o) => o.value === filter)?.label ?? '';
  const showGroups = view === 'skills' && groupOptions.length > 0 && Boolean(onGroupChange);

  const tabClass = (isActive: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive ? 'bg-white text-sunbird-brick shadow-sunbird-sm' : 'text-sunbird-gray-75 hover:text-foreground'
    }`;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-sunbird-ivory p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'skills'}
            onClick={() => onViewChange('skills')}
            className={tabClass(view === 'skills')}
          >
            {t('mySkills.viewBySkill')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'paths'}
            onClick={() => onViewChange('paths')}
            className={tabClass(view === 'paths')}
          >
            {t('mySkills.viewByPath')}
          </button>
        </div>
        <span className="hidden text-xs text-sunbird-gray-75 sm:inline">{resultLabel}</span>
      </div>

      <div className="flex flex-1 items-center gap-3 lg:max-w-2xl lg:justify-end">
        <div className="relative flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sunbird-gray-75" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('mySkills.searchPlaceholder')}
            aria-label={t('mySkills.searchPlaceholder')}
            className="w-full rounded-md border border-sunbird-gray-e5 bg-white py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-sunbird-gray-75 focus:border-sunbird-brick focus:outline-none"
          />
        </div>

        {showGroups && (
          <FilterMenu
            label={group || t('mySkills.allGroups')}
            ariaLabel={t('mySkills.groupFilterLabel')}
            options={[
              { value: '', label: t('mySkills.allGroups') },
              ...groupOptions.map((g) => ({ value: g, label: g })),
            ]}
            onSelect={(value) => onGroupChange?.(value)}
          />
        )}

        <FilterMenu
          label={activeLabel}
          ariaLabel={t('mySkills.filterLabel')}
          options={filterOptions}
          onSelect={onFilterChange}
        />
      </div>
    </div>
  );
}
