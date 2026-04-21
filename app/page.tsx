import dynamic from 'next/dynamic'

const HomePageClient = dynamic(() => import('@/components/HomePageClient'), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-sm text-slate-700">Buscando...</div>
    </main>
  ),
})

export default function HomePage() {
  return <HomePageClient />
}
