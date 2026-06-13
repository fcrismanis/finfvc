import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'

export function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
    } else if (mode === 'signup') {
      setInfo('Conta criada. Verifique seu e-mail para confirmar o cadastro.')
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
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-extrabold"
            style={{ background: 'var(--accent)' }}
          >
            F
          </div>
          <span className="font-extrabold text-[17px]" style={{ color: '#101828' }}>FIN</span>
        </div>

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
              style={{
                border: '1px solid var(--border-card)',
                color: '#101828',
                background: '#FAFAFA',
              }}
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
              style={{
                border: '1px solid var(--border-card)',
                color: '#101828',
                background: '#FAFAFA',
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-[12px] px-3 py-2 rounded-lg bg-red-50 border border-red-200" style={{ color: '#B42318' }}>
              {error}
            </p>
          )}
          {info && (
            <p className="text-[12px] px-3 py-2 rounded-lg bg-green-50 border border-green-200" style={{ color: '#027A48' }}>
              {info}
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
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }}
            className="font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            {mode === 'signin' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </div>
    </div>
  )
}
