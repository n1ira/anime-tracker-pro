'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Checkbox } from '@/app/components/ui/checkbox'
import { Label } from '@/app/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [useSystemEnvVar, setUseSystemEnvVar] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings')
        if (!response.ok) throw new Error('Failed to fetch settings')
        const data = await response.json()
        setOpenaiApiKey(data.openaiApiKey || '')
        setUseSystemEnvVar(data.useSystemEnvVar || false)
      } catch (error) {
        console.error('Error fetching settings:', error)
        toast.error('Failed to load settings. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  // Save settings
  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          openaiApiKey,
          useSystemEnvVar
        })
      })

      if (!response.ok) throw new Error('Failed to update settings')
      
      toast.success('Settings updated successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle checkbox change
  const handleCheckboxChange = (checked: boolean) => {
    setUseSystemEnvVar(checked)
    if (checked) {
      // When enabling the system env var option, we can clear the API key input
      // since it will be pulled from the environment
      setOpenaiApiKey('')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>OpenAI API Key</CardTitle>
          <CardDescription>
            Configure your OpenAI API key for title parsing when searching for new episodes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-..."
                  value={openaiApiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpenaiApiKey(e.target.value)}
                  disabled={useSystemEnvVar || isSaving}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="use-env-var" 
                  checked={useSystemEnvVar}
                  onCheckedChange={handleCheckboxChange}
                  disabled={isSaving}
                />
                <Label 
                  htmlFor="use-env-var" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Use system environment variable OPENAI_API_KEY
                </Label>
              </div>
              
              <Button onClick={saveSettings} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 