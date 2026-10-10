export default function StripeBand({ className = '' }) {
  return (
    <div aria-hidden="true" className={`stripe-band frame-bleed relative h-8 border-b border-dashed border-line ${className}`}>
      {['tl', 'tr', 'bl', 'br'].map((pos) => (
        <span key={pos} data-pos={pos} className="frame-cross" />
      ))}
    </div>
  )
}
