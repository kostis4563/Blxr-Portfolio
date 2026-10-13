import { imageProps, avifSource } from '../lib/images'

export default function Picture({ src, sizes, alt, ...rest }) {
  const avif = avifSource(src, sizes)
  const img = <img {...imageProps(src, sizes)} alt={alt} {...rest} />
  if (!avif) return img
  return (
    <picture>
      <source {...avif} />
      {img}
    </picture>
  )
}
