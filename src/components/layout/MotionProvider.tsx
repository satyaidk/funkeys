/**
 * @fileoverview App-wide Framer Motion settings.
 *
 * `reducedMotion="user"` respects the operating system's "reduce motion"
 * accessibility setting: transform animations (slides, scales, key presses)
 * are skipped, while opacity and color changes still play.
 *
 * Lives in its own Client Component so the root layout can stay a
 * Server Component.
 */

'use client';

import { MotionConfig } from 'framer-motion';

export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
