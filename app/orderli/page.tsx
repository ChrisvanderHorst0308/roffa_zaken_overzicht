'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Badge } from '@/components/ui/badge'
import { 
  UtensilsCrossed,
  ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Tool {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  href: string
  color: string
  bgColor: string
}

export default function OrderliPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  const tools: Tool[] = [
    {
      id: 'menu-builder',
      name: 'Menu Builder',
      description: 'Bouw en beheer menu kaarten',
      icon: <UtensilsCrossed className="h-8 w-8" />,
      href: '/orderli/menu-builder',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 hover:bg-orange-200'
    },
  ]

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Orderli Tools</h1>
          <p className="text-muted-foreground mt-1">Selecteer een tool om te starten</p>
        </div>
        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
          Admin Only
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tools.map((tool) => (
          <div
            key={tool.id}
            onClick={() => router.push(tool.href)}
            className={`${tool.bgColor} rounded-xl p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group`}
          >
            <div className={`${tool.color} mb-4`}>
              {tool.icon}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center justify-between">
              {tool.name}
              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
            </h3>
            <p className="text-sm text-gray-600">{tool.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
