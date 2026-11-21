## Done when
The check passes on the PR's preview: with `prefers-reduced-motion: reduce` (macOS "Reduce motion", Android "Remove animations"), nothing on the home page's first screen animates for longer than half a second in the three seconds after load, and no video plays by itself. Visitors without the setting see the site as before.

## Make what is missing
- **CSS:** a global block in the base stylesheet:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  }
  ```
- **Carousels:** no autoplay when `matchMedia('(prefers-reduced-motion: reduce)').matches` (Swiper: don't pass `autoplay`; Embla: skip the Autoplay plugin; Keen: skip the timer).
- **Background and hero videos:** don't autoplay; show the poster image, with a play button.
- **JS animation libraries:** Framer Motion's `<MotionConfig reducedMotion="user">` at the root; GSAP `gsap.matchMedia()`; Lottie `autoplay: false`.

## Stacks
- **Next.js / React:** a `useReducedMotion()` hook (Framer Motion has one) for components that start motion in effects.
- **Tailwind:** `motion-safe:animate-*` instead of `animate-*`, or the global block above.
- **Astro / static:** the base stylesheet and the carousel's init script.

## Hand off only when
The motion comes from a third party's embed (a booking widget, a map, an ad): name it in the PR.

## Don't
- Don't remove the animations for everyone: this is about the visitor's setting.
- Don't hide the moving element instead: its content must stay.
