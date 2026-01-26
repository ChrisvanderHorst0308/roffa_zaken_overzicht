'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Location, VisitWithRelations } from '@/types'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, MapPin, Globe, Building2, Calendar, User, Plus, ExternalLink } from 'lucide-react'

export default function LocationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [location, setLocation] = useState<Location | null>(null)
  const [visits, setVisits] = useState<VisitWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      loadLocationData()
    }
  }, [params.id])

  const loadLocationData = async () => {
    try {
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
      }

      // Load location
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('*')
        .eq('id', params.id)
        .single()

      if (locationError) throw locationError
      setLocation(locationData)

      // Load visits for this location (filtered by project for recruiters)
      let visitsQuery = supabase
        .from('visits')
        .select(`
          *,
          location:locations(*),
          project:projects(*),
          recruiter:profiles(id, name, nickname)
        `)
        .eq('location_id', params.id)
        .order('visit_date', { ascending: false })

      if (!isAdmin && projectIds.length > 0) {
        visitsQuery = visitsQuery.in('project_id', projectIds)
      } else if (!isAdmin && projectIds.length === 0) {
        setVisits([])
        setLoading(false)
        return
      }

      const { data: visitsData, error: visitsError } = await visitsQuery
      if (visitsError) throw visitsError
      setVisits(visitsData || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load location')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'interested':
        return 'success'
      case 'potential':
        return 'warning'
      case 'demo_planned':
        return 'info'
      case 'already_client':
        return 'outline'
      case 'not_interested':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!location) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Location not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{location.name}</h1>
          <p className="text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-4 w-4" />
            {location.city}
            {location.address && ` • ${location.address}`}
          </p>
        </div>
        <Button asChild>
          <Link href={`/visits/new?location_id=${location.id}`}>
            <Plus className="mr-2 h-4 w-4" />
            New Visit
          </Link>
        </Button>
      </div>

      {/* Location Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Location Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">City</p>
              <p className="text-lg">{location.city}</p>
            </div>
            {location.address && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Address</p>
                <p className="text-lg">{location.address}</p>
              </div>
            )}
            {location.website && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Website</p>
                <a
                  href={location.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  {location.website.replace('https://', '').replace('http://', '')}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
            {location.pos_system && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">POS System</p>
                <p className="text-lg">{location.pos_system}</p>
              </div>
            )}
            {location.latitude && location.longitude && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Coordinates</p>
                <a
                  href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  Open in Google Maps
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Visit History */}
      <Card>
        <CardHeader>
          <CardTitle>Visit History</CardTitle>
          <CardDescription>
            {visits.length} visit(s) to this location
          </CardDescription>
        </CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No visits recorded for this location yet
            </div>
          ) : (
            <div className="space-y-4">
              {visits.map(visit => (
                <div
                  key={visit.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/visits/${visit.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={getStatusBadgeVariant(visit.status)}>
                          {visit.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(visit.visit_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <User className="h-4 w-4" />
                          {visit.recruiter?.nickname || visit.recruiter?.name || 'Unknown'}
                        </span>
                        <span className="text-muted-foreground">
                          Project: {visit.project?.name}
                        </span>
                        <span className="text-muted-foreground">
                          POS: {visit.pos_system}
                        </span>
                      </div>
                      {visit.notes && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {visit.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
