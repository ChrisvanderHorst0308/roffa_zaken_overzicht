'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  Star, 
  Lock, 
  Trophy, 
  Zap, 
  Crown,
  Gift,
  Sparkles,
  Shield,
  Gem,
  Award,
  Target,
  Flame,
  Rocket,
  Medal,
  Ghost,
  PartyPopper,
  ChevronRight
} from 'lucide-react'

// Battle Pass Tiers Configuration
const BATTLE_PASS_TIERS = [
  { tier: 1, visitsRequired: 1, reward: 'Rookie', icon: Shield, rarity: 'common', xp: 100, description: 'Every legend starts somewhere' },
  { tier: 2, visitsRequired: 3, reward: 'First Steps', icon: Target, rarity: 'common', xp: 150, description: 'The journey begins' },
  { tier: 3, visitsRequired: 5, reward: 'Explorer', icon: Star, rarity: 'uncommon', xp: 200, description: 'Venturing into the unknown' },
  { tier: 4, visitsRequired: 8, reward: 'Pathfinder', icon: Zap, rarity: 'uncommon', xp: 250, description: 'Lightning fast progress' },
  { tier: 5, visitsRequired: 10, reward: 'Bronze', icon: Medal, rarity: 'rare', xp: 300, description: 'Proving your worth' },
  { tier: 6, visitsRequired: 15, reward: 'Scout', icon: Target, rarity: 'rare', xp: 400, description: 'Eyes everywhere' },
  { tier: 7, visitsRequired: 20, reward: 'Silver', icon: Award, rarity: 'rare', xp: 500, description: 'Shining bright' },
  { tier: 8, visitsRequired: 25, reward: 'Gold', icon: Trophy, rarity: 'epic', xp: 750, description: 'Relentless pursuit' },
  { tier: 9, visitsRequired: 30, reward: 'Master', icon: Crown, rarity: 'epic', xp: 1000, description: 'Dominating the field' },
  { tier: 10, visitsRequired: 35, reward: 'Elite', icon: Flame, rarity: 'epic', xp: 1250, description: 'On fire!' },
  { tier: 11, visitsRequired: 40, reward: 'Diamond', icon: Gem, rarity: 'legendary', xp: 1500, description: 'Rare and valuable' },
  { tier: 12, visitsRequired: 50, reward: 'Platinum', icon: Sparkles, rarity: 'legendary', xp: 2000, description: 'Elite status achieved' },
  { tier: 13, visitsRequired: 75, reward: 'Shadow', icon: Ghost, rarity: 'legendary', xp: 3000, description: 'Legendary presence' },
  { tier: 14, visitsRequired: 100, reward: 'Victory', icon: Rocket, rarity: 'mythic', xp: 5000, description: 'The ultimate achievement' },
  { tier: 15, visitsRequired: 150, reward: 'G.O.A.T.', icon: Crown, rarity: 'mythic', xp: 10000, description: 'Greatest Of All Time' },
]

const RARITY_COLORS: Record<string, { bg: string, border: string, glow: string, text: string }> = {
  common: { bg: 'from-gray-600 to-gray-700', border: 'border-gray-500', glow: 'shadow-gray-500/50', text: 'text-gray-300' },
  uncommon: { bg: 'from-green-600 to-emerald-700', border: 'border-green-400', glow: 'shadow-green-500/50', text: 'text-green-400' },
  rare: { bg: 'from-blue-600 to-cyan-700', border: 'border-blue-400', glow: 'shadow-blue-500/50', text: 'text-blue-400' },
  epic: { bg: 'from-purple-600 to-violet-700', border: 'border-purple-400', glow: 'shadow-purple-500/50', text: 'text-purple-400' },
  legendary: { bg: 'from-orange-500 via-yellow-500 to-amber-500', border: 'border-yellow-400', glow: 'shadow-yellow-500/70', text: 'text-yellow-400' },
  mythic: { bg: 'from-pink-500 via-purple-500 to-cyan-500', border: 'border-pink-400', glow: 'shadow-pink-500/70', text: 'text-pink-400' },
}

export default function PremiumPassPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [totalVisits, setTotalVisits] = useState(0)
  const [userName, setUserName] = useState('')
  const [profilePic, setProfilePic] = useState<string | null>(null)
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadUserStats()
  }, [])

  useEffect(() => {
    if (!loading && scrollRef.current) {
      const currentTierIndex = BATTLE_PASS_TIERS.findIndex(t => t.visitsRequired > totalVisits)
      const targetIndex = currentTierIndex > 0 ? currentTierIndex - 1 : 0
      const tierWidth = 120
      scrollRef.current.scrollLeft = Math.max(0, (targetIndex * tierWidth) - 50)
    }
  }, [loading, totalVisits])

  const loadUserStats = async () => {
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

      if (profile) {
        setUserName(profile.nickname || profile.name || user.email || 'Recruiter')
        setProfilePic(profile.profile_picture_url)
      }

      const { count } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .eq('recruiter_id', user.id)

      setTotalVisits(count || 0)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentTier = BATTLE_PASS_TIERS.reduce((acc, tier) => {
    if (totalVisits >= tier.visitsRequired) return tier.tier
    return acc
  }, 0)

  const totalXP = BATTLE_PASS_TIERS.reduce((acc, tier) => {
    if (totalVisits >= tier.visitsRequired) return acc + tier.xp
    return acc
  }, 0)

  const nextTier = BATTLE_PASS_TIERS.find(t => t.visitsRequired > totalVisits)
  const prevTier = BATTLE_PASS_TIERS.filter(t => t.visitsRequired <= totalVisits).pop()
  const progressToNext = nextTier && prevTier 
    ? ((totalVisits - prevTier.visitsRequired) / (nextTier.visitsRequired - prevTier.visitsRequired)) * 100
    : nextTier 
      ? (totalVisits / nextTier.visitsRequired) * 100
      : 100

  const currentTierData = BATTLE_PASS_TIERS.find(t => t.tier === currentTier)
  const currentRarity = currentTierData?.rarity || 'common'

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center z-50">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-purple-500 border-t-yellow-400 rounded-full animate-spin" />
          <div className="absolute inset-0 w-24 h-24 border-4 border-transparent border-b-pink-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          <Crown className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-yellow-400 animate-pulse" />
        </div>
        <div className="absolute bottom-1/3 text-center">
          <p className="text-purple-300 animate-pulse text-lg font-bold tracking-widest">LOADING BATTLE PASS...</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-y-auto overflow-x-hidden z-40"
      style={{ top: '64px' }}
    >
      {/* EPIC ANIMATED STYLES */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(20px) rotate(-5deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px currentColor, 0 0 40px currentColor, 0 0 60px currentColor; }
          50% { box-shadow: 0 0 30px currentColor, 0 0 60px currentColor, 0 0 90px currentColor; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes rainbow {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
        @keyframes bounce-in {
          0% { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          50% { transform: scale(1.1) rotate(3deg); }
          70% { transform: scale(0.95) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes slide-up {
          0% { transform: translateY(30px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes rotate-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes particle-rise {
          0% { transform: translateY(100%) scale(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) scale(1); opacity: 0; }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-reverse { animation: float-reverse 4s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .animate-shimmer { 
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
        .animate-rainbow { animation: rainbow 3s linear infinite; }
        .animate-bounce-in { animation: bounce-in 0.6s ease-out forwards; }
        .animate-slide-up { animation: slide-up 0.5s ease-out forwards; }
        .animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
        .animate-star-twinkle { animation: star-twinkle 1.5s ease-in-out infinite; }
        .animate-rotate-slow { animation: rotate-slow 20s linear infinite; }
        .animate-particle-rise { animation: particle-rise 8s linear infinite; }
        .holographic {
          background: linear-gradient(135deg, rgba(255,0,255,0.2), rgba(0,255,255,0.2), rgba(255,255,0,0.2), rgba(255,0,255,0.2));
          background-size: 400% 400%;
          animation: shimmer 4s ease infinite;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .text-glow { text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor; }
      `}</style>

      {/* Floating Particles Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ top: '64px' }}>
        {[...Array(25)].map((_, i) => (
          <div 
            key={i}
            className="absolute rounded-full animate-particle-rise"
            style={{
              width: 3 + Math.random() * 6,
              height: 3 + Math.random() * 6,
              background: ['#A78BFA', '#F472B6', '#60A5FA', '#FBBF24', '#34D399'][Math.floor(Math.random() * 5)],
              left: `${Math.random() * 100}%`,
              bottom: '-20px',
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 6}s`,
              boxShadow: `0 0 ${10 + Math.random() * 10}px currentColor`
            }}
          />
        ))}
        {/* Big glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-glow-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-glow-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-glow-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 p-3 sm:p-4 lg:p-6 max-w-6xl mx-auto">
        {/* EPIC Header */}
        <div className="flex flex-col items-center text-center mb-4 sm:mb-6 animate-slide-up">
          {/* Main Title with Effects */}
          <div className="relative inline-block">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black flex justify-center tracking-tight">
              {/* PREMIUM */}
              <span className="text-purple-500 drop-shadow-[0_0_10px_#a855f7]">P</span>
              <span className="text-fuchsia-500 drop-shadow-[0_0_10px_#d946ef]">R</span>
              <span className="text-pink-500 drop-shadow-[0_0_10px_#ec4899]">E</span>
              <span className="text-rose-400 drop-shadow-[0_0_10px_#fb7185]">M</span>
              <span className="text-yellow-400 drop-shadow-[0_0_10px_#facc15]">I</span>
              <span className="text-lime-400 drop-shadow-[0_0_10px_#a3e635]">U</span>
              <span className="text-green-400 drop-shadow-[0_0_10px_#4ade80]">M</span>
              <span className="w-2 sm:w-4"></span>
              {/* PASS */}
              <span className="text-teal-400 drop-shadow-[0_0_10px_#2dd4bf]">P</span>
              <span className="text-cyan-400 drop-shadow-[0_0_10px_#22d3ee]">A</span>
              <span className="text-blue-400 drop-shadow-[0_0_10px_#60a5fa]">S</span>
              <span className="text-violet-400 drop-shadow-[0_0_10px_#a78bfa]">S</span>
            </h1>
            {/* Sparkles around title */}
            <Sparkles className="absolute -top-2 -left-4 w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 animate-star-twinkle" />
            <Sparkles className="absolute -top-1 -right-3 w-4 h-4 sm:w-5 sm:h-5 text-pink-400 animate-star-twinkle" style={{ animationDelay: '0.5s' }} />
            <Star className="absolute -bottom-1 left-0 w-4 h-4 text-cyan-400 animate-star-twinkle" style={{ animationDelay: '1s' }} />
            <Zap className="absolute top-0 right-1/4 w-3 h-3 sm:w-4 sm:h-4 text-yellow-300 animate-pulse" />
          </div>
          
          {/* Season Badge - below title */}
          <div className="inline-block px-4 py-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-full text-[10px] sm:text-xs font-black text-white uppercase tracking-widest mt-2 shadow-lg shadow-orange-500/50 animate-pulse">
            Season 1 Active
          </div>
          
          <p className="text-purple-300/80 text-xs sm:text-sm mt-1 tracking-[0.2em] uppercase">The Great Takeover</p>
        </div>

        {/* Player Card with Glow Effects */}
        <div className="relative mb-4 sm:mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Animated border glow */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 rounded-xl blur opacity-50 animate-pulse" />
          
          <div className="relative bg-slate-800/80 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-white/10">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Avatar with spinning ring */}
              <div className="relative flex-shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 rounded-full animate-rotate-slow opacity-75" />
                {profilePic ? (
                  <img src={profilePic} alt={userName} className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/50 object-cover" />
                ) : (
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-white/50">
                    <span className="text-xl sm:text-2xl font-black text-white">{userName.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                {/* Level badge with glow */}
                <div className="absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg shadow-yellow-500/50 animate-pulse">
                  <span className="text-[10px] sm:text-xs font-black text-black">{currentTier}</span>
                </div>
              </div>

              {/* Name & Title */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base sm:text-lg truncate">{userName}</p>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-gradient-to-r ${RARITY_COLORS[currentRarity].bg} shadow-lg ${RARITY_COLORS[currentRarity].glow}`}>
                  <Crown className="w-3 h-3 text-white animate-pulse" />
                  <span className="text-white">{currentTierData?.reward || 'Newcomer'}</span>
                </div>
              </div>

              {/* Stats with glow */}
              <div className="flex gap-3 sm:gap-6">
                <div className="text-center">
                  <p className="text-[9px] sm:text-xs text-purple-300 uppercase tracking-wider">Visits</p>
                  <p className="text-xl sm:text-2xl font-black text-white text-glow" style={{ color: '#60A5FA' }}>{totalVisits}</p>
                </div>
                <div className="text-center hidden sm:block">
                  <p className="text-[9px] sm:text-xs text-purple-300 uppercase tracking-wider">XP</p>
                  <p className="text-xl sm:text-2xl font-black text-yellow-400 text-glow">{totalXP.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] sm:text-xs text-purple-300 uppercase tracking-wider">Tier</p>
                  <p className="text-xl sm:text-2xl font-black text-white">{currentTier}<span className="text-purple-400 text-sm">/{BATTLE_PASS_TIERS.length}</span></p>
                </div>
              </div>
            </div>

            {/* Epic Progress Bar */}
            {nextTier && (
              <div className="mt-3 sm:mt-4">
                <div className="flex justify-between items-center text-[10px] sm:text-xs mb-1.5">
                  <span className="text-purple-300 flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 animate-pulse" />
                    Next: <span className={`font-bold ${RARITY_COLORS[nextTier.rarity].text}`}>{nextTier.reward}</span>
                    <span className="text-purple-500 uppercase text-[8px]">({nextTier.rarity})</span>
                  </span>
                  <span className="text-white font-bold">{totalVisits}/{nextTier.visitsRequired} visits</span>
                </div>
                <div className="h-3 sm:h-4 bg-slate-700/50 rounded-full overflow-hidden relative">
                  {/* Background glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-transparent" />
                  
                  {/* Progress fill with effects */}
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-400 rounded-full relative transition-all duration-1000"
                    style={{ width: `${Math.min(progressToNext, 100)}%` }}
                  >
                    {/* Animated shine */}
                    <div className="absolute inset-0 animate-shimmer" />
                    {/* Glowing edge */}
                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-lg shadow-white/80 animate-pulse" />
                  </div>

                  {/* Milestone markers */}
                  {[25, 50, 75].map(percent => (
                    <div key={percent} className="absolute top-0 bottom-0 w-0.5 bg-white/20" style={{ left: `${percent}%` }} />
                  ))}
                </div>
                <p className="text-purple-400 text-[10px] sm:text-xs mt-1 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-orange-400 animate-pulse" />
                  {nextTier.visitsRequired - totalVisits} more to unlock <span className={RARITY_COLORS[nextTier.rarity].text}>+{nextTier.xp} XP</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Battle Pass Tiers Title */}
        <div className="flex items-center gap-2 mb-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
          <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2 uppercase tracking-wider">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 animate-float" />
            Battle Pass
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 animate-float-reverse" />
          </h2>
          <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
        </div>

        {/* EPIC Tier Cards */}
        <div ref={scrollRef} className="overflow-x-auto pb-3 -mx-3 px-3 scrollbar-hide mb-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex gap-2 sm:gap-3" style={{ minWidth: 'max-content' }}>
            {BATTLE_PASS_TIERS.map((tier, index) => {
              const isUnlocked = totalVisits >= tier.visitsRequired
              const isNext = nextTier?.tier === tier.tier
              const colors = RARITY_COLORS[tier.rarity]
              const Icon = tier.icon
              const isSpecial = tier.rarity === 'legendary' || tier.rarity === 'mythic'
              
              return (
                <div
                  key={tier.tier}
                  onClick={() => setSelectedTier(selectedTier === tier.tier ? null : tier.tier)}
                  className={`
                    relative w-24 sm:w-32 flex-shrink-0 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 transform
                    ${isUnlocked 
                      ? `bg-gradient-to-b ${colors.bg} border-2 ${colors.border} shadow-xl ${colors.glow} hover:scale-110 hover:-translate-y-2` 
                      : isNext
                        ? 'bg-slate-800/80 border-2 border-dashed border-purple-400 hover:border-purple-300'
                        : 'bg-slate-800/50 border-2 border-slate-700 opacity-50 hover:opacity-70'
                    }
                    ${selectedTier === tier.tier ? 'ring-2 ring-yellow-400 scale-110 -translate-y-2 z-10' : ''}
                  `}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* Holographic effect for special tiers */}
                  {isUnlocked && isSpecial && (
                    <div className="absolute inset-0 holographic opacity-30" />
                  )}

                  {/* Tier Header */}
                  <div className={`relative py-1.5 sm:py-2 text-center text-xs sm:text-sm font-black ${isUnlocked ? 'bg-black/40 text-white' : 'bg-slate-900/50 text-slate-500'}`}>
                    {isUnlocked && <div className="absolute inset-0 animate-shimmer opacity-30" />}
                    <span className="relative">TIER {tier.tier}</span>
                  </div>

                  {/* Icon with effects */}
                  <div className="p-3 sm:p-4 flex flex-col items-center justify-center min-h-[80px] sm:min-h-[100px] relative">
                    {/* Sparkles for special tiers */}
                    {isUnlocked && isSpecial && (
                      <>
                        <Sparkles className="absolute top-2 left-2 w-3 h-3 text-yellow-400 animate-star-twinkle" />
                        <Sparkles className="absolute bottom-2 right-2 w-3 h-3 text-pink-400 animate-star-twinkle" style={{ animationDelay: '0.5s' }} />
                      </>
                    )}

                    {isUnlocked ? (
                      <div className={`p-2 sm:p-3 rounded-xl bg-black/30 ${isSpecial ? 'animate-float' : ''}`}>
                        <Icon className={`w-8 h-8 sm:w-10 sm:h-10 ${tier.rarity === 'mythic' ? 'animate-rainbow' : ''} ${colors.text}`} />
                      </div>
                    ) : (
                      <div className="p-2 sm:p-3 rounded-xl bg-slate-700/50">
                        <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-slate-600" />
                      </div>
                    )}
                    
                    <p className={`text-[10px] sm:text-xs font-bold mt-2 text-center leading-tight ${isUnlocked ? colors.text : 'text-slate-500'}`}>
                      {tier.reward}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className={`relative py-1.5 text-center text-[9px] sm:text-[11px] ${isUnlocked ? 'bg-black/40' : 'bg-slate-900/50'}`}>
                    <span className={isUnlocked ? 'text-green-400 font-bold' : 'text-slate-500'}>{tier.visitsRequired}v</span>
                    <span className={`ml-1 ${isUnlocked ? 'text-yellow-400' : 'text-slate-600'}`}>+{tier.xp}</span>
                  </div>

                  {/* Checkmark with glow */}
                  {isUnlocked && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  {/* Next Badge */}
                  {isNext && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded text-[8px] sm:text-[9px] font-black text-white uppercase shadow-lg shadow-purple-500/50 animate-pulse">
                      Next
                    </div>
                  )}

                  {/* Rarity bar */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1 ${isUnlocked ? `bg-gradient-to-r ${colors.bg}` : 'bg-slate-700'}`}>
                    {isUnlocked && <div className="absolute inset-0 animate-shimmer" />}
                  </div>
                </div>
              )
            })}

            {/* Coming Soon */}
            <div className="w-24 sm:w-32 flex-shrink-0 rounded-xl bg-slate-800/30 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center min-h-[140px] sm:min-h-[160px] opacity-50">
              <PartyPopper className="w-8 h-8 text-slate-600 animate-float" />
              <p className="text-[10px] sm:text-xs text-slate-500 mt-2 font-bold">SEASON 2</p>
              <p className="text-[8px] text-slate-600">COMING SOON</p>
            </div>
          </div>
        </div>

        {/* Quick Stats with Glow */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          {[
            { label: 'Visits', value: totalVisits, gradient: 'from-blue-600 to-cyan-600', glow: 'shadow-cyan-500/30' },
            { label: 'Tier', value: currentTier, gradient: 'from-purple-600 to-pink-600', glow: 'shadow-pink-500/30' },
            { label: 'XP', value: totalXP >= 1000 ? `${(totalXP/1000).toFixed(1)}k` : totalXP, gradient: 'from-yellow-500 to-orange-500', glow: 'shadow-orange-500/30' },
            { label: 'Done', value: `${Math.round((currentTier/BATTLE_PASS_TIERS.length)*100)}%`, gradient: 'from-green-500 to-emerald-500', glow: 'shadow-emerald-500/30' },
          ].map((stat, i) => (
            <div 
              key={stat.label} 
              className={`relative overflow-hidden bg-gradient-to-br ${stat.gradient} rounded-lg p-2 sm:p-3 text-center shadow-lg ${stat.glow} hover:scale-105 transition-transform cursor-pointer`}
            >
              <div className="absolute inset-0 animate-shimmer opacity-20" />
              <p className="text-[8px] sm:text-[10px] text-white/70 uppercase tracking-wider font-bold">{stat.label}</p>
              <p className="text-lg sm:text-2xl font-black text-white relative">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Epic Footer */}
        <div className="text-center animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/20 via-pink-500/20 to-purple-500/20 rounded-full blur-lg animate-pulse" />
            <div className="relative inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-slate-800/80 backdrop-blur-sm rounded-full border border-purple-500/30">
              <Rocket className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 animate-float" />
              <span className="text-xs sm:text-sm text-white font-bold">
                Keep grinding for <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 animate-pulse">LEGENDARY</span> rewards!
              </span>
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400 animate-float-reverse" />
            </div>
          </div>
        </div>
      </div>

      {/* Selected Tier Modal */}
      {selectedTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTier(null)}>
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
          
          <div className="relative w-full max-w-sm animate-bounce-in" onClick={e => e.stopPropagation()}>
            {(() => {
              const tier = BATTLE_PASS_TIERS.find(t => t.tier === selectedTier)!
              const isUnlocked = totalVisits >= tier.visitsRequired
              const colors = RARITY_COLORS[tier.rarity]
              const Icon = tier.icon
              const isSpecial = tier.rarity === 'legendary' || tier.rarity === 'mythic'
              
              return (
                <div className="relative">
                  {/* Glow effect */}
                  {isUnlocked && (
                    <div className={`absolute -inset-2 bg-gradient-to-r ${colors.bg} rounded-2xl blur-xl opacity-50 animate-pulse`} />
                  )}
                  
                  <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden border border-white/20">
                    {/* Header */}
                    <div className={`relative bg-gradient-to-r ${colors.bg} p-5 overflow-hidden`}>
                      {isSpecial && <div className="absolute inset-0 holographic opacity-30" />}
                      
                      <div className="relative flex items-center gap-4">
                        <div className={`p-4 bg-black/30 rounded-2xl ${isSpecial ? 'animate-float' : ''}`}>
                          <Icon className={`w-12 h-12 text-white ${tier.rarity === 'mythic' ? 'animate-rainbow' : ''}`} />
                        </div>
                        <div>
                          <p className="text-white/60 text-xs uppercase tracking-wider">Tier {tier.tier}</p>
                          <h3 className="text-2xl font-black text-white">{tier.reward}</h3>
                          <span className="text-xs uppercase font-black text-white/90 tracking-wider">{tier.rarity}</span>
                        </div>
                      </div>
                      
                      {isSpecial && (
                        <>
                          <Sparkles className="absolute top-2 right-2 w-5 h-5 text-yellow-400 animate-star-twinkle" />
                          <Sparkles className="absolute bottom-2 left-2 w-4 h-4 text-pink-400 animate-star-twinkle" style={{ animationDelay: '0.5s' }} />
                        </>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <p className="text-gray-400 text-sm mb-5 italic text-center">&quot;{tier.description}&quot;</p>

                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="bg-slate-700/50 rounded-xl p-3 text-center border border-slate-600/50">
                          <p className="text-gray-400 text-[10px] uppercase tracking-wider">Required</p>
                          <p className="text-xl font-black text-white">{tier.visitsRequired}</p>
                          <p className="text-[10px] text-gray-500">visits</p>
                        </div>
                        <div className="bg-slate-700/50 rounded-xl p-3 text-center border border-yellow-500/30">
                          <p className="text-gray-400 text-[10px] uppercase tracking-wider">Reward</p>
                          <p className="text-xl font-black text-yellow-400">+{tier.xp.toLocaleString()}</p>
                          <p className="text-[10px] text-yellow-500/70">XP</p>
                        </div>
                      </div>

                      {isUnlocked ? (
                        <div className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl text-green-400 font-bold border border-green-500/30">
                          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          UNLOCKED!
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-gray-400">Progress</span>
                            <span className="text-white font-bold">{totalVisits}/{tier.visitsRequired}</span>
                          </div>
                          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full bg-gradient-to-r ${colors.bg} rounded-full relative`} 
                              style={{ width: `${(totalVisits / tier.visitsRequired) * 100}%` }}
                            >
                              <div className="absolute inset-0 animate-shimmer" />
                            </div>
                          </div>
                          <p className="text-gray-500 text-xs mt-2 text-center">{tier.visitsRequired - totalVisits} more visits to go!</p>
                        </div>
                      )}
                    </div>

                    {/* Close button */}
                    <button 
                      onClick={() => setSelectedTier(null)}
                      className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
