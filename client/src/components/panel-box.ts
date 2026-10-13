import type { CSSProperties } from "react";

const panelMargin = 12;

/** Keeps an open panel inside the window, beside its button. */
export function panelBox(button: HTMLButtonElement, panelWidth: number): CSSProperties {
  const rect = button.getBoundingClientRect();
  const width = Math.min(panelWidth, window.innerWidth - panelMargin * 2);
  let left = rect.right - width;
  if (left < panelMargin) {
    left = Math.min(rect.left, window.innerWidth - panelMargin - width);
  }
  if (left < panelMargin) left = panelMargin;
  return { position: "fixed", top: rect.bottom + 8, left, width };
}
