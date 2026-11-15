const suppliedPhotos = import.meta.glob('./assets/salon-photo.{jpg,jpeg,webp,png}', {
  eager: true,
  import: 'default',
})

const portrait = Object.values(suppliedPhotos)[0]

export default function SalonPortrait() {
  if (!portrait) return null
  return (
    <aside className="salon-portrait" aria-label="Salon interior">
      <img src={portrait} alt="" />
    </aside>
  )
}
