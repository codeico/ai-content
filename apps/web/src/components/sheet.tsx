'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * A bottom sheet, the way a phone asks for input.
 *
 * Progressive enhancement is the whole design here. The form inside is a
 * Server Action form that must keep working with no JavaScript, so the sheet
 * never owns the form: the markup renders inline and this component only
 * *presents* it. With JS off the trigger is a plain in-page anchor and the
 * content is simply there, below the fold — nothing is hidden behind a button
 * that cannot be pressed.
 *
 * <dialog> gives focus trapping, inertness of the background, and Escape for
 * free. Reimplementing those by hand is where accessible modals usually go
 * wrong.
 */
interface SheetProps {
  /** Button label that opens the sheet. */
  trigger: string;
  /** Sheet title, announced as the dialog's accessible name. */
  title: string;
  /**
   * The form. Rendered whether or not the sheet is open.
   *
   * A child calls `useSheet().close()` when its action SUCCEEDED. Context
   * rather than a render prop because this component is used from Server
   * Components, and a function cannot cross that boundary — passing one
   * produced "Functions are not valid as a child of Client Components".
   *
   * Closing on the submit event instead looked right and was wrong: a rejected
   * title closed the sheet and took the error message with it, leaving the
   * user with no idea why nothing was created.
   */
  children: ReactNode;
}

/**
 * Lets a form inside the sheet dismiss it after a SUCCESSFUL action, without
 * the parent having to pass a callback across the server/client boundary.
 * Outside a sheet (the no-JS fallback, or a form used inline) close() is a
 * no-op, so the same form component works in both places.
 */
const SheetContext = createContext<{ close: () => void }>({ close: () => {} });

export function useSheet() {
  return useContext(SheetContext);
}

export function Sheet({ trigger, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [enhanced, setEnhanced] = useState(false);

  // Only take over once mounted: until then the server-rendered markup is the
  // no-JS version, and swapping it earlier would hide content from a client
  // that never runs this code.
  useEffect(() => setEnhanced(true), []);

  function open() {
    ref.current?.showModal();
  }

  function close() {
    ref.current?.close();
  }

  // Stable identity so a child effect keyed on it does not re-run each render.
  const value = useMemo(() => ({ close: () => ref.current?.close() }), []);

  if (!enhanced) {
    return (
      <section aria-labelledby="sheet-fallback-title" className="border-t border-line pt-5">
        <h2 id="sheet-fallback-title" className="mb-4 font-medium">
          {title}
        </h2>
        {children}
      </section>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="press w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-[15px] font-medium min-h-11"
      >
        {trigger}
      </button>

      <dialog
        ref={ref}
        aria-labelledby="sheet-title"
        // The backdrop is a click target for dismissal; clicks that land on
        // the panel itself must not bubble up and close it.
        onClick={(event) => {
          if (event.target === ref.current) close();
        }}
        className="sheet m-0 w-full max-w-none bg-transparent p-0 backdrop:bg-ink/30 sm:mx-auto sm:my-auto sm:max-w-[480px]"
      >
        <div className="mt-auto rounded-t-[16px] border-t border-line bg-surface px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-[12px] sm:border sm:pb-4">
          {/* Grabber: the visual cue that this panel came from the bottom. */}
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-line-strong" />

          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="sheet-title" className="text-[17px] font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={close}
              className="press -mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-soft"
              aria-label="Close"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              >
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>

          <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
        </div>
      </dialog>
    </>
  );
}
