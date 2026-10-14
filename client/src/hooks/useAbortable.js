import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns `nextSignal()` which aborts the previous in-flight request and hands
 * out a fresh AbortSignal. Everything is cancelled on unmount.
 */
export function useAbortable() {
  const controllerRef = useRef(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  return useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = new AbortController()
    return controllerRef.current.signal
  }, [])
}
