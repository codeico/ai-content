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
import { Button, Input } from '@/components/ui';

interface MediaUploadFormProps {
  mediaStatus: MediaStatus;
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
  requestUpload,
  confirmUpload,
  removeUpload,
}: MediaUploadFormProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
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
          <p role="status" className="text-[14px] text-accent-strong">
            {uploaded ? 'Video uploaded.' : 'A stored video is ready.'}
          </p>
          {error ? (
            <p role="alert" className="mt-1 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="danger"
          disabled={isRemoving}
          onClick={remove}
          className="w-full sm:w-auto"
        >
          {isRemoving ? 'Removing…' : 'Remove video'}
        </Button>
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
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-line pt-4">
      <div>
        <h3 className="text-[14px] font-medium">Video file</h3>
        <p className="mt-1 text-[13px] text-ink-faint">
          {mediaStatus === 'temporary'
            ? 'An earlier upload did not finish. Choose the same file type to retry.'
            : 'MP4 or MOV, up to 50 MB. The file uploads directly to private storage.'}
        </p>
      </div>

      <Input
        name="media"
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        required
        disabled={isUploading}
        className="cursor-pointer py-2 file:mr-3 file:border-0 file:bg-transparent file:text-[14px] file:font-medium"
      />

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {uploaded ? (
        <p role="status" className="text-[13px] text-accent-strong">
          Video uploaded.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isUploading || isRemoving} className="w-full sm:w-auto">
          {isUploading
            ? 'Uploading…'
            : mediaStatus === 'temporary'
              ? 'Retry upload'
              : 'Upload video'}
        </Button>
        {mediaStatus === 'temporary' ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isUploading || isRemoving}
            onClick={remove}
            className="w-full sm:w-auto"
          >
            {isRemoving ? 'Cancelling…' : 'Cancel reservation'}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
