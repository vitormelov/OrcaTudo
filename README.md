# Orça Obra

Sistema web de **orçamentos de obra** para engenheiros, orçamentistas e pequenas construtoras. Reúne insumos, composições, orçamentos com EAP, curva ABC, comparativo de revisões e gestão multiempresa — com React e Firebase.

> Nome comercial na interface: **Orça Obra** · repositório / projeto Firebase histórico: OrcaTudo.

---

## O que o sistema faz

### Site público (antes do login)

- **Home (`/`)** — apresentação do produto, oferta do mês e cards de planos
- **Toggle Mensal / Anual** — valores atualizam nos cards (padrão: anual com desconto extra)
- **Assinar (`/assinar`)** — formulário de conta + endereço de cobrança (CEP via ViaCEP)
- **Login (`/login`)** — acesso por e-mail e senha (sem cadastro público nesta tela)

| Plano | Usuários | De | Por (mensal) |
|-------|----------|-----|--------------|
| **Essencial** | 1–2 | R$ 169 | **R$ 129**/mês |
| **Empresa** (mais popular) | até 5 | R$ 229 | **R$ 179**/mês |
| **Equipe** | até 10 | R$ 319 | **R$ 249**/mês |

No ciclo **anual**, há **17% de desconto** adicional sobre o preço promocional mensal.

> **Pagamento:** o fluxo de compra na interface está pronto (UI). A integração real com **Mercado Pago** (checkout + webhook + criação automática de conta) ainda será ligada via backend (Cloud Functions).

---

### Autenticação e empresas

- Login com **e-mail e senha** (Firebase Auth)
- Após o login, o usuário escolhe a **empresa** (`/empresas`) antes de entrar no app
- Dados de insumos, composições e orçamentos ficam isolados por **`empresaId`**
- Papéis:
  - **Administrador da plataforma** — gerencia empresas e usuários (`/admin`)
  - **Colaborador** — pode criar e editar dados da empresa
  - **Membro (somente leitura)** — visualiza, sem gravar
- **Bloqueio** de usuário ou de empresa (membros não entram; admin ainda pode)
- Contas de uso são **criadas pelo administrador** (ou, no futuro, após pagamento aprovado)

---

### Dashboard (`/app`)

- Cards: insumos criados, composições criadas, orçamentos criados, clientes, valor total em orçamento **aprovado**
- **Resumo do orçamento** — pacotes e totais do orçamento ativo selecionado
- **Orçamentos por status** — Em Análise, Aprovado, Rejeitado, Em Execução, Concluído
- Tabela de **orçamentos recentes** com atalho para a EAP

---

### Insumos (`/insumos`)

- Cadastro com código, nome, categoria, unidade e preço unitário
- Categorias: **Material**, **Mão de Obra**, **Equipamento**, **Serviço**
- Unidades padrão (m², m³, kg, un, etc.)
- Busca, ordenação e exclusão em lote (quando permitido)
- **Histórico de preços** com gráfico
- Ao alterar o preço, atualiza composições que usam o insumo
- **Catálogo SEINFRA** — busca e cópia de insumos da base pública para o cadastro da empresa

---

### Composições (`/composicoes`)

- Montagem de serviços a partir de um ou mais insumos (com quantidades)
- Cálculo automático do custo total com base nos preços atuais
- Cópia de composição, busca, ordenação e exclusão (com proteção se estiver em orçamentos)
- Detalhe com subtotais por categoria de insumo
- **Catálogo SEINFRA** — importa composição e cria insumos SEINFRA faltantes automaticamente

---

### Orçamentos (`/orcamentos`)

- Cadastro com nome, descrição, cliente, endereço e data
- Status: **Em Análise**, **Aprovado**, **Rejeitado**, **Em Execução**, **Concluído**
- Valores **sem BDI** e **com BDI**
- **Revisões** — gera nova revisão (copia a EAP, trava a anterior, reabre em “Em Análise”)
- **Cópia como nova obra**
- Lista com busca, ordenação e link direto para a EAP
- Revisões obsoletas/travadas em modo leitura

---

### EAP — Estrutura Analítica do Projeto (`/orcamentos/:id/eap`)

- Hierarquia **Pacote → Grupo → Subgrupo → composições**
- Inclusão de composições do catálogo com quantidades
- Arrastar e soltar (drag-and-drop) para reorganizar
- Subtotais por categoria e gráfico de participação por pacote
- **BDI** configurável (lucro, tributos, financeiro, garantias) com aplicação / remoção
- Controle de status e criação de nova revisão
- Salvamento com aviso de alterações não salvas
- **Exportações:**
  - Planilha orçamentária em **PDF** e **Excel**
  - Planilha de venda (com BDI embutido) em **PDF** e **Excel**
- Atalho para a Curva ABC do orçamento

---

### Curva ABC (`/orcamentos/:id/curva-abc`)

- Análise de Pareto (classes A / B / C)
- Alternância entre visão por **insumos** ou por **composições**
- Resumo + tabela detalhada
- Exportação em **PDF**

---

### Comparativo (`/comparativo`)

- Compara **duas revisões** da mesma obra
- Diferenças em composições e insumos (incluídos, removidos, quantidade/preço alterados)
- Totais com e sem BDI e deltas
- Filtro: só mudanças ou todas as linhas

---

### Administração (`/admin`)

- Cadastro e edição de **empresas** (nome, endereço, telefone, e-mail, CNPJ)
- Bloquear / desbloquear / excluir empresa
- Criar usuários (Auth + vínculo à empresa + flag colaborador)
- Editar, bloquear e excluir usuários
- Visões: lista de empresas (com contagem de usuários) e lista geral de usuários

---

## Tecnologias

| Camada | Stack |
|--------|--------|
| Frontend | React 18, React Router 6, Bootstrap 5, React Bootstrap, React Icons |
| Backend | Firebase Authentication + Cloud Firestore |
| Gráficos | Chart.js / react-chartjs-2 |
| PDF | jsPDF + jspdf-autotable |
| Excel | xlsx-js-style |
| DnD (EAP) | @dnd-kit |
| Estilo | Design tokens + CSS próprio (`src/styles/design-tokens.css`, `App.css`) |
| Hosting | Firebase Hosting (SPA) |

---

## Pré-requisitos

- Node.js 16+
- npm
- Projeto Firebase com **Authentication (E-mail/senha)** e **Firestore** ativos
- Publicação das regras e índices (`firestore.rules`, `firestore.indexes.json`)

---

## Instalação e execução

```bash
git clone <url-do-repositorio>
cd OrcaTudo
npm install
npm start
```

App em `http://localhost:3000`.

### Scripts úteis

| Comando | Função |
|---------|--------|
| `npm start` / `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` | Build de produção |
| `npm test` | Testes |
| `npm run convert-seinfra` | Converte base SEINFRA de insumos |
| `npm run convert-composicoes-seinfra` | Converte base SEINFRA de composições |

### Firebase

1. Configure (ou use) o projeto em `src/firebase/config.js`
2. Publique regras e índices:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

3. Build + hosting:

```bash
npm run build
firebase deploy --only hosting
```

> As regras de exemplo antigas (isolamento só por `userId`) **não** são mais válidas. Use o arquivo `firestore.rules` do repositório (tenancy por `empresaId`, papéis e bloqueios).

---

## Fluxo de uso típico

1. Admin cria a **empresa** e o **usuário** (ou, no futuro, o cliente assina na home)
2. Usuário faz **login** e escolhe a empresa
3. Cadastra **insumos** (próprios e/ou SEINFRA)
4. Monta **composições**
5. Cria o **orçamento** e monta a **EAP**
6. Aplica **BDI**, muda **status**, gera **revisões**
7. Analisa **Curva ABC**, **compara revisões** e exporta **PDF/Excel**

---

## Estrutura do projeto (resumo)

```
src/
├── components/       # Telas (Home, Login, Dashboard, Insumos, EAP, Admin…)
├── contexts/         # AuthContext, EmpresaContext
├── constants/        # admin, planos comerciais
├── firebase/         # config Firebase
├── utils/            # EAP, exports PDF/Excel, formatters…
├── styles/           # design tokens
├── App.js
└── App.css
public/
├── images/           # logo e favicon
├── insumos/          # catálogo SEINFRA (JSON)
└── composicoes/      # catálogo SEINFRA (JSON)
firestore.rules
firestore.indexes.json
firebase.json
```

---

## Modelo de dados (Firestore)

| Coleção | Uso |
|---------|-----|
| `usuarios` | Perfil, admin, bloqueio, vínculos com empresas |
| `empresas` | Cadastro da empresa (pode estar bloqueada) |
| `empresas/{id}/membros` | Membros e flag `colaborador` |
| `insumos` (+ subcoleção `precos`) | Cadastro e histórico de preços |
| `composicoes` | Serviços montados com insumos |
| `orcamentos` | Uma revisão por documento (`obraId` + `revisao`) |

Catálogos SEINFRA ficam em arquivos estáticos em `public/`, não no Firestore.

---

## Segurança

- Rotas do app protegidas (`PrivateRoute`)
- Isolamento por **empresa** (`empresaId`)
- Escrita restrita a **colaboradores** (e admin)
- Bloqueio de usuário/empresa respeitado no app e nas regras
- Checkout **não** coleta dados de cartão no site (destino: Mercado Pago)

---

## Roadmap conhecido

- [ ] Integração real **Mercado Pago** (Checkout / Assinaturas + webhook)
- [ ] Criação automática de conta e empresa após pagamento aprovado
- [ ] Enforce dos limites de usuários por plano (Essencial / Empresa / Equipe)
- [ ] (Opcional) importação de planilhas Excel na UI

---

## Suporte

Dúvidas ou problemas: abra uma issue no repositório ou fale com o administrador da plataforma.

---

**Orça Obra** — orçamentos de construção civil com clareza e controle.
