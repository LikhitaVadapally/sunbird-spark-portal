import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ToolbarAction } from '@project-sunbird/collection-editor-react';
import PageLoader from '@/components/common/PageLoader';
import EditorErrorState from '@/components/editors/EditorErrorState';
import CollectionEditor from '@/components/editors/CollectionEditor';
import { ContentService } from '@/services/ContentService';
import { useAppI18n } from '@/hooks/useAppI18n';
import { toast } from '@/hooks/useToast';
import { useEditorLock } from '@/hooks/useEditorLock';
import useImpression from '@/hooks/useImpression';
import useInteract from '@/hooks/useInteract';
import { useEditorBackNavigation } from '@/pages/workspace/editors/useEditorBackNavigation';
import { useEditorViewIntent } from '@/pages/workspace/editors/useEditorViewIntent';

const COLLECTION_EDITOR_READ_FIELDS = [
  'identifier',
  'name',
  'description',
  'objectType',
  'createdBy',
  'status',
  'mimeType',
  'contentType',
  'resourceType',
  'collaborators',
  'contentDisposition',
  'primaryCategory',
  'framework',
  'targetFWIds',
];

const contentService = new ContentService();

const CollectionEditorPage = () => {
  const { t } = useAppI18n();
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const { interact } = useInteract();
  const [metadata, setMetadata] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useImpression({ type: 'view', pageid: 'collection-editor', object: { id: contentId || '', type: 'Content' } });

  useEffect(() => {
    setLoadError(null);

    if (!contentId) {
      setLoadError(t('content.missingIdentifier'));
      setLoading(false);
      return;
    }

    contentService
      .contentRead(contentId, COLLECTION_EDITOR_READ_FIELDS, 'edit')
      .then((res) => {
        const content = res.data?.content;
        if (!content) throw new Error(t('content.notFound'));
        setMetadata(content);
      })
      .catch(() => {
        setLoadError(t('content.failedToLoadMetadata'));
        toast({ title: t('error'), description: t('content.failedToLoadMetadata'), variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [contentId]);

  const viewIntent = useEditorViewIntent();

  const { editorMode, lockError, isLocking, isResolvingRole, retireLock } = useEditorLock({
    contentId,
    metadata,
    viewIntent,
  });

  const backTo = useEditorBackNavigation();

  const handleToolbarEvent = useCallback(async ({ action }: { action: ToolbarAction; data?: unknown }) => {
    interact({
      id: 'collection-editor-event',
      type: 'OTHER',
      pageid: 'collection-editor',
      cdata: [{ id: contentId || '', type: 'ContentId' }],
    });

    // Back, or a successful state change (the lib performs the API call and
    // emits these only on success) returns the user to the workspace.
    if (
      action === 'back' ||
      action === 'sendForReview' ||
      action === 'publish' ||
      action === 'reject'
    ) {
      await retireLock();
      navigate(backTo);
    }
  }, [navigate, retireLock, interact, contentId, backTo]);

  if (loading || isLocking || isResolvingRole) {
    return <PageLoader message={isLocking ? t('content.acquiringLock') : t('content.loadingEditor')} />;
  }

  if (lockError) {
    return <EditorErrorState message={lockError} />;
  }

  if (loadError || !metadata) {
    return <EditorErrorState message={loadError || t('content.notFound')} showRetry />;
  }

  return (
    <div className="w-full h-screen">
      <CollectionEditor
        identifier={metadata.identifier}
        metadata={metadata}
        mode={editorMode}
        onToolbarEvent={handleToolbarEvent}
      />
    </div>
  );
};

export default CollectionEditorPage;
