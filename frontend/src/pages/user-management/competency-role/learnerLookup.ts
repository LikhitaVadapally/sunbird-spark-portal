/** How the Assign form reads what the admin typed: a Sunbird user ID, an email or a username. */
export type LearnerQueryKind = 'id' | 'email' | 'userName';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function learnerQueryKind(input: string): LearnerQueryKind {
  const value = input.trim();
  if (UUID.test(value)) return 'id';
  if (value.includes('@')) return 'email';
  return 'userName';
}

/** A user as `/user/v3/search` returns it; only the fields the form shows. */
export interface FoundUserWire {
  id?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  userName?: string;
  maskedEmail?: string;
}

export interface FoundUser {
  id: string;
  /** "First Last (username)", so the admin can see it is the right person before assigning. */
  label: string;
}

export function toFoundUser(user: FoundUserWire): FoundUser | undefined {
  const id = user.userId || user.id;
  if (!id) return undefined;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const handle = user.userName || user.maskedEmail;
  const label = name && handle ? `${name} (${handle})` : name || handle || id;
  return { id, label };
}
