'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft,
  UtensilsCrossed,
  Plus
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function MenuBuilderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      // Only admin and reichskanzlier have access
      if (!profile || (profile.role !== 'admin' && profile.role !== 'reichskanzlier')) {
        toast.error('Geen toegang. Alleen voor admins.')
        router.push('/dashboard')
        return
      }

      setLoading(false)
    } catch (error) {
      toast.error('Er ging iets mis')
      router.push('/dashboard')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/orderli">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <UtensilsCrossed className="h-7 w-7 text-orange-600" />
              Menu Builder
            </h1>
            <p className="text-muted-foreground mt-1">Bouw en beheer menu kaarten</p>
          </div>
        </div>
        <Button className="bg-orange-600 hover:bg-orange-700">
          <Plus className="h-4 w-4 mr-2" />
          Nieuw Menu
        </Button>
      </div>

      {/* Content placeholder */}
      <div className="bg-white rounded-xl border p-12 text-center">
        <UtensilsCrossed className="h-16 w-16 mx-auto mb-4 text-orange-200" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Menu Builder</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Hier kun je straks menu kaarten bouwen en beheren voor Orderli locaties.
        </p>
      </div>
    </div>
  )
}
