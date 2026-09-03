'use client';

import { useEffect, useRef, type ComponentProps } from 'react';

import { TEXTAREA_CLASS } from '@/components/ui';

/**
 * A textarea that starts small and grows to fit what is typed.
 *
 * The profile form has six of these in a row. At a fixed 120px each that is a
 * wall of mostly-empty boxes on a phone, and it pushed Save to 1483px - off
 * screen at load. Most answers here are a line or two.
 *
 * Client-only, and deliberately NOT folded into ui.tsx: that file is imported
 * by Server Components, so marking it 'use client' would pull the whole design
 * system into the browser bundle to gain one hook.
 */
export function AutoGrowTextarea(props: ComponentProps<'textarea'>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function fit(el: HTMLTextAreaElement | null) {
    if (!el) return;
    // Reset first: without it the box can only ever grow, never shrink back.
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  // Size to the value the server rendered, before the user types anything.
  useEffect(() => fit(ref.current), []);

  return (
    <textarea
      {...props}
      ref={ref}
      onInput={(event) => {
        fit(event.currentTarget);
        props.onInput?.(event);
      }}
      className={`${TEXTAREA_CLASS} ${props.className ?? ''}`}
    />
  );
}
