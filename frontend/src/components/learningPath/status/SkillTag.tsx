import { FiCheck } from 'react-icons/fi';

interface SkillTagProps {
  /** The skill's identity (its code) - what `onSelect` reports. */
  skill: string;
  /** What the learner reads; defaults to `skill`. */
  label?: string;
  gained: boolean;
  selected: boolean;
  dimmed?: boolean;
  /** Staggers the entrance animation so gained skills land one after another. */
  index?: number;
  size?: 'sm' | 'md';
  onSelect: (skill: string) => void;
}

/** An interactive skill tag: celebratory when gained, muted when still pending, highlighted when selected. */
export function SkillTag({ skill, label, gained, selected, dimmed, index = 0, size = 'md', onSelect }: SkillTagProps) {
  const sizeClass = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  const toneClass = gained
    ? 'border-sunbird-success-message/40 bg-sunbird-success-message-bg text-sunbird-green-dark hover:border-sunbird-success-message'
    : 'border-dashed border-sunbird-gray-d0 bg-transparent text-sunbird-gray-75 hover:border-sunbird-gray-75';

  return (
    <button
      type="button"
      onClick={() => onSelect(skill)}
      aria-pressed={selected}
      data-testid={gained ? 'skill-chip-gained' : 'skill-chip-pending'}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className={`flex animate-fade-in items-center gap-1.5 rounded-pill border font-medium transition-all duration-200 ${sizeClass} ${toneClass} ${
        selected ? 'ring-2 ring-sunbird-brick ring-offset-1' : ''
      } ${dimmed ? 'opacity-35' : ''} ${gained ? 'hover:-translate-y-0.5 hover:shadow-sunbird-sm' : ''}`}
    >
      {gained && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sunbird-success-message text-white">
          <FiCheck className="h-2.5 w-2.5" />
        </span>
      )}
      {label ?? skill}
    </button>
  );
}
