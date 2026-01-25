'use client'

import { useLoadScript } from '@react-google-maps/api'
import { ReactNode } from 'react'

const libraries: ("places")[] = ['places']

interface GoogleMapsLoaderProps {
  children: ReactNode
}

export function GoogleMapsLoader({ children }: GoogleMapsLoaderProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  })

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gray-100 rounded-lg">
        <div className="text-center">
          <p className="text-red-600 font-medium">Error loading Google Maps</p>
          <p className="text-sm text-gray-500 mt-1">Please check your API key configuration</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading map...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
