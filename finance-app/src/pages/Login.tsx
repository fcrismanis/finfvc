import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup' | 'email-sent'

function Logo() {
  return (
    <div className="flex items-center gap-2 mb-8">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-extrabold"
        style={{ background: 'var(--accent)' }}
      >
        F
      </div>
      <span className="font-extrabold text-[17px]" style={{ color: '#101828' }}>FIN</span>
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
    <div className="flex flex-col gap-5">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
        style={{ background: '#ECFDF3' }}
        aria-hidden="true"
      >
        ✉️
      </div>

      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight mb-1" style={{ color: '#101828' }}>
          Verifique seu e-mail
        </h1>
        <p className="text-[13px]" style={{ color: '#475467' }}>
          Enviamos um link de confirmação para{' '}
          <strong style={{ color: '#101828' }}>{email}</strong>.
        </p>
      </div>

      <div
        className="rounded-xl p-4 text-[13px] leading-relaxed"
        style={{ background: '#F9FAFB', border: '1px solid var(--border-card)', color: '#344054' }}
      >
        Verifique sua caixa de entrada e o spam. Depois de confirmar, volte aqui e faça login.
      </div>

      {resendMsg && (
        <p
          className={`text-[12px] px-3 py-2 rounded-lg ${resendMsg.type === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
          style={{ color: resendMsg.type === 'ok' ? '#027A48' : '#B42318' }}
        >
          {resendMsg.text}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={handleResend}
          disabled={resendLoading}
          className="w-full py-2.5 rounded-lg text-[14px] font-bold transition-opacity"
          style={{
            background: 'var(--accent)', color: '#fff',
            opacity: resendLoading ? 0.7 : 1,
          }}
        >
          {resendLoading ? 'Enviando…' : 'Reenviar e-mail de confirmação'}
        </button>

        <button
          onClick={onBack}
          className="w-full py-2.5 rounded-lg text-[14px] font-semibold transition-colors"
          style={{
            background: 'transparent',
            color: '#344054',
            border: '1px solid var(--border-card)',
          }}
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
        // Confirmation required — swap to email-sent view
        setMode('email-sent')
      }
      // If data.session exists, onAuthStateChange in AuthContext handles login
    }

    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-page)' }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl p-8"
        style={{ border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}
      >
        <Logo />

        {mode === 'email-sent' ? (
          <EmailSentView email={email} onBack={resetToSignin} />
        ) : (
          <>
            <h1 className="text-[22px] font-extrabold tracking-tight mb-1" style={{ color: '#101828' }}>
              {mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </h1>
            <p className="text-[13px] mb-6" style={{ color: '#98A2B3' }}>
              {mode === 'signin' ? 'Acesse suas finanças familiares.' : 'Crie sua conta FIN.'}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold" style={{ color: '#344054' }}>E-mail</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-[14px] outline-none transition-colors"
                  style={{ border: '1px solid var(--border-card)', color: '#101828', background: '#FAFAFA' }}
                  placeholder="voce@email.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold" style={{ color: '#344054' }}>Senha</label>
                <input
                  type="password"
                  required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-[14px] outline-none transition-colors"
                  style={{ border: '1px solid var(--border-card)', color: '#101828', background: '#FAFAFA' }}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-[12px] px-3 py-2 rounded-lg bg-red-50 border border-red-200" style={{ color: '#B42318' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-[14px] font-bold text-white transition-opacity"
                style={{ background: 'var(--accent)', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
              </button>
            </form>

            <p className="text-center text-[12px] mt-5" style={{ color: '#98A2B3' }}>
              {mode === 'signin' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
                className="font-semibold"
                style={{ color: 'var(--accent)' }}
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
