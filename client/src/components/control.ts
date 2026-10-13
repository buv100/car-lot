/** Shared field chrome. An invalid field uses the danger border. */
export function controlClass(invalid = false): string {
  return `w-full min-w-0 rounded-control border ${invalid ? "border-danger" : "border-line"} bg-card px-3 py-2 text-base text-ink disabled:text-muted`;
}
