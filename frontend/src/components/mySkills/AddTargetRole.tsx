import { useAppI18n } from '@/hooks/useAppI18n';

interface AddTargetRoleProps {
  /** Live roles the learner can still aim at. */
  roles: string[];
  roleName: (code: string) => string;
  onAdd: (code: string) => void;
  disabled?: boolean;
}

/**
 * Picks one more target role. A native select, like the admin's role picker in `CompetencyRoleTab`:
 * it resets to the prompt after each pick, so it acts as an "add" action rather than holding a value.
 */
export function AddTargetRole({ roles, roleName, onAdd, disabled }: AddTargetRoleProps) {
  const { t } = useAppI18n();
  if (roles.length === 0) return null;

  return (
    <select
      className="rounded-lg border border-sunbird-gray-e5 bg-surface px-3 py-2 text-sm"
      value=""
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
      }}
      aria-label={t('skillProfile.addTarget')}
      data-testid="add-target-role"
    >
      <option value="">{t('skillProfile.addTarget')}</option>
      {roles.map((code) => (
        <option key={code} value={code}>
          {roleName(code)}
        </option>
      ))}
    </select>
  );
}
