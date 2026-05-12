-- TABELA DE USUÁRIOS/LOJISTAS
create table usuarios (
  id uuid primary key default gen_random_uuid(),
  nome varchar(150) not null,
  email varchar(150) unique not null,
  senha_hash text not null,
  role varchar(20) default 'lojista', -- admin | lojista
  ativo boolean default true,
  criado_em timestamp default now()
);

-- TABELA DE PRODUTOS
create table produtos (
  id uuid primary key default gen_random_uuid(),
  codigo varchar(50) unique not null,
  nome varchar(200) not null,
  marca varchar(100),
  categoria varchar(100),
  descricao text,
  caracteristicas text,
  indicacao_uso text,
  materiais text,
  garantia varchar(50),
  preco_vista numeric(10,2),
  preco_prazo numeric(10,2),
  estoque integer default 0,
  ativo boolean default true,
  criado_em timestamp default now()
);

-- TABELA DE FOTOS DOS PRODUTOS
create table produto_fotos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references produtos(id) on delete cascade,
  url text not null,
  ordem integer default 0,
  criado_em timestamp default now()
);

-- TABELA DE PEDIDOS
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  numero serial,
  lojista_id uuid references usuarios(id),
  lojista_nome varchar(150),
  lojista_email varchar(150),
  status varchar(30) default 'novo',
  total_vista numeric(10,2),
  total_prazo numeric(10,2),
  observacoes text,
  criado_em timestamp default now()
);

-- TABELA DE ITENS DO PEDIDO
create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedidos(id) on delete cascade,
  produto_id uuid references produtos(id),
  produto_codigo varchar(50),
  produto_nome varchar(200),
  produto_marca varchar(100),
  quantidade integer not null,
  preco_vista numeric(10,2),
  preco_prazo numeric(10,2),
  subtotal_vista numeric(10,2),
  subtotal_prazo numeric(10,2)
);

-- INSERIR ADMIN PADRÃO (senha: admin123 - trocar depois)
insert into usuarios (nome, email, senha_hash, role)
values ('Administrador', 'admin@megarepresentante.com.br', 'admin123', 'admin');

-- POLÍTICAS DE SEGURANÇA (RLS)
alter table produtos enable row level security;
alter table produto_fotos enable row level security;
alter table pedidos enable row level security;
alter table pedido_itens enable row level security;
alter table usuarios enable row level security;

-- Permitir leitura de produtos para todos autenticados
create policy "Produtos visíveis para lojistas" on produtos
  for select using (ativo = true);

create policy "Fotos visíveis para lojistas" on produto_fotos
  for select using (true);

-- Admin pode tudo
create policy "Admin gerencia produtos" on produtos
  for all using (true);
