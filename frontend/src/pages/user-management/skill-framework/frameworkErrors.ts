import type { FrameworkApiError } from '@/hooks/useCompetencyFrameworkAdmin';

type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * Turns a Knowlg error into something an admin can act on. The server messages for file
 * problems (wrong type, missing header, not UTF-8, semicolon-delimited, too many rows) are
 * already written for end users, so they are shown as-is; only codes whose raw message is
 * unhelpful get their own copy.
 */
export function describeFrameworkError(error: unknown, t: Translate): string {
  const err = error as FrameworkApiError | undefined;
  switch (err?.errCode) {
    // FrameworkManager.assertFrameworkEditable: edits are blocked while Review/Processing.
    case 'ERR_FRAMEWORK_REVIEW_IN_PROGRESS':
      return t('userManagement.skillFramework.errors.editBlocked');
    case 'ERR_INVALID_CHANNEL_ID':
      return t('userManagement.skillFramework.errors.invalidChannel');
    case 'ERR_DUPLICATE_CODE':
      return t('userManagement.skillFramework.errors.duplicateFramework');
  }
  if (err?.status === 404) return t('userManagement.skillFramework.errors.notFound');
  return err?.message
    ? t('userManagement.skillFramework.errors.withDetail', { detail: err.message })
    : t('userManagement.skillFramework.errors.generic');
}
