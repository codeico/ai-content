/** Skeleton shaped like the list pages: header line, meta line, rows. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="animate-pulse">
      <div className="pb-6">
        <div className="h-8 w-48 rounded-control bg-line" />
        <div className="mt-3 h-4 w-72 max-w-full rounded-control bg-line/70" />
      </div>
      <ul className="border-t border-line">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="flex min-h-14 items-center justify-between border-b border-line py-3"
          >
            <div className="h-4 w-2/3 rounded-control bg-line" />
            <div className="h-3 w-12 rounded-control bg-line/70" />
          </li>
        ))}
      </ul>
    </div>
  );
}
