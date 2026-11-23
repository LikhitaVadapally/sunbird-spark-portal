import { FRAMEWORK_STATUS } from '@/services/CompetencyFrameworkService';

type Translate = (key: string, params?: Record<string, unknown>) => string;

const KNOWN = new Set<string>(Object.values(FRAMEWORK_STATUS));

/** A framework status in the admin's language; a status this page doesn't know is shown as sent. */
export const frameworkStatusLabel = (status: string, t: Translate): string =>
  KNOWN.has(status) ? t(`userManagement.skillFramework.statusLabel.${status}`) : status;
