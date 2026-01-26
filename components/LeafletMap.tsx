'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Location } from '@/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Fix for default marker icons in Leaflet with Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Custom colored markers
const createColoredIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  })
}

const greenIcon = createColoredIcon('#22c55e')
const blueIcon = createColoredIcon('#3b82f6')
const yellowIcon = createColoredIcon('#eab308')
const grayIcon = createColoredIcon('#6b7280')
const redIcon = createColoredIcon('#ef4444')

interface LocationWithVisitInfo extends Location {
  visitCount?: number
  lastVisitDate?: string
  lastVisitStatus?: string
}

interface LeafletMapProps {
  locations: LocationWithVisitInfo[]
}

export function LeafletMap({ locations }: LeafletMapProps) {
  const [isMounted, setIsMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
    L.Marker.prototype.options.icon = DefaultIcon
  }, [])

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gray-100">
        <div className="text-gray-500">Loading map...</div>
      </div>
    )
  }

  const locationsWithCoords = locations.filter(l => l.latitude && l.longitude)

  if (locationsWithCoords.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gray-100">
        <div className="text-center p-6">
          <p className="text-gray-600 font-medium">No locations with coordinates</p>
          <p className="text-sm text-gray-500 mt-1">Add coordinates to locations to see them on the map</p>
        </div>
      </div>
    )
  }

  // Calculate center from locations
  const avgLat = locationsWithCoords.reduce((sum, l) => sum + (l.latitude || 0), 0) / locationsWithCoords.length
  const avgLng = locationsWithCoords.reduce((sum, l) => sum + (l.longitude || 0), 0) / locationsWithCoords.length

  const getMarkerIcon = (location: LocationWithVisitInfo) => {
    if (!location.lastVisitStatus) return redIcon
    switch (location.lastVisitStatus) {
      case 'interested':
        return greenIcon
      case 'demo_planned':
        return blueIcon
      case 'not_interested':
        return grayIcon
      default:
        return yellowIcon
    }
  }

  return (
    <div className="relative">
      <MapContainer
        center={[avgLat || 51.9244, avgLng || 4.4777]}
        zoom={12}
        style={{ height: '500px', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locationsWithCoords.map(location => (
          <Marker
            key={location.id}
            position={[location.latitude!, location.longitude!]}
            icon={getMarkerIcon(location)}
            eventHandlers={{
              click: () => {
                router.push(`/locations/${location.id}`)
              }
            }}
          >
            <Popup>
              <div className="p-1 min-w-[180px]">
                <h3 className="font-bold text-gray-900">{location.name}</h3>
                <p className="text-sm text-gray-600">{location.city}</p>
                {location.address && (
                  <p className="text-sm text-gray-500 mt-1">{location.address}</p>
                )}
                {location.visitCount !== undefined && (
                  <p className="text-sm mt-2">
                    <span className="font-medium">{location.visitCount}</span> visit(s)
                  </p>
                )}
                {location.lastVisitDate && (
                  <p className="text-sm text-gray-500">
                    Last visit: {new Date(location.lastVisitDate).toLocaleDateString()}
                  </p>
                )}
                {location.lastVisitStatus && (
                  <span className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full ${
                    location.lastVisitStatus === 'interested' ? 'bg-green-100 text-green-800' :
                    location.lastVisitStatus === 'demo_planned' ? 'bg-blue-100 text-blue-800' :
                    location.lastVisitStatus === 'not_interested' ? 'bg-gray-100 text-gray-800' :
                    location.lastVisitStatus === 'potential' ? 'bg-orange-100 text-orange-800' :
                    location.lastVisitStatus === 'already_client' ? 'bg-purple-100 text-purple-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {location.lastVisitStatus.replace('_', ' ')}
                  </span>
                )}
                <div className="mt-3">
                  <Link
                    href={`/locations/${location.id}`}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    View details
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
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
