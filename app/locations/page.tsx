'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Location, Visit } from '@/types'
import toast from 'react-hot-toast'

interface LocationWithVisitInfo extends Location {
  lastVisitDate?: string
  visitedByMe: boolean
  recentVisitWarning: boolean
}

export default function LocationsPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<LocationWithVisitInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadLocations()
  }, [])

  const loadLocations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .order('name')

      if (locationsError) throw locationsError

      const { data: allVisits, error: visitsError } = await supabase
        .from('visits')
        .select('*')
        .order('visit_date', { ascending: false })

      if (visitsError) throw visitsError

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const locationsWithInfo: LocationWithVisitInfo[] = (locationsData || []).map(location => {
        const myVisits = (allVisits || []).filter(
          v => v.location_id === location.id && v.recruiter_id === user.id
        )
        const allRecentVisits = (allVisits || []).filter(
          v => v.location_id === location.id && new Date(v.visit_date) >= thirtyDaysAgo
        )

        const lastMyVisit = myVisits[0]
        const recentVisitWarning = allRecentVisits.length > 0 && 
          (!lastMyVisit || new Date(allRecentVisits[0].visit_date) > new Date(lastMyVisit.visit_date))

        return {
          ...location,
          visitedByMe: myVisits.length > 0,
          lastVisitDate: lastMyVisit?.visit_date,
          recentVisitWarning,
        }
      })

      setLocations(locationsWithInfo)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load locations')
    } finally {
      setLoading(false)
    }
  }

  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.city.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Locations</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or city..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-4">
          {filteredLocations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No locations found
            </div>
          ) : (
            filteredLocations.map(location => (
              <div
                key={location.id}
                onClick={() => router.push(`/locations/${location.id}`)}
                className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${
                  location.recentVisitWarning
                    ? 'border-yellow-400 bg-yellow-50 hover:bg-yellow-100'
                    : location.visitedByMe
                    ? 'border-green-200 bg-green-50 hover:bg-green-100'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {location.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {location.city}
                      {location.address && ` • ${location.address}`}
                    </p>
                    {location.website && (
                      <a
                        href={location.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:text-indigo-800 mt-1 inline-block"
                      >
                        {location.website}
                      </a>
                    )}
                    {location.pos_system && (
                      <p className="text-sm text-gray-500 mt-1">
                        POS: {location.pos_system}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-2">
                    {location.recentVisitWarning && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-200 text-yellow-800">
                        Recent Visit Warning
                      </span>
                    )}
                    {location.visitedByMe && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-800">
                        Visited by Me
                      </span>
                    )}
                    {location.lastVisitDate && (
                      <span className="text-xs text-gray-500">
                        Last visit: {new Date(location.lastVisitDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
