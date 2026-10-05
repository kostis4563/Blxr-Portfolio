import { CursorMark, Handles } from './figma'

export default function LiveSelect({ children, name }) {
  return (
    <span className="live-select">
      {children}
      <span aria-hidden="true" className="live-select-frame">
        <span className="live-select-box" />
        <Handles className="fig-handle live-select-handle" />
      </span>
      <span aria-hidden="true" className="live-select-ripple" />
      <span aria-hidden="true" className="live-select-track">
        <span className="live-select-cursor" data-cursor="kostis">
          <span className="live-select-pointer">
            <CursorMark name={name} arrowClassName="live-select-arrow" />
          </span>
        </span>
      </span>
    </span>
  )
}
