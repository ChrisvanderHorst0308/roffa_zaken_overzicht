'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    {
      title: 'Welcome to Orderli take over',
      description: 'Learn how to manage your visits and track locations efficiently.',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            This dashboard helps you manage visits to hospitality locations, track your progress, and collaborate with your team.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Key Features:</h3>
            <ul className="list-disc list-inside text-blue-800 space-y-1">
              <li>Register visits to locations</li>
              <li>Track visit status and notes</li>
              <li>View all locations and their visit history</li>
              <li>Prevent duplicate visits</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: 'Creating Your First Visit',
      description: 'Learn how to register a new visit to a location.',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            To create a new visit, click the &quot;New Visit&quot; button on your dashboard.
          </p>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Step 1: Select a Project</h4>
              <p className="text-sm text-gray-600">Choose the project you&apos;re working on from the dropdown.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Step 2: Choose or Create Location</h4>
              <p className="text-sm text-gray-600">Search for an existing location or create a new one if it doesn&apos;t exist yet.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Step 3: Fill in Visit Details</h4>
              <p className="text-sm text-gray-600">Add information about the POS system, who you spoke with, services offered, and any notes.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Step 4: Set Status</h4>
              <p className="text-sm text-gray-600">Mark the visit as visited, interested, demo planned, or not interested.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Managing Locations',
      description: 'Explore and manage all locations in the system.',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            The Locations page shows all hospitality locations in the system.
          </p>
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 mb-2">Green Border</h4>
              <p className="text-sm text-green-800">Indicates locations you&apos;ve already visited</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Yellow Border</h4>
              <p className="text-sm text-yellow-800">Warning: Someone else visited this location in the last 30 days</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Gray Border</h4>
              <p className="text-sm text-gray-800">Location hasn&apos;t been visited yet</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Viewing Your Visits',
      description: 'Track and manage all your visits from the dashboard.',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Your dashboard shows all your visits with search and filter options.
          </p>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Search & Filter</h4>
              <p className="text-sm text-gray-600">Use the search bar to find visits by location name, city, or notes. Filter by project or status.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Visit Details</h4>
              <p className="text-sm text-gray-600">Click on any visit to see detailed information and related visits to the same location.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Status Colors</h4>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Interested</span>
                  <span className="text-sm text-gray-600">Location is interested</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Demo Planned</span>
                  <span className="text-sm text-gray-600">Demo is scheduled</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Not Interested</span>
                  <span className="text-sm text-gray-600">Location declined</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'You\'re All Set!',
      description: 'Ready to start managing your visits.',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            You now know the basics of using Orderli take over. Start by creating your first visit!
          </p>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h3 className="font-semibold text-indigo-900 mb-2">Quick Tips:</h3>
            <ul className="list-disc list-inside text-indigo-800 space-y-1">
              <li>Always check for duplicate visits before creating a new one</li>
              <li>Add detailed notes to help your team</li>
              <li>Update visit status as you progress</li>
              <li>Use the Locations page to see visit history</li>
            </ul>
          </div>
        </div>
      ),
    },
  ]

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      router.push('/dashboard')
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const skipOnboarding = () => {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Onboarding</h1>
            <button
              onClick={skipOnboarding}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip
            </button>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Step {currentStep + 1} of {steps.length}
              </span>
              <div className="flex space-x-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-2 rounded-full ${
                      index === currentStep
                        ? 'bg-indigo-600'
                        : index < currentStep
                        ? 'bg-indigo-300'
                        : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {steps[currentStep].title}
            </h2>
            <p className="text-gray-600 mb-6">
              {steps[currentStep].description}
            </p>
            <div className="prose max-w-none">
              {steps[currentStep].content}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`px-4 py-2 rounded-md ${
                currentStep === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Previous
            </button>
            <button
              onClick={nextStep}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
