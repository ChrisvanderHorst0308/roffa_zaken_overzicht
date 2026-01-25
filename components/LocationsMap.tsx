'use client'

import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useState, useCallback } from 'react'
import { Location } from '@/types'
import Link from 'next/link'

interface LocationWithVisitInfo extends Location {
  visitCount?: number
  lastVisitDate?: string
  lastVisitStatus?: string
}

interface LocationsMapProps {
  locations: LocationWithVisitInfo[]
  center?: { lat: number; lng: number }
  zoom?: number
}

const mapContainerStyle = {
  width: '100%',
  height: '500px',
}

// Rotterdam center as default
const defaultCenter = {
  lat: 51.9244,
  lng: 4.4777,
}

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
}

export function LocationsMap({ locations, center = defaultCenter, zoom = 12 }: LocationsMapProps) {
  const [selectedLocation, setSelectedLocation] = useState<LocationWithVisitInfo | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
    
    // If we have locations with coordinates, fit bounds to show all
    const locationsWithCoords = locations.filter(l => l.latitude && l.longitude)
    if (locationsWithCoords.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      locationsWithCoords.forEach(location => {
        if (location.latitude && location.longitude) {
          bounds.extend({ lat: location.latitude, lng: location.longitude })
        }
      })
      map.fitBounds(bounds)
      // Add some padding after fit
      setTimeout(() => {
        if (map.getZoom() && map.getZoom()! > 15) {
          map.setZoom(15)
        }
      }, 100)
    }
  }, [locations])

  const getMarkerColor = (location: LocationWithVisitInfo) => {
    if (!location.lastVisitStatus) return 'red' // Not visited
    switch (location.lastVisitStatus) {
      case 'interested':
        return 'green'
      case 'demo_planned':
        return 'blue'
      case 'not_interested':
        return 'gray'
      default:
        return 'yellow' // Visited but no specific status
    }
  }

  const getMarkerIcon = (location: LocationWithVisitInfo) => {
    const color = getMarkerColor(location)
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 10,
    }
  }

  const locationsWithCoords = locations.filter(l => l.latitude && l.longitude)

  if (locationsWithCoords.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gray-100 rounded-lg">
        <div className="text-center">
          <p className="text-gray-600 font-medium">No locations with coordinates</p>
          <p className="text-sm text-gray-500 mt-1">Add coordinates to locations to see them on the map</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        options={mapOptions}
      >
        {locationsWithCoords.map(location => (
          <Marker
            key={location.id}
            position={{ lat: location.latitude!, lng: location.longitude! }}
            icon={getMarkerIcon(location)}
            onClick={() => setSelectedLocation(location)}
          />
        ))}

        {selectedLocation && selectedLocation.latitude && selectedLocation.longitude && (
          <InfoWindow
            position={{ lat: selectedLocation.latitude, lng: selectedLocation.longitude }}
            onCloseClick={() => setSelectedLocation(null)}
          >
            <div className="p-2 min-w-[200px]">
              <h3 className="font-bold text-gray-900">{selectedLocation.name}</h3>
              <p className="text-sm text-gray-600">{selectedLocation.city}</p>
              {selectedLocation.address && (
                <p className="text-sm text-gray-500 mt-1">{selectedLocation.address}</p>
              )}
              {selectedLocation.visitCount !== undefined && (
                <p className="text-sm mt-2">
                  <span className="font-medium">{selectedLocation.visitCount}</span> visit(s)
                </p>
              )}
              {selectedLocation.lastVisitDate && (
                <p className="text-sm text-gray-500">
                  Last visit: {new Date(selectedLocation.lastVisitDate).toLocaleDateString()}
                </p>
              )}
              {selectedLocation.lastVisitStatus && (
                <span className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full ${
                  selectedLocation.lastVisitStatus === 'interested' ? 'bg-green-100 text-green-800' :
                  selectedLocation.lastVisitStatus === 'demo_planned' ? 'bg-blue-100 text-blue-800' :
                  selectedLocation.lastVisitStatus === 'not_interested' ? 'bg-gray-100 text-gray-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedLocation.lastVisitStatus.replace('_', ' ')}
                </span>
              )}
              <div className="mt-3">
                <Link
                  href={`/locations?search=${encodeURIComponent(selectedLocation.name)}`}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                  View details
                </Link>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3">
        <p className="text-xs font-medium text-gray-700 mb-2">Status</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-600">Interested</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs text-gray-600">Demo Planned</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-gray-600">Visited</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-xs text-gray-600">Not Interested</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-600">Not Visited</span>
          </div>
        </div>
      </div>
    </div>
  )
}
