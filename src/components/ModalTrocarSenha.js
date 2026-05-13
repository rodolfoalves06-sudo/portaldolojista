import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ModalTrocarSenha({ usuario, onFechar }) {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function trocarSenha() {
    setErro('')
    setSucesso('')

    if (senhaAtual !== usuario.senha_hash) {
      setErro('Senha atual incorreta.')
      return
    }
    if (novaSenha.length < 6) {
      setErro('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }

    setCarregando(true)
    const { error } = await supabase
      .from('usuarios')
      .update({ senha_hash: novaSenha })
      .eq('id', usuario.id)

    if (error) {
      setErro('Erro ao trocar a senha. Tente novamente.')
    } else {
      const usuarioAtualizado = { ...usuario, senha_hash: novaSenha }
      localStorage.setItem('usuario_portal', JSON.stringify(usuarioAtualizado))
      setSucesso('✅ Senha trocada com sucesso!')
      setTimeout(() => onFechar(usuarioAtualizado), 1500)
    }
    setCarregando(false)
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.titulo}>🔐 Trocar Senha</h2>
          <button style={styles.btnFechar} onClick={() => onFechar(null)}>×</button>
        </div>
        <div style={styles.body}>
          <div style={styles.campo}>
            <label style={styles.label}>Senha atual</label>
            <input type="password" style={styles.input} value={senhaAtual}
              onChange={e => setSenhaAtual(e.target.value)} placeholder="••••••••" />
          </div>
          <div style={styles.campo}>
            <label style={styles.label}>Nova senha</label>
            <input type="password" style={styles.input} value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div style={styles.campo}>
            <label style={styles.label}>Confirmar nova senha</label>
            <input type="password" style={styles.input} value={confirmar}
              onChange={e => setConfirmar(e.target.value)} placeholder="Repita a nova senha"
              onKeyDown={e => e.key === 'Enter' && trocarSenha()} />
          </div>
          {erro && <p style={styles.erro}>{erro}</p>}
          {sucesso && <p style={styles.sucesso}>{sucesso}</p>}
          <button style={{ ...styles.btnSalvar, opacity: carregando ? 0.7 : 1 }}
            onClick={trocarSenha} disabled={carregando}>
            {carregando ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
  },
  header: {
    backgroundColor: '#0f2744', padding: '16px 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  titulo: { color: '#fff', margin: 0, fontSize: 18 },
  btnFechar: {
    background: 'none', border: 'none', color: '#fff',
    fontSize: 24, cursor: 'pointer', lineHeight: 1,
  },
  body: { padding: 24 },
  campo: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  erro: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
  sucesso: { color: '#10b981', fontSize: 13, marginBottom: 12 },
  btnSalvar: {
    width: '100%', padding: '12px', backgroundColor: '#c8922a',
    color: '#fff', border: 'none', borderRadius: 8,
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
}