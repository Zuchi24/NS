import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  test: {
    /*
     * Most tests here are pure functions and need no DOM at all. The component
     * tests do, so the environment is chosen per file by a `@vitest-environment
     * jsdom` docblock rather than switching the whole suite over — jsdom costs
     * real time to stand up, and the arithmetic tests should not pay it.
     */
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],

    /*
     * Half the logical CPUs, not all of them.
     *
     * Vitest runs one worker per logical CPU by default, and each of ours
     * stands up a jsdom and its own copy of the module graph — so the workers
     * compete for memory bandwidth and for cores that are hyperthread siblings
     * rather than whole ones. Past about half, the extra workers stop adding
     * throughput and only slow each other down: on this machine, going from
     * eight to four cut the summed test time from 660s to 343s, the summed
     * import time from 130s to 68s and the environment time from 162s to 103s,
     * while the wall clock stayed where it was (158s to 152s). The same work,
     * done at twice the speed by half as many workers, in the same elapsed
     * time.
     *
     * That doubling is what made the suite flaky. Every timeout here is
     * wall-clock — vitest's five seconds a test, Testing Library's one second a
     * findBy — so a run that takes twice as long per test spends twice as much
     * of those budgets, and the tests nearest their limit lost. Which ones lost
     * moved from run to run, because which workers happened to collide did.
     *
     * A proportion rather than a number, so a bigger machine still uses more of
     * itself. The cost is that a run cannot use every core; the measurements
     * above are why there is nothing to gain by it.
     */
    maxWorkers: '50%',
  },
})
