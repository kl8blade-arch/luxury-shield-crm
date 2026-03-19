'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
    supabase.from('leads').select('*').limit(5)
      .then(({ data, error }) => {
        setData(data)
        setError(error)
      })
  }, [])

  return (
    <div style={{ padding: '40px', color: 'white', fontFamily: 'monospace' }}>
      <h1>Test</h1>
      <pre>{JSON.stringify(error, null, 2)}</pre>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}