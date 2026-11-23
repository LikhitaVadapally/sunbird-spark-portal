import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageLoader from '@/components/common/PageLoader';
import EditorErrorState from '@/components/editors/EditorErrorState';
import QumlEditor from '@/components/quml-editor/QumlEditor';
import type { QumlEditorEvent, QumlEditorContextOverrides } from '@/services/editors/quml-editor';
import { QuestionSetService } from '@/services/QuestionSetService';
import { toast } from '@/hooks/useToast';
import { useEditorLock } from '@/hooks/useEditorLock';
import useImpression from '@/hooks/useImpression';
import useInteract from '@/hooks/useInteract';
import { useEditorBackNavigation } from '@/pages/workspace/editors/useEditorBackNavigation';
import { useEditorViewIntent } from '@/pages/workspace/editors/useEditorViewIntent';

import { useAppI18n } from '@/hooks/useAppI18n';

const questionSetService = new QuestionSetService();

const QumlEditorPage = () => {
  const { t } = useAppI18n();
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const { interact } = useInteract();
  const [metadata, setMetadata] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useImpression({ type: 'view', pageid: 'quml-editor', object: { id: contentId || '', type: 'Content' } });

  useEffect(() => {
    if (!contentId) {
      setLoading(false);
      return;
    }

    questionSetService
      .getQuestionset(contentId)
      .then((res: any) => {
        const questionSet = res?.questionset;
        if (!questionSet) throw new Error('No question set found');
        setMetadata(questionSet);
      })
      .catch(() => toast({ title: 'Error', description: 'Failed to load question set metadata.', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [contentId]);

  const viewIntent = useEditorViewIntent();

  const { editorMode, lockError, isResolvingRole, retireLock } = useEditorLock({
    contentId,
    metadata,
    viewIntent,
  });

  const backTo = useEditorBackNavigation();

  const contextOverrides: QumlEditorContextOverrides = useMemo(() => ({
    mode: editorMode,
  }), [editorMode]);

  const handleEditorEvent = useCallback(async (event: QumlEditorEvent) => {
    interact({
      id: 'quml-editor-event',
      type: 'OTHER',
      pageid: 'quml-editor',
      cdata: [{ id: contentId || '', type: 'ContentId' }],
    });

    // React editor emits {action: 'back'}; the old Angular editor sent {close: true}.
    const data = event.data as { action?: string; close?: boolean } | undefined;
    const closeEditor = data?.close || data?.action === 'back';
    if (closeEditor) {
      await retireLock();
      navigate(backTo);
    }
  }, [navigate, retireLock, interact, contentId, backTo]);

  const handleTelemetryEvent = useCallback((_event: any) => { }, []);

  if (loading || isResolvingRole) {
    return <PageLoader message={t('content.loadingEditor')} />;
  }

  if (lockError) {
    return <EditorErrorState message={lockError} />;
  }

  if (!metadata) {
    return <EditorErrorState message="Question set not found" showRetry />;
  }

  return (
    <div className="w-full h-screen">
      <QumlEditor
        metadata={metadata}
        mode={editorMode}
        contextOverrides={contextOverrides}
        onEditorEvent={handleEditorEvent}
        onTelemetryEvent={handleTelemetryEvent}
      />
    </div>
  );
};

export default QumlEditorPage;
