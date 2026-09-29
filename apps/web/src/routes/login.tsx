import { createFileRoute, Link } from '@tanstack/react-router'
import { Card } from '#/components/ui/card'
import { Separator } from '#/components/ui/separator'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { env } from '#/env'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { RiGiftFill, RiArrowLeftLine } from 'react-icons/ri'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      width="1em"
      height="1em"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  )
}

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const [email, setEmail] = useState('')
  const [isMagicLoading, setIsMagicLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Google is optional; hide its button (and the "or" divider) when unconfigured.
  const googleEnabled = Boolean(env.VITE_GOOGLE_AUTH_ENABLED)

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsMagicLoading(true)
    try {
      const res: any = await authClient.signIn.magicLink({
        email,
        callbackURL: '/dashboard',
      })
      if (res?.error) {
        setError(
          res.error.message ||
            res.error.statusText ||
            'Failed to send magic link. Please try again.',
        )
        return
      }
      setMagicSent(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to send magic link. Please try again.')
    } finally {
      setIsMagicLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setIsGoogleLoading(true)
    try {
      const res: any = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/dashboard',
      })
      if (res?.error) {
        setError(
          res.error.message ||
            res.error.statusText ||
            'Google sign-in failed. Please try again.',
        )
        setIsGoogleLoading(false)
      }
      // on success better-auth redirects, keep loading true
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed. Please try again.')
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md p-6">
        <Card.Header className="flex-col items-start gap-1 pb-4">
          <Link
            to="/"
            className="mb-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            <RiArrowLeftLine /> Back to home
          </Link>

          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-amber-500 text-white shadow-sm">
              <RiGiftFill className="text-lg" />
            </span>
            <span className="text-xl font-bold tracking-tight text-gray-900">
              GiftForm
            </span>
          </div>

          <Card.Title className="mt-2 text-xl font-semibold">
            Sign in to your account
          </Card.Title>
          <Card.Description className="text-sm text-gray-500">
            Welcome back! Choose how you'd like to sign in.
          </Card.Description>
        </Card.Header>

        <Card.Content className="space-y-4 pt-2">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {googleEnabled && (
            <>
              <Button
                type="button"
                className="w-full justify-center"
                variant="secondary"
                isLoading={isGoogleLoading}
                onClick={handleGoogle}
                startContent={
                  !isGoogleLoading && <GoogleIcon className="text-lg" />
                }
              >
                {isGoogleLoading
                  ? 'Connecting to Google...'
                  : 'Continue with Google'}
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  or
                </span>
                <Separator className="flex-1" />
              </div>
            </>
          )}

          {magicSent ? (
            <div className="rounded-lg bg-emerald-50 p-4 text-center text-sm text-emerald-800 border border-emerald-200">
              <p className="font-semibold">Check your email!</p>
              <p className="mt-1 text-emerald-700">
                We sent a login link to <strong>{email}</strong>. Click it to
                sign in.
              </p>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <Input
                type="email"
                label="Email address"
                placeholder="you@example.com"
                value={email}
                onChange={(e: any) => {
                  if (error) setError(null)
                  setEmail(e.target.value)
                }}
                isInvalid={!!error && !magicSent}
                required
              />

              <Button
                type="submit"
                className="w-full justify-center"
                variant="primary"
                isLoading={isMagicLoading}
              >
                Send Magic Link
              </Button>
            </form>
          )}
        </Card.Content>
      </Card>
    </div>
  )
}
