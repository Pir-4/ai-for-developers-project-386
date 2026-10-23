import { useEffect, useState } from 'react'
import { getOwner, type Owner } from './api.ts'

/** The predefined owner's profile, or null while it loads (or if it failed to). */
export function useOwner(): Owner | null {
  const [owner, setOwner] = useState<Owner | null>(null)
  useEffect(() => {
    let cancelled = false
    getOwner()
      .then((loaded) => {
        if (!cancelled) setOwner(loaded)
      })
      .catch(() => {
        // the name is decorative: pages work without it
      })
    return () => {
      cancelled = true
    }
  }, [])
  return owner
}
