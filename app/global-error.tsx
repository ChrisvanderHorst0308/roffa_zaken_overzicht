'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
            <h1 className="text-xl font-bold text-red-600 mb-4">Application Error</h1>
            <p className="text-gray-700 mb-4">
              {error.message || 'A client-side exception has occurred'}
            </p>
            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600 font-semibold">
                Please check:
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Browser console (F12) for detailed error messages</li>
                <li>.env.local file has correct Supabase credentials</li>
                <li>Database migrations have been executed</li>
                <li>Supabase project is active and accessible</li>
              </ul>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={reset}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
