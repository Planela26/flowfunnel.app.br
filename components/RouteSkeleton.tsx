'use client'

type Variant = 'default' | 'dashboard' | 'list' | 'analytics' | 'simple'

const Bar = ({ className = '' }: { className?: string }) => (
  <div className={`bg-gray-200 dark:bg-gray-700/60 rounded animate-pulse ${className}`} />
)

const Card = ({ className = '' }: { className?: string }) => (
  <div
    className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 ${className}`}
  >
    <Bar className="h-3 w-24 mb-4" />
    <Bar className="h-7 w-32 mb-2" />
    <Bar className="h-3 w-16" />
  </div>
)

export default function RouteSkeleton({ variant = 'default' }: { variant?: Variant }) {
  if (variant === 'simple') {
    return (
      <main className="p-6 lg:p-8 space-y-4">
        <Bar className="h-7 w-48" />
        <Bar className="h-4 w-80" />
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <Bar className="h-4 w-full mb-3" />
          <Bar className="h-4 w-11/12 mb-3" />
          <Bar className="h-4 w-10/12 mb-3" />
          <Bar className="h-4 w-9/12" />
        </div>
      </main>
    )
  }

  if (variant === 'list') {
    return (
      <main className="p-6 lg:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <Bar className="h-7 w-40" />
          <Bar className="h-9 w-32" />
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <Bar className="h-4 w-32" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center gap-4"
            >
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700/60 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Bar className="h-3 w-1/3" />
                <Bar className="h-3 w-1/2" />
              </div>
              <Bar className="h-6 w-20" />
            </div>
          ))}
        </div>
      </main>
    )
  }

  if (variant === 'analytics') {
    return (
      <main className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Bar className="h-7 w-56" />
            <Bar className="h-4 w-72" />
          </div>
          <Bar className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card />
          <Card />
          <Card />
          <Card />
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <Bar className="h-4 w-40 mb-4" />
          <Bar className="h-64 w-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <Bar className="h-4 w-32 mb-4" />
            <Bar className="h-48 w-full" />
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <Bar className="h-4 w-32 mb-4" />
            <Bar className="h-48 w-full" />
          </div>
        </div>
      </main>
    )
  }

  if (variant === 'dashboard') {
    return (
      <main className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Bar className="h-8 w-48" />
          <div className="flex gap-2">
            <Bar className="h-9 w-28" />
            <Bar className="h-9 w-9 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card />
          <Card />
          <Card />
          <Card />
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <Bar className="h-4 w-40 mb-4" />
          <Bar className="h-80 w-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card />
          <Card />
          <Card />
        </div>
      </main>
    )
  }

  // default
  return (
    <main className="p-6 lg:p-8 space-y-6">
      <div className="space-y-2">
        <Bar className="h-7 w-48" />
        <Bar className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card />
        <Card />
        <Card />
      </div>
    </main>
  )
}
