'use client';

import type { MediaStatus } from '@ai-content/shared/content';
import { createSupabaseBrowserClient } from '@ai-content/database/client/browser';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import type {
  ConfirmMediaUploadResult,
  RequestMediaUploadResult,
} from '@/app/app/workspaces/[workspaceId]/content/[contentId]/media-actions';
import {
  performContentMediaUpload,
  uploadContentMediaFile,
} from '@/lib/storage/upload-content-media';
import { Button, Field, Input } from '@/components/ui';

interface MediaUploadFormProps {
  mediaStatus: MediaStatus;
  previewUnavailable: boolean;
  requestUpload: (input: {
    name: string;
    type: string;
    size: number;
  }) => Promise<RequestMediaUploadResult>;
  confirmUpload: (path: string) => Promise<ConfirmMediaUploadResult>;
  removeUpload: () => Promise<ConfirmMediaUploadResult>;
}

/**
 * The only user-facing part of the first storage slice.
 *
 * This is intentionally not a general media manager. One content item gets
 * one immutable video. Replacement and deletion need an orphan-cleanup design
 * first, so an available item is read-only rather than a button that leaks the
 * previous object.
 */
export function MediaUploadForm({
  mediaStatus,
  previewUnavailable,
  requestUpload,
  confirmUpload,
  removeUpload,
}: MediaUploadFormProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [error, setError] = useState<string>();
  const [uploaded, setUploaded] = useState(false);

  async function remove() {
    setIsRemoving(true);
    setError(undefined);

    try {
      const result = await removeUpload();

      if ('error' in result) {
        setError(result.error);
        return;
      }

      setUploaded(false);
      router.refresh();
    } catch {
      setError('Unable to remove the video. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  }

  if (mediaStatus === 'available' || uploaded) {
    return (
      <div className="flex flex-col gap-3 border-t border-line py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {previewUnavailable ? (
            <p role="alert" className="text-[14px] text-danger">
              The stored video is currently unavailable for preview.
            </p>
          ) : (
            <p role="status" className="text-[14px] text-accent-strong">
              {uploaded ? 'Video uploaded.' : 'A stored video is ready.'}
            </p>
          )}
          {error ? (
            <p role="alert" className="mt-1 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
        {confirmingRemove ? (
          <div className="flex w-full flex-col gap-2 rounded-control bg-danger-soft p-3 sm:w-auto">
            <p className="text-[13px] text-danger">
              Remove this stored video? This cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isRemoving}
                onClick={() => setConfirmingRemove(false)}
                autoFocus
              >
                Cancel
              </Button>
              <Button type="button" variant="danger" disabled={isRemoving} onClick={remove}>
                {isRemoving ? 'Removing…' : 'Remove'}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="danger"
            disabled={isRemoving}
            onClick={() => setConfirmingRemove(true)}
            className="w-full sm:w-auto"
          >
            Remove video
          </Button>
        )}
      </div>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem('media');
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;

    if (!file) {
      setError('Choose an MP4 or MOV video.');
      return;
    }

    setIsUploading(true);
    setError(undefined);

    const result = await performContentMediaUpload(file, {
      requestTicket: requestUpload,
      upload: (ticket, selected) =>
        uploadContentMediaFile(createSupabaseBrowserClient(), ticket, selected),
      confirm: confirmUpload,
    });

    setIsUploading(false);

    if ('error' in result) {
      setError(result.error);
      return;
    }

    setUploaded(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      aria-busy={isUploading}
      className="flex flex-col gap-3 border-t border-line pt-4"
    >
      <Field
        id="content-media-file"
        label="Video file"
        hint={
          mediaStatus === 'temporary'
            ? 'An earlier upload did not finish. Choose the same file type to retry.'
            : 'MP4 or MOV, up to 50 MB. The file uploads directly to private storage.'
        }
        error={error}
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="media"
            type="file"
            accept="video/mp4,video/quicktime,.mp4,.mov"
            required
            disabled={isUploading || isRemoving}
            className="cursor-pointer py-2 file:mr-3 file:border-0 file:bg-transparent file:text-[14px] file:font-medium"
          />
        )}
      </Field>

      <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-ink-faint">
        {isUploading ? 'Preparing, uploading and confirming your video…' : null}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isUploading || isRemoving} className="w-full sm:w-auto">
          {isUploading
            ? 'Uploading…'
            : mediaStatus === 'temporary'
              ? 'Retry upload'
              : 'Upload video'}
        </Button>
        {mediaStatus === 'temporary' ? (
          confirmingRemove ? (
            <div className="flex flex-1 flex-col gap-2 rounded-control bg-danger-soft p-3">
              <p className="text-[13px] text-danger">
                Cancel this reservation and remove any uploaded bytes?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isRemoving}
                  onClick={() => setConfirmingRemove(false)}
                  autoFocus
                >
                  Keep
                </Button>
                <Button type="button" variant="danger" disabled={isRemoving} onClick={remove}>
                  {isRemoving ? 'Cancelling…' : 'Cancel upload'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={isUploading || isRemoving}
              onClick={() => setConfirmingRemove(true)}
              className="w-full sm:w-auto"
            >
              Cancel reservation
            </Button>
          )
        ) : null}
      </div>
    </form>
  );
}
