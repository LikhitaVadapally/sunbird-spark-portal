import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/common/Select';
import type { FrameworkOption } from '@/hooks/useCompetencyFrameworkAdmin';
import { useAppI18n } from '@/hooks/useAppI18n';
import { frameworkStatusLabel } from './frameworkStatus';

interface FrameworkSelectProps {
  options: FrameworkOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  labelledBy: string;
  testId: string;
  disabled?: boolean;
  /** Returns a short reason when an option can't be picked (shown next to it), otherwise undefined. */
  disabledReason?: (option: FrameworkOption) => string | undefined;
}

/** A competency framework dropdown: name, id and status per option. Shared by the admin tabs. */
export function FrameworkSelect({ options, value, onChange, placeholder, labelledBy, testId, disabled, disabledReason }: FrameworkSelectProps) {
  const { t } = useAppI18n();
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className="max-w-md" aria-labelledby={labelledBy} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => {
          const reason = disabledReason?.(o);
          return (
            <SelectItem key={o.id} value={o.id} disabled={Boolean(reason)} data-testid={`${testId}-option-${o.id}`}>
              <span className="flex items-center gap-2">
                <span className="font-medium">{o.name || o.id}</span>
                {o.name && <span className="text-xs text-sunbird-gray-75">{o.id}</span>}
                {o.status && (
                  <span className="rounded-full bg-sunbird-gray-f3 px-2 py-0.5 text-xs text-sunbird-gray-75">{frameworkStatusLabel(o.status, t)}</span>
                )}
                {reason && <span className="text-xs text-sunbird-gray-75">{reason}</span>}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
