import type { CSSProperties, ReactNode } from "react";
import { CornerBrackets } from "./CornerBracket";

interface GlassPanelProps {
  /** Title shown in the header with the mint sheen treatment. Omit for a header-less panel. */
  title?: string;
  /** Small mono tags shown on the right of the header (e.g. plot id, biome). */
  tags?: string[];
  /** "player" adds the animated gradient border from the v11 prototype. */
  variant?: "default" | "player";
  /** Hide the four mint corner brackets (shown by default). */
  hideBrackets?: boolean;
  className?: string;
  style?: CSSProperties;
  "data-testid"?: string;
  children: ReactNode;
}

/**
 * The v11 glass widget shell — frosted panel, hairline border, optional grip +
 * sheen title + mono tags, framed by corner brackets. Presentational only: it is
 * NOT draggable/resizable (the prototype's global pointer-driven drag/snap system
 * is intentionally not ported). Position it via `className`/`style`.
 */
export function GlassPanel({
  title,
  tags,
  variant = "default",
  hideBrackets = false,
  className,
  style,
  children,
  ...rest
}: GlassPanelProps) {
  return (
    <section
      className={`hud-glass${variant === "player" ? " hud-glass--player" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      data-testid={rest["data-testid"]}
    >
      {!hideBrackets && <CornerBrackets />}
      {title && (
        <div className="hud-wh">
          <span className="hud-grip" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="hud-wt">{title}</span>
          {tags && tags.length > 0 && (
            <span className="hud-wsub">
              {tags.map((t) => (
                <span className="hud-tag" key={t}>
                  {t}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
      <div className="hud-wb">{children}</div>
    </section>
  );
}
