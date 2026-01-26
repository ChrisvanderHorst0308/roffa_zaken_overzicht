'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Location } from '@/types'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MapPin, Search, Building2 } from 'lucide-react'
import Link from 'next/link'

// Dynamic import for Leaflet (client-side only)
const LeafletMap = dynamic(() => import('@/components/LeafletMap').then(mod => mod.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px] bg-gray-100">
      <div className="text-gray-500">Loading map...</div>
    </div>
  )
})

interface LocationWithVisitInfo extends Location {
  visitCount?: number
  lastVisitDate?: string
  lastVisitStatus?: string
}

export default function MapPage() {
  const [locations, setLocations] = useState<LocationWithVisitInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCity, setSelectedCity] = useState<string>('all')
  const router = useRouter()

  useEffect(() => {
    loadLocations()
  }, [])

  const loadLocations = async () => {
    try {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Check user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const isAdmin = profile?.role === 'admin' || profile?.role === 'reichskanzlier' || profile?.role === 'fletcher_admin'

      let projectIds: string[] = []
      
      if (!isAdmin) {
        // Get assigned projects for recruiter
        const { data: assignments } = await supabase
          .from('recruiter_projects')
          .select('project_id')
          .eq('recruiter_id', user.id)
        
        projectIds = (assignments || []).map(a => a.project_id)
        
        if (projectIds.length === 0) {
          setLocations([])
          setLoading(false)
          return
        }
      }

      // Get visits (filtered by project for recruiters, all for admins)
      let visitsQuery = supabase
        .from('visits')
        .select('location_id, status, visit_date, project_id')
        .order('visit_date', { ascending: false })

      if (!isAdmin && projectIds.length > 0) {
        visitsQuery = visitsQuery.in('project_id', projectIds)
      }

      const { data: visitsData, error: visitsError } = await visitsQuery
      if (visitsError) throw visitsError

      // Get unique location IDs from visits (for recruiters, only from their projects)
      const visitedLocationIds = [...new Set((visitsData || []).map(v => v.location_id))]

      // Get locations with coordinates
      let locationsQuery = supabase
        .from('locations')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('name')

      // For recruiters, only show locations that have visits from their projects
      if (!isAdmin && visitedLocationIds.length > 0) {
        locationsQuery = locationsQuery.in('id', visitedLocationIds)
      } else if (!isAdmin && visitedLocationIds.length === 0) {
        setLocations([])
        setLoading(false)
        return
      }

      const { data: locationsData, error: locationsError } = await locationsQuery
      if (locationsError) throw locationsError

      // Merge visit info with locations
      const locationsWithVisits: LocationWithVisitInfo[] = (locationsData || []).map(location => {
        const locationVisits = visitsData?.filter(v => v.location_id === location.id) || []
        const lastVisit = locationVisits[0]
        
        return {
          ...location,
          visitCount: locationVisits.length,
          lastVisitDate: lastVisit?.visit_date,
          lastVisitStatus: lastVisit?.status,
        }
      })

      setLocations(locationsWithVisits)
    } catch (error) {
      console.error('Error loading locations:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get unique cities for filter
  const cities = [...new Set(locations.map(l => l.city))].sort()

  // Filter locations
  const filteredLocations = locations.filter(location => {
    const matchesSearch = location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          location.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (location.address?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    const matchesCity = selectedCity === 'all' || location.city === selectedCity
    return matchesSearch && matchesCity
  })

  // Stats
  const stats = {
    total: filteredLocations.length,
    visited: filteredLocations.filter(l => l.visitCount && l.visitCount > 0).length,
    interested: filteredLocations.filter(l => l.lastVisitStatus === 'interested').length,
    demoPlanned: filteredLocations.filter(l => l.lastVisitStatus === 'demo_planned').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading map...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-8 w-8" />
            Locations Map
          </h1>
          <p className="text-muted-foreground mt-1">
            View all locations on the map
          </p>
        </div>
        <Link
          href="/locations"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          View as list
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visited</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.visited}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interested</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.interested}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Demo Planned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.demoPlanned}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search locations..."
                className="pl-10"
              />
            </div>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      <Card>
        <CardHeader>
          <CardTitle>Map View</CardTitle>
          <CardDescription>
            Click on a marker to see location details
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden rounded-b-lg">
          <LeafletMap locations={filteredLocations} />
        </CardContent>
      </Card>

      {/* Location List */}
      <Card>
        <CardHeader>
          <CardTitle>Locations with Coordinates ({filteredLocations.length})</CardTitle>
          <CardDescription>
            Locations displayed on the map above
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLocations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No locations with coordinates found. Add coordinates to locations to see them on the map.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLocations.slice(0, 12).map(location => (
                <div
                  key={location.id}
                  className="border rounded-lg p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => router.push(`/locations?search=${encodeURIComponent(location.name)}`)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{location.name}</h3>
                      <p className="text-sm text-muted-foreground">{location.city}</p>
                    </div>
                    {location.lastVisitStatus && (
                      <Badge variant={
                        location.lastVisitStatus === 'interested' ? 'success' :
                        location.lastVisitStatus === 'demo_planned' ? 'info' :
                        location.lastVisitStatus === 'not_interested' ? 'secondary' :
                        'default'
                      }>
                        {location.lastVisitStatus.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  {location.visitCount !== undefined && location.visitCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {location.visitCount} visit(s)
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {filteredLocations.length > 12 && (
            <div className="text-center mt-4">
              <Link href="/locations" className="text-sm text-indigo-600 hover:text-indigo-800">
                View all {filteredLocations.length} locations
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
