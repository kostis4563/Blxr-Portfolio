import ScrambleText from './scramble-text'
import { useAthensTemp } from '../lib/weather'

export default function StudioFact({ text }) {
  const tempC = useAthensTemp()

  return (
    <ScrambleText
      text={text}
      alt={tempC === null ? 'Athens, Greece' : `Athens, Greece · ${Math.round(tempC)}°C`}
    />
  )
}
