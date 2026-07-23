/**
 * Global CSS for the neo-brutalism design system — the single stylesheet all
 * three consoles inject (via a `<style>` in their root layout). It carries the
 * three things inline styles can't: the Inter webfont, the page ground, and the
 * hover/press interactions that give neo-brutalist controls their tactile
 * "shadow collapses when pressed" feel.
 *
 * Primitives opt into the interactions with class names, not inline styles:
 *  - `neo-interactive` — buttons / pressables: lift on hover, slam flat on press.
 *  - `neo-input`       — text controls: accent focus ring (a hard offset shadow).
 */
export const neoGlobalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

:root { color-scheme: light; }

html, body {
  margin: 0;
  min-height: 100dvh;
  background: #FFFDF5;
  color: #000000;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
}

*, *::before, *::after { box-sizing: border-box; }

/* The banner is a body-level sibling of the console shell, so the body is the
   flex column that owns the viewport height and the shell takes the remainder
   — otherwise a shell asking for 100dvh would push the banner off-screen. */
body { display: flex; flex-direction: column; }

/* Neo interaction: hover lifts the element toward the light; press slams it
   flat, collapsing its hard shadow. Disabled controls stay put. */
.neo-interactive {
  transition: transform 80ms ease, box-shadow 80ms ease;
}
.neo-interactive:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 6px 6px 0 0 #000000;
}
.neo-interactive:active:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: 0 0 0 0 #000000;
}

/* Neo focus: a hard offset shadow in the accent, not a soft glow. */
.neo-input:focus {
  outline: none;
  border-color: #6FB6E8;
  box-shadow: 3px 3px 0 0 #6FB6E8;
}

::selection { background: #FFD23F; color: #000000; }

/* App bar: on a phone the wordmark, console name and actions already fill the
   bar, so the slogan chip drops out and the spacing tightens. */
@media (max-width: 560px) {
  .testify-appbar-slogan { display: none !important; }
  .testify-appbar { gap: 10px !important; padding: 9px 14px !important; }
}
`;
