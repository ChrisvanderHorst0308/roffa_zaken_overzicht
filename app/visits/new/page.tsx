'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Project, Location, VisitStatus, Contact, VisitNextStep } from '@/types'
import { createNextStepCalendarUrl } from '@/lib/googleCalendar'
import toast from 'react-hot-toast'
import Modal from '@/components/Modal'
import { MapPin, Building2, Globe, Navigation, Search, Loader2, Monitor, User, Phone, Mail, Briefcase, UserPlus, Users, Pencil, StickyNote, ListChecks, CalendarPlus, Trash2 } from 'lucide-react'

// POS Systems list
const POS_SYSTEMS = [
  { id: 'lightspeed-k', name: 'Lightspeed K' },
  { id: 'lightspeed', name: 'Lightspeed' },
  { id: 'vectron', name: 'Vectron' },
  { id: 'untill', name: 'unTill' },
  { id: 'mpluskassa', name: 'MplusKASSA' },
  { id: 'bork', name: 'Bork' },
  { id: 'trivec', name: 'Trivec' },
  { id: 'matrix', name: 'Matrix' },
  { id: 'povis', name: 'Povis' },
  { id: 'micas', name: 'Micas' },
  { id: 'orderli', name: 'Orderli Standalone' },
  { id: 'webhook-api', name: 'Webhook API' },
  { id: 'other', name: 'Overig' },
]

// OpenStreetMap search result type
interface OSMResult {
  place_id: number
  display_name: string
  name?: string
  lat: string
  lon: string
  address?: {
    name?: string
    amenity?: string
    shop?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    road?: string
    house_number?: string
    postcode?: string
  }
  type?: string
  class?: string
}

// Helper function to normalize website URL
const normalizeWebsiteUrl = (url: string | null | undefined): string | null => {
  if (!url || url.trim() === '') return null
  const trimmed = url.trim()
  // If it already has a protocol, return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  // Otherwise, add https://
  return `https://${trimmed}`
}

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
  
  // OpenStreetMap search state
  const [osmSearch, setOsmSearch] = useState('')
  const [osmResults, setOsmResults] = useState<OSMResult[]>([])
  const [osmLoading, setOsmLoading] = useState(false)
  const [showOsmResults, setShowOsmResults] = useState(false)
  
  // POS system state
  const [selectedPosId, setSelectedPosId] = useState<string>('')
  const [customPosName, setCustomPosName] = useState('')

  // Contact person state (CRM-style: list, add, edit, quick-save)
  const [locationContacts, setLocationContacts] = useState<Contact[]>([])
  const [showCreateContact, setShowCreateContact] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [savingContact, setSavingContact] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [contactData, setContactData] = useState({
    contact_id: '',
    contact_name: '',
    contact_function: '',
    contact_phone: '',
    contact_email: '',
    contact_notes: '',
  })

  const [nextSteps, setNextSteps] = useState<VisitNextStep[]>([])

  const [formData, setFormData] = useState({
    project_id: '',
    location_id: '',
    location_name: '',
    location_city: '',
    location_address: '',
    location_website: '',
    location_lat: null as number | null,
    location_lng: null as number | null,
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

  // Debounced OpenStreetMap search
  useEffect(() => {
    if (!osmSearch || osmSearch.length < 3) {
      setOsmResults([])
      setShowOsmResults(false)
      return
    }

    const timeoutId = setTimeout(async () => {
      setOsmLoading(true)
      try {
        // Search for establishments in Netherlands
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(osmSearch + ' Netherlands')}&` +
          `format=json&` +
          `addressdetails=1&` +
          `limit=8&` +
          `countrycodes=nl`
        )
        const data = await response.json()
        setOsmResults(data)
        setShowOsmResults(true)
      } catch (error) {
        console.error('OSM search error:', error)
      } finally {
        setOsmLoading(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [osmSearch])

  const selectOsmResult = (result: OSMResult) => {
    const city = result.address?.city || 
                 result.address?.town || 
                 result.address?.village || 
                 result.address?.municipality || ''
    
    const streetAddress = [
      result.address?.road,
      result.address?.house_number
    ].filter(Boolean).join(' ')

    const name = result.address?.name || 
                 result.address?.amenity || 
                 result.address?.shop ||
                 result.display_name.split(',')[0]

    setFormData(prev => ({
      ...prev,
      location_name: name,
      location_city: city,
      location_address: streetAddress || result.display_name.split(',').slice(0, 2).join(','),
      location_lat: parseFloat(result.lat),
      location_lng: parseFloat(result.lon),
    }))

    setOsmSearch('')
    setShowOsmResults(false)
    toast.success('Location details filled!')
  }

  const handlePosSelect = (posId: string) => {
    setSelectedPosId(posId)
    if (posId !== 'other') {
      const pos = POS_SYSTEMS.find(p => p.id === posId)
      setFormData(prev => ({ ...prev, pos_system: pos?.name || '' }))
      setCustomPosName('')
    } else {
      setFormData(prev => ({ ...prev, pos_system: '' }))
    }
  }

  const handleCustomPosChange = (name: string) => {
    setCustomPosName(name)
    setFormData(prev => ({ ...prev, pos_system: name }))
  }

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

      setUserId(user.id)
      const adminRoles = profile?.role === 'admin' || profile?.role === 'reichskanzlier' || profile?.role === 'fletcher_admin'
      setIsAdminUser(!!adminRoles)

      if (adminRoles) {
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

  const hasLocationContext = !!(
    formData.location_id ||
    (formData.location_name.trim() !== '' && formData.location_city.trim() !== '')
  )

  // Load contacts for selected location
  const canEditContact = (contact: Contact) =>
    !!(userId && (contact.created_by === userId || isAdminUser))

  const loadContactsForLocation = async (locationId: string) => {
    if (!locationId) {
      setLocationContacts([])
      return
    }
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('location_id', locationId)
        .order('name')
      
      if (error) throw error
      setLocationContacts(data || [])
    } catch (error) {
      console.error('Error loading contacts:', error)
      setLocationContacts([])
    }
  }

  const resetContactFormFields = () => {
    setContactData({
      contact_id: '',
      contact_name: '',
      contact_function: '',
      contact_phone: '',
      contact_email: '',
      contact_notes: '',
    })
    setEditingContactId(null)
  }

  const exitContactForm = () => {
    resetContactFormFields()
    if (locationContacts.length > 0) {
      setShowCreateContact(false)
    }
  }

  const startEditContact = (contact: Contact) => {
    setEditingContactId(contact.id)
    setShowCreateContact(true)
    setContactData({
      contact_id: contact.id,
      contact_name: contact.name,
      contact_function: contact.function || '',
      contact_phone: contact.phone || '',
      contact_email: contact.email || '',
      contact_notes: contact.notes || '',
    })
    setFormData(prev => ({ ...prev, spoken_to: contact.name }))
  }

  const saveEditedContact = async () => {
    if (!editingContactId || !formData.location_id) {
      toast.error('Selecteer eerst een opgeslagen locatie om contacten te bewerken.')
      return
    }
    if (!contactData.contact_name.trim()) {
      toast.error('Vul een naam in.')
      return
    }
    setSavingContact(true)
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: contactData.contact_name.trim(),
          function: contactData.contact_function.trim() || null,
          phone: contactData.contact_phone.trim() || null,
          email: contactData.contact_email.trim() || null,
          notes: contactData.contact_notes.trim() || null,
        })
        .eq('id', editingContactId)

      if (error) throw error
      toast.success('Contact bijgewerkt')
      await loadContactsForLocation(formData.location_id)
      setContactData({
        contact_id: editingContactId,
        contact_name: contactData.contact_name.trim(),
        contact_function: contactData.contact_function.trim(),
        contact_phone: contactData.contact_phone.trim(),
        contact_email: contactData.contact_email.trim(),
        contact_notes: contactData.contact_notes.trim(),
      })
      setEditingContactId(null)
      setShowCreateContact(false)
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Kon contact niet opslaan')
    } finally {
      setSavingContact(false)
    }
  }

  const saveNewContactNow = async () => {
    if (!formData.location_id) {
      toast.error('Sla de locatie eerst op door een bestaande locatie te kiezen, of rond de visit af — nieuwe locaties krijgen contacten bij het aanmaken van de visit.')
      return
    }
    if (!userId) return
    if (!contactData.contact_name.trim()) {
      toast.error('Vul minimaal een naam in.')
      return
    }
    setSavingContact(true)
    try {
      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          location_id: formData.location_id,
          name: contactData.contact_name.trim(),
          function: contactData.contact_function.trim() || null,
          phone: contactData.contact_phone.trim() || null,
          email: contactData.contact_email.trim() || null,
          notes: contactData.contact_notes.trim() || null,
          created_by: userId,
        })
        .select()
        .single()

      if (error) throw error
      toast.success('Contact opgeslagen')
      await loadContactsForLocation(formData.location_id)
      setContactData({
        contact_id: newContact.id,
        contact_name: newContact.name,
        contact_function: newContact.function || '',
        contact_phone: newContact.phone || '',
        contact_email: newContact.email || '',
        contact_notes: newContact.notes || '',
      })
      setFormData(prev => ({ ...prev, spoken_to: newContact.name }))
      setEditingContactId(null)
      setShowCreateContact(false)
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Kon contact niet opslaan')
    } finally {
      setSavingContact(false)
    }
  }

  const getCalendarContext = () => {
    if (formData.location_id) {
      const loc = locations.find(l => l.id === formData.location_id)
      if (loc) {
        return {
          locationName: loc.name,
          locationCity: loc.city,
          locationAddress: loc.address,
        }
      }
    }
    return {
      locationName: formData.location_name.trim() || 'Locatie',
      locationCity: formData.location_city.trim() || null,
      locationAddress: formData.location_address?.trim() || null,
    }
  }

  const projectNameForCalendar = () =>
    projects.find(p => p.id === formData.project_id)?.name ?? null

  const openNextStepInCalendar = (step: VisitNextStep) => {
    if (!step.title.trim()) {
      toast.error('Vul eerst een titel in voor deze stap')
      return
    }
    const ctx = getCalendarContext()
    const url = createNextStepCalendarUrl({
      stepTitle: step.title,
      stepNotes: step.notes,
      projectName: projectNameForCalendar(),
      locationName: ctx.locationName,
      locationCity: ctx.locationCity,
      locationAddress: ctx.locationAddress,
      dueDate: step.due_date,
      dueTime: step.due_time,
    })
    window.open(url, '_blank', 'noopener,noreferrer')
    toast.success('Google Agenda wordt geopend…')
  }

  const addNextStepRow = () => {
    const id =
      typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID
        ? globalThis.crypto.randomUUID()
        : `step-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setNextSteps(prev => [
      ...prev,
      {
        id,
        title: '',
        due_date: null,
        due_time: '09:00',
        notes: null,
      },
    ])
  }

  const removeNextStepRow = (id: string) => {
    setNextSteps(prev => prev.filter(s => s.id !== id))
  }

  const updateNextStep = (id: string, patch: Partial<VisitNextStep>) => {
    setNextSteps(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }

  // Handle location selection
  const handleLocationSelect = async (locationId: string) => {
    setFormData(prev => ({ ...prev, location_id: locationId }))
    setLocationSearch('')
    resetContactFormFields()
    setShowCreateContact(false)
    await loadContactsForLocation(locationId)
  }

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
              website: normalizeWebsiteUrl(formData.location_website),
              latitude: formData.location_lat,
              longitude: formData.location_lng,
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
    let contactId: string | null = null

    // If there's a new contact to create (has name but no existing contact_id selected)
    if (contactData.contact_name && !contactData.contact_id) {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          location_id: locationId,
          name: contactData.contact_name,
          function: contactData.contact_function || null,
          phone: contactData.contact_phone || null,
          email: contactData.contact_email || null,
          notes: contactData.contact_notes.trim() || null,
          created_by: userId,
        })
        .select()
        .single()

      if (contactError) {
        console.error('Error creating contact:', contactError)
        // Don't fail the visit creation, just skip the contact
      } else {
        contactId = newContact.id
        toast.success('Contactpersoon aangemaakt')
      }
    } else if (contactData.contact_id) {
      contactId = contactData.contact_id
      const { error: syncErr } = await supabase
        .from('contacts')
        .update({
          name: contactData.contact_name.trim(),
          function: contactData.contact_function.trim() || null,
          phone: contactData.contact_phone.trim() || null,
          email: contactData.contact_email.trim() || null,
          notes: contactData.contact_notes.trim() || null,
        })
        .eq('id', contactId)
      if (syncErr) {
        console.warn('Contact sync skipped (permissions or unchanged):', syncErr.message)
      }
    }

    const stepsPayload = nextSteps
      .filter(s => s.title.trim() !== '')
      .map(s => ({
        id: s.id,
        title: s.title.trim(),
        due_date: s.due_date || null,
        due_time: s.due_time && s.due_time.trim() !== '' ? s.due_time : null,
        notes: s.notes?.trim() || null,
      }))

    const { error } = await supabase
      .from('visits')
      .insert({
        recruiter_id: userId,
        project_id: formData.project_id,
        location_id: locationId,
        contact_id: contactId,
        pos_system: formData.pos_system,
        spoken_to: formData.spoken_to,
        takeaway: formData.takeaway,
        delivery: formData.delivery,
        takeaway_platforms: formData.takeaway_platforms || null,
        delivery_platforms: formData.delivery_platforms || null,
        notes: formData.notes || null,
        status: formData.status,
        visit_date: formData.visit_date,
        next_steps: stepsPayload,
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
              website: normalizeWebsiteUrl(formData.location_website),
              latitude: formData.location_lat,
              longitude: formData.location_lng,
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
                        onClick={() => handleLocationSelect(location.id)}
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
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateLocation(false)
                  setFormData({ ...formData, location_id: '', location_name: '', location_city: '', location_address: '', location_website: '', location_lat: null, location_lng: null })
                }}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
              >
                ← Search existing location
              </button>

              {/* OpenStreetMap Search */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search location
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={osmSearch}
                    onChange={(e) => setOsmSearch(e.target.value)}
                    placeholder="Search restaurant, cafe, bar in Netherlands..."
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white pr-10"
                  />
                  {osmLoading && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin" />
                  )}
                </div>
                
                {/* Search Results */}
                {showOsmResults && osmResults.length > 0 && (
                  <div className="mt-2 border border-blue-200 rounded-md bg-white max-h-48 overflow-y-auto">
                    {osmResults.map((result) => (
                      <button
                        key={result.place_id}
                        type="button"
                        onClick={() => selectOsmResult(result)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-blue-100 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {result.address?.name || result.address?.amenity || result.display_name.split(',')[0]}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {result.display_name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {showOsmResults && osmResults.length === 0 && !osmLoading && osmSearch.length >= 3 && (
                  <div className="mt-2 text-sm text-gray-500">
                    No results found. Try a different search term.
                  </div>
                )}
                
                <p className="text-xs text-blue-600 mt-2">
                  Type at least 3 characters to search. Select a result to auto-fill fields with coordinates.
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-500 mb-3">Or fill in manually:</p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.location_name}
                    onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                    placeholder="Location name *"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.location_city}
                    onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
                    placeholder="City *"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div className="relative">
                  <Navigation className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.location_address}
                    onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                    placeholder="Address (optional)"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.location_website}
                    onChange={(e) => setFormData({ ...formData, location_website: e.target.value })}
                    placeholder="Website (optional, bijv. orderli.com)"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contact Person Section (CRM-style) — altijd zichtbaar; actief na locatiekeuze */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
              <div>
                <label className="block text-sm font-medium text-green-800 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Contactpersoon
                </label>
                <p className="text-xs text-green-700/90 mt-1">
                  {hasLocationContext
                    ? 'Koppel een contact aan deze visit — voeg toe, bewerk bestaande gegevens, of kies uit het adresboek van deze locatie.'
                    : 'Zodra je hieronder een locatie hebt gekozen (of naam + stad bij een nieuwe locatie), kun je contactpersonen toevoegen of uit het adresboek kiezen.'}
                </p>
              </div>
              {hasLocationContext && formData.location_id && !showCreateContact && locationContacts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingContactId(null)
                    setShowCreateContact(true)
                    setContactData({
                      contact_id: '',
                      contact_name: '',
                      contact_function: '',
                      contact_phone: '',
                      contact_email: '',
                      contact_notes: '',
                    })
                  }}
                  className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-md border border-green-600 bg-white px-3 py-2 text-sm font-medium text-green-800 shadow-sm hover:bg-green-100"
                >
                  <UserPlus className="h-4 w-4" />
                  + Contact toevoegen
                </button>
              )}
            </div>

            {!hasLocationContext ? (
              <div className="rounded-lg border border-dashed border-green-300 bg-white/70 px-4 py-4 text-sm text-green-900">
                <p className="font-medium mb-2">Eerst een locatie kiezen</p>
                <ul className="list-disc list-inside space-y-1 text-green-800/90">
                  <li>Zoek en selecteer een bestaande locatie hierboven, of</li>
                  <li>
                    klik op <span className="font-semibold">+ Create new location</span> en vul minimaal{' '}
                    <span className="font-semibold">naam</span> en <span className="font-semibold">stad</span> in.
                  </li>
                </ul>
                <p className="mt-3 text-xs text-green-700">
                  Daarna verschijnen hier het adresboek en het formulier om contactpersonen toe te voegen of te bewerken.
                </p>
              </div>
            ) : (
            <>
            {/* List existing contacts */}
            {formData.location_id && locationContacts.length > 0 && !showCreateContact && (
              <div className="space-y-3">
                <p className="text-sm text-green-800 font-medium">Adresboek van deze locatie</p>
                <div className="space-y-2">
                  {locationContacts.map(contact => (
                    <div
                      key={contact.id}
                      className={`flex items-stretch gap-2 rounded-lg border-2 transition-all ${
                        contactData.contact_id === contact.id
                          ? 'border-green-500 bg-green-100'
                          : 'border-green-200 bg-white hover:border-green-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setContactData({
                            contact_id: contact.id,
                            contact_name: contact.name,
                            contact_function: contact.function || '',
                            contact_phone: contact.phone || '',
                            contact_email: contact.email || '',
                            contact_notes: contact.notes || '',
                          })
                          setFormData(prev => ({ ...prev, spoken_to: contact.name }))
                        }}
                        className="flex-1 text-left px-3 py-3 min-w-0"
                      >
                        <div className="flex items-start gap-3">
                          <User className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900">{contact.name}</div>
                            <div className="text-sm text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                              {contact.function && <span>{contact.function}</span>}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  {contact.phone}
                                </span>
                              )}
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  {contact.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                      {canEditContact(contact) && (
                        <button
                          type="button"
                          title="Contact bewerken"
                          onClick={e => {
                            e.preventDefault()
                            startEditContact(contact)
                          }}
                          className="shrink-0 px-3 py-2 border-l border-green-200 text-green-800 hover:bg-green-50 rounded-r-md"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create / edit contact form */}
            {(showCreateContact || !formData.location_id || locationContacts.length === 0) && (
              <div className="space-y-3 mt-2">
                {formData.location_id && locationContacts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => exitContactForm()}
                    className="text-sm text-green-600 hover:text-green-700"
                  >
                    ← Terug naar adresboek
                  </button>
                )}

                <p className="text-sm text-green-800 font-medium">
                  {editingContactId
                    ? 'Contact bewerken'
                    : formData.location_id && locationContacts.length === 0
                      ? 'Nog geen contactpersonen voor deze locatie. Voeg er een toe:'
                      : 'Nieuwe contactpersoon — vul de gegevens in:'}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={contactData.contact_name}
                      onChange={(e) => {
                        const v = e.target.value
                        setContactData((prev) => ({
                          ...prev,
                          contact_name: v,
                          contact_id: editingContactId ? prev.contact_id : '',
                        }))
                        if (!editingContactId) {
                          setFormData(prev => ({ ...prev, spoken_to: v }))
                        }
                      }}
                      placeholder="Naam *"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>

                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={contactData.contact_function}
                      onChange={(e) =>
                        setContactData((prev) => ({
                          ...prev,
                          contact_function: e.target.value,
                          contact_id: editingContactId ? prev.contact_id : '',
                        }))
                      }
                      placeholder="Functie (bijv. eigenaar, manager)"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>

                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="tel"
                      value={contactData.contact_phone}
                      onChange={(e) =>
                        setContactData((prev) => ({
                          ...prev,
                          contact_phone: e.target.value,
                          contact_id: editingContactId ? prev.contact_id : '',
                        }))
                      }
                      placeholder="Telefoonnummer"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      value={contactData.contact_email}
                      onChange={(e) =>
                        setContactData((prev) => ({
                          ...prev,
                          contact_email: e.target.value,
                          contact_id: editingContactId ? prev.contact_id : '',
                        }))
                      }
                      placeholder="E-mailadres"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-green-800 mb-1">
                    <StickyNote className="h-3.5 w-3.5" />
                    Notities (optioneel)
                  </label>
                  <textarea
                    value={contactData.contact_notes}
                    onChange={(e) =>
                      setContactData((prev) => ({
                        ...prev,
                        contact_notes: e.target.value,
                        contact_id: editingContactId ? prev.contact_id : '',
                      }))
                    }
                    placeholder="Belafspraken, voorkeuren, context voor collega's…"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => exitContactForm()}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Annuleren
                  </button>
                  {editingContactId ? (
                    <button
                      type="button"
                      disabled={savingContact}
                      onClick={() => saveEditedContact()}
                      className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
                    >
                      {savingContact ? 'Opslaan…' : 'Wijzigingen opslaan'}
                    </button>
                  ) : (
                    formData.location_id && (
                      <button
                        type="button"
                        disabled={savingContact}
                        onClick={() => saveNewContactNow()}
                        className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
                      >
                        {savingContact ? 'Opslaan…' : 'Contact nu opslaan in adresboek'}
                      </button>
                    )
                  )}
                </div>
                {!formData.location_id && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-2">
                    Je maakt een nieuwe locatie aan: het contact wordt mee opgeslagen zodra je de visit aanmaakt (of kies een bestaande locatie om nu al in het adresboek te bewaren).
                  </p>
                )}
              </div>
            )}

            {/* Selected contact summary (when picked from list, not in form) */}
            {contactData.contact_id && !showCreateContact && (
              <div className="mt-3 p-3 bg-green-100 rounded-lg">
                <p className="text-sm text-green-800">
                  <span className="font-medium">Gekoppeld aan deze visit:</span> {contactData.contact_name}
                  {contactData.contact_function && ` (${contactData.contact_function})`}
                </p>
              </div>
            )}
            </>
            )}
          </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            POS System *
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-3">
            {POS_SYSTEMS.map((pos) => (
              <button
                key={pos.id}
                type="button"
                onClick={() => handlePosSelect(pos.id)}
                className={`px-3 py-2 text-sm rounded-lg border-2 transition-all ${
                  selectedPosId === pos.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pos.name}
              </button>
            ))}
          </div>
          
          {/* Custom POS input when "Overig" is selected */}
          {selectedPosId === 'other' && (
            <div className="mt-3">
              <input
                type="text"
                required
                value={customPosName}
                onChange={(e) => handleCustomPosChange(e.target.value)}
                placeholder="Vul de naam van het POS systeem in..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
          
          {/* Show selected POS */}
          {formData.pos_system && (
            <div className="mt-2 text-sm text-gray-600">
              Geselecteerd: <span className="font-medium text-indigo-600">{formData.pos_system}</span>
            </div>
          )}
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
            <option value="potential">Potential</option>
            <option value="demo_planned">Demo Planned</option>
            <option value="already_client">Already Client</option>
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

        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <label className="block text-sm font-medium text-sky-900 flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Vervolgstappen
              </label>
              <p className="text-xs text-sky-800/90 mt-1">
                Noteer afspraken of acties na deze visit. Per regel kun je direct een afspraak in{' '}
                <strong>Google Agenda</strong> zetten (opent een nieuw tabblad).
              </p>
            </div>
            <button
              type="button"
              onClick={addNextStepRow}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-sky-600 bg-white px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100"
            >
              <ListChecks className="h-4 w-4" />
              Stap toevoegen
            </button>
          </div>

          {nextSteps.length === 0 ? (
            <p className="text-sm text-sky-800/80">Nog geen stappen — klik op &quot;Stap toevoegen&quot; om te beginnen.</p>
          ) : (
            <div className="space-y-4">
              {nextSteps.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-sky-200 bg-white p-3 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-sky-900">Stap {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeNextStepRow(step.id)}
                      className="text-gray-500 hover:text-red-600 p-1"
                      title="Verwijderen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Titel *</label>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => updateNextStep(step.id, { title: e.target.value })}
                      placeholder="Bijv. Demo inplannen, contract sturen…"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Datum (agenda)</label>
                      <input
                        type="date"
                        value={step.due_date || ''}
                        onChange={(e) =>
                          updateNextStep(step.id, { due_date: e.target.value || null })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Tijd</label>
                      <input
                        type="time"
                        value={step.due_time || '09:00'}
                        onChange={(e) =>
                          updateNextStep(step.id, { due_time: e.target.value || null })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Extra notities</label>
                    <textarea
                      value={step.notes || ''}
                      onChange={(e) =>
                        updateNextStep(step.id, { notes: e.target.value || null })
                      }
                      rows={2}
                      placeholder="Optioneel: details voor in de agenda-invite"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openNextStepInCalendar(step)}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <CalendarPlus className="h-4 w-4" />
                      In Google Agenda zetten
                    </button>
                    <span className="text-xs text-gray-500 self-center">
                      Zonder datum: morgen 09:00 als voorstel
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
