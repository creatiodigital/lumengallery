'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { GallerySelection } from '@/components/admin/GallerySelection'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { LoadingBar } from '@/components/ui/LoadingBar'

const GallerySelectionPage = () => {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Super admin only — this is the gallery's own editorial voice. The API
  // enforces it too; this is just so the screen never flashes into view.
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
    else if (status === 'authenticated' && session?.user?.userType !== 'superAdmin')
      router.push('/')
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <div className={dashboardStyles.page}>
        <LoadingBar />
      </div>
    )
  }
  if (status === 'unauthenticated' || session?.user?.userType !== 'superAdmin') {
    return <div className={dashboardStyles.page}>Not authorized</div>
  }

  return (
    <DashboardLayout backLink="/admin/content" backLabel="← Back to Content">
      <h1 className={dashboardStyles.pageTitle}>Gallery Selection</h1>
      <GallerySelection />
    </DashboardLayout>
  )
}

export default GallerySelectionPage
