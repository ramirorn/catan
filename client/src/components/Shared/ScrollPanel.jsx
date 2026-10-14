/**
 * Hanging-scroll frame: washi mounted on indigo cloth, a thin rod on top and
 * a weighted roller with lacquered knobs at the bottom. Purely decorative.
 * `className` sizes/positions the frame, `bodyClassName` styles the paper.
 */
export function ScrollPanel({ as: Tag = 'section', className = '', bodyClassName = '', children, ...rest }) {
  return (
    <Tag className={`scroll-panel ${className}`} {...rest}>
      <span className="scroll-rod scroll-rod-top" aria-hidden="true" />
      <div className={`paper scroll-sheet ${bodyClassName}`}>{children}</div>
      <span className="scroll-rod scroll-rod-bottom" aria-hidden="true" />
    </Tag>
  );
}
