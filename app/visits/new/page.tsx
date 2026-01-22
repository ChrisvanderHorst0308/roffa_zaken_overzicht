'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Project, Location, VisitStatus } from '@/types'
import toast from 'react-hot-toast'
import Modal from '@/components/Modal'

export default function NewVisitPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [locationSearch, setLocationSearch] = useState('')
  const [showCreateLocation, setShowCreateLocation] = useState(false)
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false)
  const [overlapModalOpen, setOverlapModalOpen] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null)
  const [overlapInfo, setOverlapInfo] = useState<any>(null)

  const [formData, setFormData] = useState({
    project_id: '',
    location_id: '',
    location_name: '',
    location_city: '',
    location_address: '',
    location_website: '',
    pos_system: '',
    spoken_to: '',
    takeaway: false,
    delivery: false,
    takeaway_platforms: '',
    delivery_platforms: '',
    notes: '',
    status: 'visited' as VisitStatus,
    visit_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'admin') {
        const { data: projectsData } = await supabase
          .from('projects')
          .select('*')
          .eq('active', true)
          .order('name')
        setProjects(projectsData || [])
      } else {
        const { data: projectsData } = await supabase
          .from('projects')
          .select(`
            *,
            recruiter_projects!inner(recruiter_id)
          `)
          .eq('recruiter_projects.recruiter_id', user.id)
          .eq('active', true)
          .order('name')
        setProjects(projectsData || [])
      }

      const { data: locationsData } = await supabase
        .from('locations')
        .select('*')
        .order('name')
      setLocations(locationsData || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(locationSearch.toLowerCase()) ||
    loc.city.toLowerCase().includes(locationSearch.toLowerCase())
  )

  const checkDuplicatesAndOverlaps = async (locationId: string, visitDate: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { hasDuplicate: false, hasOverlap: false }

    const visitDateObj = new Date(visitDate)
    const sixtyDaysAgo = new Date(visitDateObj)
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const thirtyDaysAgo = new Date(visitDateObj)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: myRecentVisits } = await supabase
      .from('visits')
      .select('*')
      .eq('location_id', locationId)
      .eq('recruiter_id', user.id)
      .gte('visit_date', sixtyDaysAgo.toISOString().split('T')[0])
      .order('visit_date', { ascending: false })
      .limit(1)

    const { data: allRecentVisits } = await supabase
      .from('visits')
      .select(`
        *,
        recruiter:profiles(name)
      `)
      .eq('location_id', locationId)
      .gte('visit_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('visit_date', { ascending: false })
      .limit(5)

    const hasDuplicate = myRecentVisits && myRecentVisits.length > 0
    const hasOverlap = allRecentVisits && allRecentVisits.length > 0 && 
      (!myRecentVisits || myRecentVisits.length === 0 || 
       new Date(allRecentVisits[0].visit_date) > new Date(myRecentVisits[0].visit_date))

    return {
      hasDuplicate,
      hasOverlap,
      duplicateInfo: myRecentVisits?.[0],
      overlapInfo: allRecentVisits?.[0],
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      let locationId = formData.location_id

      if (!locationId && formData.location_name && formData.location_city) {
        const { data: existingLocation } = await supabase
          .from('locations')
          .select('*')
          .ilike('name', formData.location_name)
          .ilike('city', formData.location_city)
          .single()

        if (existingLocation) {
          locationId = existingLocation.id
        } else {
          const { data: newLocation, error: locationError } = await supabase
            .from('locations')
            .insert({
              name: formData.location_name,
              city: formData.location_city,
              address: formData.location_address || null,
              website: formData.location_website || null,
            })
            .select()
            .single()

          if (locationError) {
            if (locationError.code === '23505') {
              toast.error('Location with this name and city already exists')
            } else {
              throw locationError
            }
            return
          }
          locationId = newLocation.id
        }
      }

      if (!locationId) {
        toast.error('Please select or create a location')
        return
      }

      const checks = await checkDuplicatesAndOverlaps(locationId, formData.visit_date)
      
      if (checks.hasDuplicate) {
        setDuplicateInfo(checks.duplicateInfo)
        setDuplicateModalOpen(true)
        setSubmitting(false)
        return
      }

      if (checks.hasOverlap) {
        setOverlapInfo(checks.overlapInfo)
        setOverlapModalOpen(true)
        setSubmitting(false)
        return
      }

      await createVisit(locationId, user.id)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create visit')
    } finally {
      setSubmitting(false)
    }
  }

  const createVisit = async (locationId: string, userId: string) => {
    const { error } = await supabase
      .from('visits')
      .insert({
        recruiter_id: userId,
        project_id: formData.project_id,
        location_id: locationId,
        pos_system: formData.pos_system,
        spoken_to: formData.spoken_to,
        takeaway: formData.takeaway,
        delivery: formData.delivery,
        takeaway_platforms: formData.takeaway_platforms || null,
        delivery_platforms: formData.delivery_platforms || null,
        notes: formData.notes || null,
        status: formData.status,
        visit_date: formData.visit_date,
      })

    if (error) throw error

    toast.success('Visit created successfully')
    router.push('/dashboard')
  }

  const handleProceedWithOverlap = async () => {
    setOverlapModalOpen(false)
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let locationId = formData.location_id
      if (!locationId && formData.location_name && formData.location_city) {
        const { data: existingLocation } = await supabase
          .from('locations')
          .select('*')
          .ilike('name', formData.location_name)
          .ilike('city', formData.location_city)
          .single()

        if (existingLocation) {
          locationId = existingLocation.id
        } else {
          const { data: newLocation } = await supabase
            .from('locations')
            .insert({
              name: formData.location_name,
              city: formData.location_city,
              address: formData.location_address || null,
              website: formData.location_website || null,
            })
            .select()
            .single()
          locationId = newLocation.id
        }
      }

      await createVisit(locationId, user.id)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create visit')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">New Visit</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project *
          </label>
          <select
            required
            value={formData.project_id}
            onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select a project</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location *
          </label>
          {!showCreateLocation ? (
            <div className="space-y-2">
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search locations..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {locationSearch && (
                <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                  {filteredLocations.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">
                      No locations found. <button
                        type="button"
                        onClick={() => setShowCreateLocation(true)}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        Create new location
                      </button>
                    </div>
                  ) : (
                    filteredLocations.map(location => (
                      <button
                        key={location.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, location_id: location.id })
                          setLocationSearch('')
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                          formData.location_id === location.id ? 'bg-indigo-50' : ''
                        }`}
                      >
                        {location.name}, {location.city}
                      </button>
                    ))
                  )}
                </div>
              )}
              {formData.location_id && (
                <div className="mt-2 text-sm text-gray-600">
                  Selected: {locations.find(l => l.id === formData.location_id)?.name}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowCreateLocation(true)}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
              >
                + Create new location
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateLocation(false)
                  setFormData({ ...formData, location_id: '', location_name: '', location_city: '', location_address: '', location_website: '' })
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                ← Search existing location
              </button>
              <input
                type="text"
                required
                value={formData.location_name}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                placeholder="Location name *"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                required
                value={formData.location_city}
                onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
                placeholder="City *"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={formData.location_address}
                onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                placeholder="Address"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="url"
                value={formData.location_website}
                onChange={(e) => setFormData({ ...formData, location_website: e.target.value })}
                placeholder="Website"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            POS System *
          </label>
          <input
            type="text"
            required
            value={formData.pos_system}
            onChange={(e) => setFormData({ ...formData, pos_system: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Spoken To *
          </label>
          <input
            type="text"
            required
            value={formData.spoken_to}
            onChange={(e) => setFormData({ ...formData, spoken_to: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.takeaway}
              onChange={(e) => setFormData({ ...formData, takeaway: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700">Takeaway</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.delivery}
              onChange={(e) => setFormData({ ...formData, delivery: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700">Delivery</span>
          </label>
        </div>

        {formData.takeaway && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Takeaway Platforms
            </label>
            <input
              type="text"
              value={formData.takeaway_platforms}
              onChange={(e) => setFormData({ ...formData, takeaway_platforms: e.target.value })}
              placeholder="e.g. Uber Eats, Thuisbezorgd"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {formData.delivery && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Platforms
            </label>
            <input
              type="text"
              value={formData.delivery_platforms}
              onChange={(e) => setFormData({ ...formData, delivery_platforms: e.target.value })}
              placeholder="e.g. Deliveroo, Just Eat"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status *
          </label>
          <select
            required
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as VisitStatus })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="visited">Visited</option>
            <option value="interested">Interested</option>
            <option value="demo_planned">Demo Planned</option>
            <option value="not_interested">Not Interested</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Visit Date *
          </label>
          <input
            type="date"
            required
            value={formData.visit_date}
            onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Visit'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
        </div>
      </form>

      <Modal
        isOpen={duplicateModalOpen}
        onClose={() => setDuplicateModalOpen(false)}
        title="Already Visited"
        showCloseButton={true}
      >
        <div className="space-y-4">
          <p className="text-red-600">
            You have already visited this location in the last 60 days.
          </p>
          {duplicateInfo && (
            <div className="text-sm text-gray-600">
              <p>Previous visit date: {new Date(duplicateInfo.visit_date).toLocaleDateString()}</p>
              <p>Status: {duplicateInfo.status}</p>
            </div>
          )}
          <p className="text-sm text-gray-500">
            Please wait before visiting this location again, or contact an admin if this is necessary.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={overlapModalOpen}
        onClose={() => setOverlapModalOpen(false)}
        title="Possible Overlap"
        showCloseButton={false}
      >
        <div className="space-y-4">
          <p className="text-yellow-600">
            Another recruiter visited this location in the last 30 days.
          </p>
          {overlapInfo && (
            <div className="text-sm text-gray-600">
              <p>Previous visit date: {new Date(overlapInfo.visit_date).toLocaleDateString()}</p>
              <p>Recruiter: {overlapInfo.recruiter?.name || 'Unknown'}</p>
            </div>
          )}
          <p className="text-sm text-gray-500">
            You can still proceed, but please coordinate with other recruiters to avoid conflicts.
          </p>
          <div className="flex space-x-4">
            <button
              onClick={handleProceedWithOverlap}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              Proceed Anyway
            </button>
            <button
              onClick={() => setOverlapModalOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
