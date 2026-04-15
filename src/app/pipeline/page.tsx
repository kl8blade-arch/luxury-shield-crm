'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PipelineRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/pipeline') }, [router])
  return (
    <div style={{ background:'#0d0820', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif', color:'#9B59B6' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🎯</div>
        <div style={{ fontSize:14 }}>Redirigiendo al Pipeline...</div>
      </div>
    </div>
  )
}
