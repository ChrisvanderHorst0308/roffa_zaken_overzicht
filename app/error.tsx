'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-bold text-red-600 mb-4">Something went wrong</h1>
        <p className="text-gray-700 mb-4">
          {error.message || 'An unexpected error occurred'}
        </p>
        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-600">
            Common issues:
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>Check if Supabase environment variables are set in .env.local</li>
            <li>Verify that database migrations have been run</li>
            <li>Check browser console for more details</li>
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
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  )
}
