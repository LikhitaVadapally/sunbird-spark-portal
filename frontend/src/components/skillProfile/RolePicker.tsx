import { useAppI18n } from '@/hooks/useAppI18n';

interface RolePickerProps {
  roles: string[];
  selected?: string;
  roleName: (code: string) => string;
  onSelect: (code: string) => void;
  /** Defaults to the target-role prompt. */
  label?: string;
}

/**
 * Role selector, as a pill group matching `MySkillsControls`' tab group rather than
 * a dropdown - a framework declares a handful of roles, and the portal has no dropdown
 * precedent in this style.
 *
 * Only roles requiring at least one skill are passed in (see `normaliseFrameworkMeta`): a
 * role with none reports 100% readiness for everyone.
 */
export function RolePicker({ roles, selected, roleName, onSelect, label }: RolePickerProps) {
  const { t } = useAppI18n();
  if (roles.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" data-testid="role-picker">
      <span className="text-xs font-medium text-sunbird-gray-75">{label ?? t('skillProfile.chooseTarget')}</span>
      <div className="flex flex-wrap gap-1 rounded-lg bg-sunbird-ivory p-1" role="tablist">
        {roles.map((code) => {
          const isActive = code === selected;
          return (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(code)}
              data-testid={`role-option-${code}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-white text-sunbird-brick shadow-sunbird-sm' : 'text-sunbird-gray-75 hover:text-foreground'
              }`}
            >
              {roleName(code)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
