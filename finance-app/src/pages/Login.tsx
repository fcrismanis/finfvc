import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup' | 'email-sent'

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: 'var(--ink)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: 'var(--card-bg)', fontSize: 15, fontWeight: 900, letterSpacing: '-.02em',
      }}>
        F
      </div>
      <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-.03em', color: 'var(--ink)' }}>FIN</span>
    </div>
  )
}

function EmailSentView({ email, onBack }: { email: string; onBack: () => void }) {
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleResend() {
    setResendLoading(true)
    setResendMsg(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) {
      setResendMsg({ type: 'err', text: error.message })
    } else {
      setResendMsg({ type: 'ok', text: 'E-mail reenviado. Verifique sua caixa de entrada.' })
    }
    setResendLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 11,
        background: 'var(--accent-soft)', border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 22, fontFamily: 'var(--mono)' }}>@</span>
      </div>

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.03em', color: 'var(--ink)', marginBottom: 6 }}>
          Verifique seu e-mail
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          Enviamos um link de confirmação para{' '}
          <strong style={{ color: 'var(--ink)' }}>{email}</strong>.
        </p>
      </div>

      <div style={{
        background: 'var(--well)', border: '1px solid var(--line)',
        borderRadius: 9, padding: '12px 14px',
        fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6,
      }}>
        Verifique sua caixa de entrada e o spam. Após confirmar, volte aqui e faça login.
      </div>

      {resendMsg && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 12,
          background: resendMsg.type === 'ok' ? 'var(--pos-soft)' : 'var(--crit-soft)',
          border: `1px solid ${resendMsg.type === 'ok' ? 'var(--pos)' : 'var(--crit)'}`,
          color: resendMsg.type === 'ok' ? 'var(--pos)' : 'var(--crit)',
        }}>
          {resendMsg.text}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={handleResend}
          disabled={resendLoading}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '10px', opacity: resendLoading ? 0.65 : 1 }}
        >
          {resendLoading ? 'Enviando…' : 'Reenviar e-mail de confirmação'}
        </button>
        <button
          onClick={onBack}
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '10px' }}
        >
          Voltar para login
        </button>
      </div>
    </div>
  )
}

export function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetToSignin() {
    setMode('signin')
    setPassword('')
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (!data.session) {
        setMode('email-sent')
      }
    }

    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: 'var(--paper)',
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'var(--card-bg)', borderRadius: 14,
        border: '1px solid var(--line)', padding: '32px 36px',
        boxShadow: 'var(--shadow-card)',
      }}>
        <Logo />

        {mode === 'email-sent' ? (
          <EmailSentView email={email} onBack={resetToSignin} />
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.03em', color: 'var(--ink)', marginBottom: 4 }}>
              {mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 22 }}>
              {mode === 'signin' ? 'Acesse suas finanças familiares.' : 'Crie sua conta FIN.'}
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="eyebrow">E-mail</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="login-field"
                  placeholder="voce@email.com"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="eyebrow">Senha</label>
                <input
                  type="password"
                  required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="login-field"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--crit-soft)', border: '1px solid var(--crit)', fontSize: 12, color: 'var(--crit)' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '10px', opacity: loading ? 0.65 : 1 }}
              >
                {loading ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
              </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', marginTop: 18 }}>
              {mode === 'signin' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
                style={{ fontWeight: 700, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--ui)', textDecoration: 'underline' }}
              >
                {mode === 'signin' ? 'Criar conta' : 'Entrar'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
