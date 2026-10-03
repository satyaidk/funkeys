/**
 * @fileoverview Application header with animated gradient title.
 *
 * Uses Framer Motion for a smooth entrance animation (fade + slide down).
 * The title uses a CSS gradient background clip for the rainbow text effect.
 */

'use client';

import { motion } from 'framer-motion';

export default function Header() {
  return (
    <motion.header
      className="text-center pt-8 pb-4"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <h1 className="text-4xl sm:text-5xl font-bold">
        <span aria-hidden="true">🎹 </span>
        <span className="bg-linear-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
          Keyboard Piano
        </span>
      </h1>
      <p className="text-gray-400 mt-2 text-sm tracking-wide">
        Press your keyboard keys to play • Built with Web Audio API
      </p>
    </motion.header>
  );
}
