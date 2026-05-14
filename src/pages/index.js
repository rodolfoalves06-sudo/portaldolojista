import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import ModalTrocarSenha from '../components/ModalTrocarSenha'

export default function Home() {
  const [usuario, setUsuario] = useState(null)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [produtos, setProdutos] = useState([])
  const [filtrados, setFiltrados] = useState([])
  const [busca, setBusca] = useState('')
  const [filtroMarca, setFiltroMarca] = useState('')
  const [filtroEst, setFiltroEst] = useState('')
  const [carrinho, setCarrinho] = useState([])
  const [cartAberto, setCartAberto] = useState(false)
  const [aba, setAba] = useState('produtos')
  const [pagina, setPagina] = useState(1)
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [modalSenha, setModalSenha] = useState(false)
  const [qtds, setQtds] = useState({})
  const POR_PAG = 20

  const marcas = [...new Set(produtos.map(p => p.marca).filter(Boolean))].sort()

  useEffect(() => {
    const u = localStorage.getItem('usuario_portal')
    if (u) setUsuario(JSON.parse(u))
  }, [])

  useEffect(() => {
    if (usuario) carregarProdutos()
  }, [usuario])

  useEffect(() => {
    filtrar()
  }, [produtos, busca, filtroMarca, filtroEst])

  useEffect(() => {
    function fecharMenu(e) {
      if (!e.target.closest('.user-menu-wrapper')) setMenuUsuario(false)
    }
    document.addEventListener('mousedown', fecharMenu)
    return () => document.removeEventListener('mousedown', fecharMenu)
  }, [])

  async function carregarProdutos() {
    const { data } = await supabase
      .from('produtos')
      .select('*, produto_fotos(*)')
      .eq('ativo', true)
      .order('marca')
    if (data) setProdutos(data)
  }

  function filtrar() {
    let r = [...produtos]
    if (filtroMarca) r = r.filter(p => p.marca === filtroMarca)
    if (filtroEst === 'disp') r = r.filter(p => p.estoque > 0)
    if (filtroEst === 'zero') r = r.filter(p => p.estoque === 0)
    if (busca) {
      const q = busca.toLowerCase()
      r = r.filter(p =>
        p.nome?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q) ||
        p.marca?.toLowerCase().includes(q) ||
        p.categoria?.toLowerCase().includes(q)
      )
    }
    setFiltrados(r)
    setPagina(1)
  }

  function getQtd(id) {
    return qtds[id] || 1
  }

  function setQtd(id, val) {
    setQtds(prev => ({ ...prev, [id]: Math.max(1, val) }))
  }

  async function fazerLogin() {
    setErro('')
    setCarregando(true)
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('ativo', true)
      .single()

    if (data && data.senha_hash === senha) {
      localStorage.setItem('usuario_portal', JSON.stringify(data))
      setUsuario(data)
    } else {
      setErro('Email ou senha incorretos')
    }
    setCarregando(false)
  }

  function sair() {
    localStorage.removeItem('usuario_portal')
    setUsuario(null)
    setCarrinho([])
    setMenuUsuario(false)
  }

  function addCarrinho(produto, qtd) {
    setCarrinho(prev => {
      const ex = prev.find(i => i.id === produto.id)
      if (ex) return prev.map(i => i.id === produto.id ? { ...i, qtd: i.qtd + qtd } : i)
      return [...prev, { ...produto, qtd }]
    })
    setCartAberto(true)
  }

  function rmCarrinho(id) {
    setCarrinho(prev => prev.filter(i => i.id !== id))
  }

  function totalVista() {
    return carrinho.reduce((s, i) => s + (i.preco_vista || 0) * i.qtd, 0)
  }

  function totalPrazo() {
    return carrinho.reduce((s, i) => s + (i.preco_prazo || 0) * i.qtd, 0)
  }

  async function finalizarPedido() {
    if (!carrinho.length) return

    const { data: pedido } = await supabase.from('pedidos').insert({
      lojista_id: usuario.id,
      lojista_nome: usuario.nome,
      lojista_email: usuario.email,
      total_vista: totalVista(),
      total_prazo: totalPrazo(),
      status: 'novo'
    }).select().single()

    if (pedido) {
      await supabase.from('pedido_itens').insert(
        carrinho.map(i => ({
          pedido_id: pedido.id,
          produto_id: i.id,
          produto_codigo: i.codigo,
          produto_nome: i.nome,
          produto_marca: i.marca,
          quantidade: i.qtd,
          preco_vista: i.preco_vista,
          preco_prazo: i.preco_prazo,
          subtotal_vista: (i.preco_vista || 0) * i.qtd,
          subtotal_prazo: (i.preco_prazo || 0) * i.qtd,
        }))
      )
    }

    const wpp = process.env.NEXT_PUBLIC_WHATSAPP
    const data = new Date().toLocaleDateString('pt-BR')
    const linhas = [
      `*🛒 Novo Pedido — Portal do Lojista Multimarcas*`,
      ``,
      `Lojista: *${usuario.nome}*`,
      `Email: ${usuario.email}`,
      `Data: ${data}`,
      ``,
    ]
    carrinho.forEach(i => {
      linhas.push(`• *${i.nome}*`)
      linhas.push(`  Marca: ${i.marca} | Cód: ${i.codigo}`)
      linhas.push(`  Qtd: ${i.qtd} | À vista: R$ ${((i.preco_vista || 0) * i.qtd).toLocaleString('pt-BR')}`)
      linhas.push(``)
    })
    linhas.push(`*Total à vista: R$ ${totalVista().toLocaleString('pt-BR')}*`)
    linhas.push(`*Total a prazo: R$ ${totalPrazo().toLocaleString('pt-BR')}*`)

    const msg = encodeURIComponent(linhas.join('\n'))
    window.open(`https://wa.me/55${wpp}?text=${msg}`, '_blank')

    gerarPDF()
    setCarrinho([])
    setCartAberto(false)
    alert('Pedido enviado com sucesso! ✅')
  }

  function gerarPDF() {
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF()
        doc.setFontSize(18)
        doc.setTextColor(15, 39, 68)
        doc.text('Portal do Lojista Multimarcas', 20, 20)
        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text(`Lojista: ${usuario.nome}`, 20, 30)
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, 36)
        doc.autoTable({
          startY: 44,
          head: [['Código', 'Produto', 'Marca', 'Qtd', 'À vista', 'A prazo']],
          body: carrinho.map(i => [
            i.codigo,
            i.nome.substring(0, 30),
            i.marca,
            i.qtd,
            `R$ ${((i.preco_vista || 0) * i.qtd).toLocaleString('pt-BR')}`,
            `R$ ${((i.preco_prazo || 0) * i.qtd).toLocaleString('pt-BR')}`,
          ]),
          foot: [[
            '', '', '', '',
            `R$ ${totalVista().toLocaleString('pt-BR')}`,
            `R$ ${totalPrazo().toLocaleString('pt-BR')}`,
          ]],
          headStyles: { fillColor: [15, 39, 68] },
          footStyles: { fillColor: [200, 146, 42], textColor: [15, 39, 68], fontStyle: 'bold' },
        })
        doc.save(`pedido-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`)
      })
    })
  }

  const paginado = filtrados.slice((pagina - 1) * POR_PAG, pagina * POR_PAG)
  const totalPag = Math.ceil(filtrados.length / POR_PAG)

  function catIcon(cat = '') {
    if (cat.includes('CARRINHO')) return '🛒'
    if (cat.includes('BOUNCER')) return '🪑'
    if (cat.includes('BANHEIRA')) return '🛁'
    if (cat.includes('BRINQUEDO')) return '🧸'
    if (cat.includes('BERCO') || cat.includes('BERÇO')) return '🛏️'
    if (cat.includes('REFEICAO') || cat.includes('REFEIÇÃO')) return '🍽️'
    return '💺'
  }

  if (!usuario) return (
    <>
      <Head>
        <title>Portal do Lojista Multimarcas</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f2744" />
      </Head>
      <div className="login-page">
        <div className="login-box">
          <div className="login-logo">
            <h1>Portal do <span>Lojista</span></h1>
            <p>Multimarcas — Área Exclusiva</p>
            <div className="gold-bar"></div>
          </div>
          <div className="form-group">
            <label>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seuemail@loja.com.br" onKeyDown={e => e.key === 'Enter' && fazerLogin()} />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
              placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && fazerLogin()} />
          </div>
          {erro && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{erro}</p>}
          <button className="btn-primary" onClick={fazerLogin} disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
          <p className="login-hint">Acesso exclusivo para lojistas cadastrados</p>
        </div>
      </div>
    </>
  )

  return (
    <>
      <Head>
        <title>Portal do Lojista Multimarcas</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f2744" />
      </Head>

      {modalSenha && (
        <ModalTrocarSenha
          usuario={usuario}
          onFechar={(usuarioAtualizado) => {
            if (usuarioAtualizado) setUsuario(usuarioAtualizado)
            setModalSenha(false)
            setMenuUsuario(false)
          }}
        />
      )}

      <div className="topbar">
        <div className="topbar-brand">Portal do <span>Lojista</span></div>
        <div className="topbar-right">

          <div className="user-menu-wrapper" style={{ position: 'relative' }}>
            <div className="user-pill" style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setMenuUsuario(v => !v)}>
              {usuario.nome} ▾
            </div>

            {menuUsuario && (
              <div style={{
                position: 'absolute', top: '110%', right: 0,
                backgroundColor: '#fff', borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                minWidth: 180, zIndex: 999, overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0f2744' }}>{usuario.nome}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{usuario.email}</p>
                </div>
                <button onClick={() => { setModalSenha(true); setMenuUsuario(false) }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 16px',
                    textAlign: 'left', background: 'none', border: 'none',
                    fontSize: 13, cursor: 'pointer', color: '#374151',
                  }}
                  onMouseOver={e => e.target.style.backgroundColor = '#f9fafb'}
                  onMouseOut={e => e.target.style.backgroundColor = 'transparent'}>
                  🔐 Trocar senha
                </button>
                <button onClick={sair}
                  style={{
                    display: 'block', width: '100%', padding: '10px 16px',
                    textAlign: 'left', background: 'none', border: 'none',
                    fontSize: 13, cursor: 'pointer', color: '#ef4444',
                    borderTop: '1px solid #f3f4f6',
                  }}
                  onMouseOver={e => e.target.style.backgroundColor = '#fef2f2'}
                  onMouseOut={e => e.target.style.backgroundColor = 'transparent'}>
                  🚪 Sair
                </button>
              </div>
            )}
          </div>

          <button className="cart-btn" onClick={() => setCartAberto(!cartAberto)}>
            🛒 Pedido <span className="cart-count">{carrinho.reduce((s,i)=>s+i.qtd,0)}</span>
          </button>
          <button className="btn-sair" onClick={sair}>Sair</button>
        </div>
      </div>

      <div className="nav-tabs">
        <div className={`nav-tab ${aba==='produtos'?'active':''}`} onClick={() => setAba('produtos')}>Produtos</div>
        {usuario.role === 'admin' && (
          <div className={`nav-tab ${aba==='admin'?'active':''}`} onClick={() => setAba('admin')}>Admin</div>
        )}
      </div>

      {cartAberto && carrinho.length > 0 && (
        <div className="cart-panel">
          <div className="cart-header">
            <h3>Seu pedido ({carrinho.reduce((s,i)=>s+i.qtd,0)} itens)</h3>
            <button className="btn-clear" onClick={() => setCarrinho([])}>Limpar tudo</button>
          </div>
          {carrinho.map((item, idx) => (
            <div className="cart-item" key={idx}>
              <div>
                <div className="cart-item-nome">{item.nome}</div>
                <div className="cart-item-detalhe">{item.marca} · Cód: {item.codigo} · Qtd: {item.qtd}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="cart-item-preco">
                  {item.preco_vista ? `R$ ${((item.preco_vista||0)*item.qtd).toLocaleString('pt-BR')}` : 'A consultar'}
                </span>
                <button className="btn-rm" onClick={() => rmCarrinho(item.id)}>×</button>
              </div>
            </div>
          ))}
          <div className="cart-total">
            <span>Total à vista</span>
            <span>R$ {totalVista().toLocaleString('pt-BR')}</span>
          </div>
          <div className="cart-actions">
            <button className="btn-pdf" onClick={gerarPDF}>📄 Gerar PDF</button>
            <button className="btn-wpp" onClick={finalizarPedido}>📱 Enviar WhatsApp</button>
          </div>
        </div>
      )}

      {aba === 'produtos' && (
        <>
          <div className="search-area">
            <input className="search-input" placeholder="Buscar por nome, código ou marca..."
              value={busca} onChange={e => setBusca(e.target.value)} />
            <select className="filter-select" value={filtroMarca} onChange={e => setFiltroMarca(e.target.value)}>
              <option value="">Todas as marcas</option>
              {marcas.map(m => <option key={m}>{m}</option>)}
            </select>
            <select className="filter-select" value={filtroEst} onChange={e => setFiltroEst(e.target.value)}>
              <option value="">Todo estoque</option>
              <option value="disp">Com estoque</option>
              <option value="zero">Sem estoque</option>
            </select>
          </div>

          <div className="content">
            <div className="stats-bar">
              <div className="stat-badge"><strong>{filtrados.length}</strong> produtos</div>
              <div className="stat-badge"><strong>{filtrados.filter(p=>p.estoque>0).length}</strong> com estoque</div>
              <div className="stat-badge"><strong>{filtrados.filter(p=>p.estoque===0).length}</strong> sem estoque</div>
            </div>

            <div className="produtos-grid">
              {paginado.map(p => {
                const fotos = p.produto_fotos || []
                const foto = fotos.sort((a,b)=>a.ordem-b.ordem)[0]
                const eC = p.estoque === 0 ? 'est-zero' : p.estoque <= 10 ? 'est-baixo' : 'est-ok'
                const eT = p.estoque === 0 ? 'Sem estoque' : p.estoque >= 200 ? '200+ un.' : p.estoque <= 10 ? `${p.estoque} un. (baixo)` : `${p.estoque} un.`

                return (
                  <div className="produto-card" key={p.id}>
                    <div className="produto-img">
                      {foto ? (
                        <img src={foto.url} alt={p.nome} />
                      ) : (
                        <div className="produto-img-placeholder">{catIcon(p.categoria)}</div>
                      )}
                      {p.marca && <span className="marca-badge">{p.marca}</span>}
                      {p.categoria && <span className="cat-badge">{p.categoria}</span>}
                    </div>
                    <div className="produto-body">
                      <div className="produto-nome">{p.nome.replace(/^SCD-/, '')}</div>
                      <div className="produto-cod">{p.codigo}</div>
                      <div className="precos">
                        <div className="preco-box">
                          <span className="preco-label">À vista</span>
                          {p.preco_vista
                            ? <span className="preco-vista">R$ {p.preco_vista.toLocaleString('pt-BR')}</span>
                            : <span className="preco-indefinido">A definir</span>}
                        </div>
                        <div className="preco-box">
                          <span className="preco-label">A prazo</span>
                          {p.preco_prazo
                            ? <span className="preco-prazo">R$ {p.preco_prazo.toLocaleString('pt-BR')}</span>
                            : <span className="preco-indefinido">A definir</span>}
                        </div>
                      </div>
                      <span className={`estoque-badge ${eC}`}>
                        <span className="est-dot"></span>{eT}
                      </span>
                      <div className="add-row">
                        <div className="qtd-ctrl">
                          <button className="qtd-btn" onClick={() => setQtd(p.id, getQtd(p.id) - 1)}>−</button>
                          <input className="qtd-num" type="number" value={getQtd(p.id)} min={1}
                            onChange={e => setQtd(p.id, parseInt(e.target.value)||1)} />
                          <button className="qtd-btn" onClick={() => setQtd(p.id, getQtd(p.id) + 1)}>+</button>
                        </div>
                        <button className="btn-add" disabled={p.estoque===0}
                          onClick={() => addCarrinho(p, getQtd(p.id))}>
                          {p.estoque===0 ? 'Sem estoque' : '+ Pedido'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPag > 1 && (
              <div className="paginacao">
                <button className="pg-btn" disabled={pagina===1} onClick={() => setPagina(p=>p-1)}>← Anterior</button>
                <span className="pg-info">Página {pagina} de {totalPag}</span>
                <button className="pg-btn" disabled={pagina===totalPag} onClick={() => setPagina(p=>p+1)}>Próxima →</button>
              </div>
            )}
          </div>
        </>
      )}

      {aba === 'admin' && usuario.role === 'admin' && (
        <div className="content">
          <AdminPanel onProdutoSalvo={carregarProdutos} />
        </div>
      )}
    </>
  )
}

function AdminPanel({ onProdutoSalvo }) {
  const [form, setForm] = useState({
    codigo: '', nome: '', marca: '', categoria: '',
    descricao: '', preco_vista: '', preco_prazo: '', estoque: ''
  })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [lojistas, setLojistas] = useState([])
  const [novoLojista, setNovoLojista] = useState({ nome: '', email: '', senha: '' })

  useEffect(() => {
    carregarLojistas()
  }, [])

  async function carregarLojistas() {
    const { data } = await supabase.from('usuarios').select('*').eq('role', 'lojista')
    if (data) setLojistas(data)
  }

  async function salvarProduto() {
    setSalvando(true)
    const { error } = await supabase.from('produtos').upsert({
      ...form,
      preco_vista: form.preco_vista ? parseFloat(form.preco_vista) : null,
      preco_prazo: form.preco_prazo ? parseFloat(form.preco_prazo) : null,
      estoque: parseInt(form.estoque) || 0,
    }, { onConflict: 'codigo' })

    if (!error) {
      setMsg('✅ Produto salvo com sucesso!')
      setForm({ codigo:'',nome:'',marca:'',categoria:'',descricao:'',preco_vista:'',preco_prazo:'',estoque:'' })
      onProdutoSalvo()
    } else {
      setMsg('❌ Erro: ' + error.message)
    }
    setSalvando(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function adicionarLojista() {
    const { error } = await supabase.from('usuarios').insert({
      ...novoLojista,
      senha_hash: novoLojista.senha,
      role: 'lojista'
    })
    if (!error) {
      setNovoLojista({ nome: '', email: '', senha: '' })
      carregarLojistas()
    }
  }

  return (
    <div className="admin-grid">
      <div className="admin-card">
        <h3>Cadastrar / Atualizar Produto</h3>
        {['codigo','nome','marca','categoria'].map(f => (
          <div className="form-field" key={f}>
            <label>{f.charAt(0).toUpperCase()+f.slice(1)}</label>
            <input value={form[f]} onChange={e => setForm({...form,[f]:e.target.value})} />
          </div>
        ))}
        <div className="form-field">
          <label>Descrição</label>
          <textarea value={form.descricao} onChange={e => setForm({...form,descricao:e.target.value})} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          <div className="form-field">
            <label>Preço à vista</label>
            <input type="number" value={form.preco_vista} onChange={e => setForm({...form,preco_vista:e.target.value})} />
          </div>
          <div className="form-field">
            <label>Preço a prazo</label>
            <input type="number" value={form.preco_prazo} onChange={e => setForm({...form,preco_prazo:e.target.value})} />
          </div>
          <div className="form-field">
            <label>Estoque</label>
            <input type="number" value={form.estoque} onChange={e => setForm({...form,estoque:e.target.value})} />
          </div>
        </div>
        {msg && <p style={{ fontSize:13, marginBottom:8 }}>{msg}</p>}
        <button className="btn-save" onClick={salvarProduto} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar Produto'}
        </button>
      </div>

      <div className="admin-card">
        <h3>Lojistas Cadastrados ({lojistas.length})</h3>
        <div style={{ marginBottom:16 }}>
          <div className="form-field"><label>Nome</label>
            <input value={novoLojista.nome} onChange={e => setNovoLojista({...novoLojista,nome:e.target.value})} /></div>
          <div className="form-field"><label>Email</label>
            <input value={novoLojista.email} onChange={e => setNovoLojista({...novoLojista,email:e.target.value})} /></div>
          <div className="form-field"><label>Senha</label>
            <input type="password" value={novoLojista.senha} onChange={e => setNovoLojista({...novoLojista,senha:e.target.value})} /></div>
          <button className="btn-save" onClick={adicionarLojista}>Adicionar Lojista</button>
        </div>
        <div style={{ maxHeight:300, overflowY:'auto' }}>
          {lojistas.map(l => (
            <div key={l.id} style={{ padding:'8px 0', borderBottom:'1px solid #f3f4f6', fontSize:13 }}>
              <strong>{l.nome}</strong><br/>
              <span style={{ color:'#9ca3af' }}>{l.email}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
