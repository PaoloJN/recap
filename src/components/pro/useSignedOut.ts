import { useEffect, useRef, useState } from "react"

/**
 * True once a Recap Pro session seen on this page has ended (a 401 cleared the token, or the user
 * signed out), until the next sign-in. A page that loads signed out was never signed in here.
 */
export function useSignedOut(signedIn: boolean): boolean {
  const [lost, setLost] = useState(false)
  const was = useRef(signedIn)
  useEffect(() => {
    if (was.current && !signedIn) setLost(true)
    if (signedIn) setLost(false)
    was.current = signedIn
  }, [signedIn])
  return lost
}
