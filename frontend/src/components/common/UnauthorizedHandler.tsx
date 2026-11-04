import React, { useState, useEffect } from 'react';
import { useAppI18n } from '../../hooks/useAppI18n';
import { toast } from '@/hooks/useToast';

// Module-level flag — survives component remounts caused by navigation bounces
let redirectScheduled = false;
// One 403 often comes with sibling requests failing the same way; show one toast, not several.
const FORBIDDEN_TOAST_GAP_MS = 3000;
let lastForbiddenToastAt = 0;

const UnauthorizedHandler: React.FC = () => {
  const { t } = useAppI18n();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const authErrorHandler = (msg: string) => () => {
      if (redirectScheduled) return;
      redirectScheduled = true;
      setMessage(msg);
      timeoutId = setTimeout(() => { window.location.href = '/portal/logout'; }, 2500);
    };

    const handleAuthError = authErrorHandler(t('authErrorRedirectMessage'));

    // 401 means the session is gone, so log out. 403 means the session is fine but this one
    // action is not allowed (a Kong ACL or a role check): tell the user and keep them signed in.
    // The caller still gets the rejected request and can show its own inline error.
    const handleForbidden = () => {
      if (redirectScheduled) return;
      const now = Date.now();
      if (now - lastForbiddenToastAt < FORBIDDEN_TOAST_GAP_MS) return;
      lastForbiddenToastAt = now;
      toast({ title: t('forbiddenMessage'), variant: 'destructive' });
    };

    window.addEventListener('unauthorized', handleAuthError);
    window.addEventListener('forbidden', handleForbidden);
    return () => {
      window.removeEventListener('unauthorized', handleAuthError);
      window.removeEventListener('forbidden', handleForbidden);
      clearTimeout(timeoutId);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-describedby="auth-error-message"
        className="bg-white rounded-lg p-6 shadow-xl max-w-sm mx-4 text-center"
      >
        <p id="auth-error-message" className="text-gray-800 font-medium" aria-live="assertive">{message}</p>
      </div>
    </div>
  );
};

export default UnauthorizedHandler;
