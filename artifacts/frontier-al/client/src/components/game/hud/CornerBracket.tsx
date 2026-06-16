/**
 * Four mint corner brackets that frame a HUD surface, ported from the v11
 * prototype's `.cnr` spans. Purely decorative (aria-hidden, no pointer events).
 * Render inside a `position: relative` container.
 */
export function CornerBrackets() {
  return (
    <>
      <span className="hud-cnr tl" aria-hidden="true" />
      <span className="hud-cnr tr" aria-hidden="true" />
      <span className="hud-cnr bl" aria-hidden="true" />
      <span className="hud-cnr br" aria-hidden="true" />
    </>
  );
}
