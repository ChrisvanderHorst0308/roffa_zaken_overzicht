'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Location } from '@/types'
import { FLETCHER_CHECKLIST, getAllChecklistItems } from '@/lib/fletcherChecklist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  X, 
  Search, 
  MapPin, 
  ChevronRight, 
  Building2,
  ClipboardCheck,
  Plus,
  ArrowLeft
} from 'lucide-react'
import toast from 'react-hot-toast'

interface FletcherApkModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (runId: string) => void
  locations: Location[]
}

export default function FletcherApkModal({ isOpen, onClose, onSuccess, locations }: FletcherApkModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [locationSearch, setLocationSearch] = useState('')
  const [showLocationResults, setShowLocationResults] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [allLocations, setAllLocations] = useState<Location[]>(locations)
  const searchRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // New location form state
  const [isCreatingLocation, setIsCreatingLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationCity, setNewLocationCity] = useState('')
  const [newLocationAddress, setNewLocationAddress] = useState('')
  const [creatingLocation, setCreatingLocation] = useState(false)

  // Update locations when prop changes
  useEffect(() => {
    setAllLocations(locations)
  }, [locations])

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedLocation(null)
      setLocationSearch('')
      setShowLocationResults(false)
      setIsCreatingLocation(false)
      setNewLocationName('')
      setNewLocationCity('')
      setNewLocationAddress('')
    }
  }, [isOpen])

  // Close location dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowLocationResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredLocations = allLocations.filter(loc =>
    loc.name.toLowerCase().includes(locationSearch.toLowerCase()) ||
    loc.city.toLowerCase().includes(locationSearch.toLowerCase())
  ).slice(0, 20)

  const selectLocation = (location: Location) => {
    setSelectedLocation(location)
    setLocationSearch('')
    setShowLocationResults(false)
    setIsCreatingLocation(false)
  }

  const handleCreateLocation = async () => {
    if (!newLocationName.trim() || !newLocationCity.trim()) {
      toast.error('Naam en stad zijn verplicht')
      return
    }

    setCreatingLocation(true)
    try {
      const { data: newLocation, error } = await supabase
        .from('locations')
        .insert({
          name: newLocationName.trim(),
          city: newLocationCity.trim(),
          address: newLocationAddress.trim() || null,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          toast.error('Deze locatie bestaat al')
        } else {
          throw error
        }
        return
      }

      // Add to local list and select it
      setAllLocations(prev => [...prev, newLocation])
      setSelectedLocation(newLocation)
      setIsCreatingLocation(false)
      toast.success('Locatie aangemaakt!')
    } catch (error: any) {
      toast.error(error.message || 'Fout bij aanmaken locatie')
    } finally {
      setCreatingLocation(false)
    }
  }

  const handleStartApk = async () => {
    if (!selectedLocation) {
      toast.error('Selecteer eerst een locatie')
      return
    }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Niet ingelogd')
        return
      }

      // Create the APK run
      const { data: run, error: runError } = await supabase
        .from('fletcher_apk_runs')
        .insert({
          location_id: selectedLocation.id,
          created_by: user.id,
          status: 'draft',
        })
        .select()
        .single()

      if (runError) throw runError

      // Create all checklist items for this run
      const allItems = getAllChecklistItems()
      const checkItems = allItems.map(item => ({
        run_id: run.id,
        item_key: item.key,
        section: item.section,
        label: item.label,
        checked: false,
      }))

      const { error: itemsError } = await supabase
        .from('fletcher_apk_check_items')
        .insert(checkItems)

      if (itemsError) throw itemsError

      onSuccess(run.id)
    } catch (error: any) {
      toast.error(error.message || 'Fout bij aanmaken APK')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-orange-50">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-orange-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Start Fletcher APK</h2>
              <p className="text-sm text-gray-600">Selecteer een locatie om te beginnen</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-orange-100 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[300px]">
          {/* Selected location display */}
          {selectedLocation ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fletcher Locatie *
              </label>
              <div className="flex items-center justify-between p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-orange-600" />
                  <div>
                    <p className="font-semibold text-lg">{selectedLocation.name}</p>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedLocation.city}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedLocation(null)}
                >
                  Wijzig
                </Button>
              </div>

              {/* Info about what will happen */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Wat gebeurt er?</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Een nieuwe APK check wordt aangemaakt</li>
                  <li>• Je kunt de checklist items afvinken</li>
                  <li>• Je kunt meeting notes en to-do&apos;s toevoegen</li>
                  <li>• Voortgang wordt automatisch opgeslagen</li>
                </ul>
              </div>
            </div>
          ) : isCreatingLocation ? (
            /* New location form */
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setIsCreatingLocation(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h3 className="font-medium text-gray-900">Nieuwe locatie aanmaken</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Naam *
                  </label>
                  <Input
                    type="text"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    placeholder="Bijv. Fletcher Hotel Amsterdam"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stad *
                  </label>
                  <Input
                    type="text"
                    value={newLocationCity}
                    onChange={(e) => setNewLocationCity(e.target.value)}
                    placeholder="Bijv. Amsterdam"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adres (optioneel)
                  </label>
                  <Input
                    type="text"
                    value={newLocationAddress}
                    onChange={(e) => setNewLocationAddress(e.target.value)}
                    placeholder="Bijv. Kerkstraat 123"
                  />
                </div>

                <Button
                  onClick={handleCreateLocation}
                  disabled={creatingLocation || !newLocationName.trim() || !newLocationCity.trim()}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  {creatingLocation ? 'Aanmaken...' : 'Locatie Aanmaken'}
                </Button>
              </div>
            </div>
          ) : (
            /* Search location */
            <div ref={searchRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fletcher Locatie *
              </label>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => {
                    setLocationSearch(e.target.value)
                    setShowLocationResults(true)
                  }}
                  onFocus={() => setShowLocationResults(true)}
                  placeholder="Zoek een Fletcher locatie..."
                  className="pl-10 h-12 text-lg"
                  autoFocus
                />
              </div>
              
              {showLocationResults && (
                <div className="absolute z-50 w-full mt-1 bg-white border-2 border-orange-200 rounded-lg shadow-2xl max-h-80 overflow-y-auto">
                  {filteredLocations.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-gray-500 mb-3">
                        {locationSearch ? 'Geen locaties gevonden' : 'Begin met typen om te zoeken...'}
                      </p>
                      {locationSearch && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNewLocationName(locationSearch)
                            setIsCreatingLocation(true)
                            setShowLocationResults(false)
                          }}
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Nieuwe locatie aanmaken
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="sticky top-0 bg-gray-100 px-4 py-2 text-xs text-gray-500 font-medium border-b">
                        {filteredLocations.length} resultaten
                      </div>
                      {filteredLocations.map(location => (
                        <button
                          key={location.id}
                          type="button"
                          onClick={() => selectLocation(location)}
                          className="w-full text-left px-4 py-3 hover:bg-orange-50 flex items-center gap-3 border-b last:border-b-0 transition-colors"
                        >
                          <Building2 className="h-5 w-5 text-orange-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{location.name}</p>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              {location.city}
                            </p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Always show create button below search */}
              <button
                type="button"
                onClick={() => setIsCreatingLocation(true)}
                className="mt-3 text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Locatie niet gevonden? Maak een nieuwe aan
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          
          <Button
            onClick={handleStartApk}
            disabled={submitting || !selectedLocation}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {submitting ? 'Bezig...' : 'Start APK Check'}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
