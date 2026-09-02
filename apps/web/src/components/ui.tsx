import type { ContentSourceType, ContentStatus, MediaStatus } from '@ai-content/shared/content';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/**
 * UI primitives shared across every screen. Kept in one file on purpose: these
 * are the whole design system, and seeing them together is what keeps radii,
 * spacing, and colour consistent.
 */

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

const BUTTON_BASE =
  'press inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-[15px] font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-surface hover:bg-ink/90',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-line/60',
  quiet: 'text-ink-soft hover:bg-line/60 hover:text-ink',
  danger: 'border border-danger/30 text-danger hover:bg-danger-soft',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return <button {...props} className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], className)} />;
}

export function ButtonLink({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], className)} />;
}

/* ------------------------------------------------------------------- Field */

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
  children: (a11y: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode;
}

/** Label above, control, then hint or error below (skill §4.6). */
export function Field({ id, label, error, hint, hideLabel, children }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cx('text-[13px] font-medium text-ink-soft', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      {children({
        id,
        ...(describedBy && { 'aria-describedby': describedBy }),
        ...(error && { 'aria-invalid': true as const }),
      })}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const CONTROL_CLASS =
  'min-h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-faint focus-visible:border-accent aria-invalid:border-danger';

export function Input(props: ComponentProps<'input'>) {
  return <input {...props} className={cx(CONTROL_CLASS, props.className)} />;
}

export function Select(props: ComponentProps<'select'>) {
  return <select {...props} className={cx(CONTROL_CLASS, 'appearance-auto', props.className)} />;
}

/* ------------------------------------------------------------------ Notice */

export function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'rounded-control px-3 py-2.5 text-[14px]',
        tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent-strong',
      )}
    >
      {children}
    </p>
  );
}

/* -------------------------------------------------------------- StatusMark */

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  archived: 'Archived',
};

export const SOURCE_TYPE_LABEL: Record<ContentSourceType, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  upload: 'Upload',
  url: 'Link',
  other: 'Other',
};

export const MEDIA_STATUS_LABEL: Record<MediaStatus, string> = {
  external_only: 'External only',
  available: 'Available',
  missing: 'Missing',
};

/**
 * Colour is the only state signal, and each tone has one meaning across the
 * product: accent = ready/available, warn = draft/pending, muted = archived
 * or a neutral fact, danger = something that should exist and does not.
 */
export type StatusTone = 'ready' | 'pending' | 'muted' | 'neutral' | 'danger';

const TONE_CLASS: Record<StatusTone, string> = {
  ready: 'text-accent',
  pending: 'text-warn',
  muted: 'text-ink-faint',
  neutral: 'text-ink-soft',
  danger: 'text-danger',
};

const STATUS_TONE: Record<ContentStatus, StatusTone> = {
  draft: 'pending',
  ready: 'ready',
  archived: 'muted',
};

const MEDIA_STATUS_TONE: Record<MediaStatus, StatusTone> = {
  external_only: 'neutral',
  available: 'ready',
  missing: 'danger',
};

/** Text-only status. Colour carries state; no badge chrome. */
export function StatusMark({ status }: { status: ContentStatus }) {
  return <ToneMark tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</ToneMark>;
}

export function MediaStatusMark({ status }: { status: MediaStatus }) {
  return <ToneMark tone={MEDIA_STATUS_TONE[status]}>{MEDIA_STATUS_LABEL[status]}</ToneMark>;
}

function ToneMark({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={cx('text-[13px] font-medium', TONE_CLASS[tone])}>{children}</span>;
}

/* -------------------------------------------------------------- EmptyState */

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-line py-10">
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-[46ch] text-[15px] text-ink-soft">{body}</p>
    </div>
  );
}

/* -------------------------------------------------------------- PageHeader */

export function PageHeader({
  eyebrow,
  title,
  meta,
  action,
}: {
  eyebrow?: ReactNode;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-[13px] text-ink-faint [&_a]:-mx-2 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:px-2">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.01em] break-words sm:text-[30px]">
          {title}
        </h1>
        {meta ? <div className="mt-1 text-[14px] text-ink-soft">{meta}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
