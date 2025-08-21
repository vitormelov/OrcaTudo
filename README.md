# 🏗️ Sistema de Orçamento de Obra

Um sistema completo para gerenciamento de orçamentos de obra, desenvolvido com React e Firebase.

## ✨ Funcionalidades

### 🔧 Insumos
- Cadastro de materiais básicos (cimento, tijolo, mão de obra, etc.)
- Categorização por tipo (Material, Mão de Obra, Equipamento, Serviço)
- Definição de unidades de medida (m², m³, kg, l, un, m, pç)
- Controle de preços unitários
- Busca e filtros

### 🏗️ Composições
- Criação de composições combinando múltiplos insumos
- Categorização por tipo de serviço (Fundação, Estrutura, Alvenaria, etc.)
- Cálculo automático de custos
- Reutilização em diferentes orçamentos

### 📋 Orçamentos
- Criação de orçamentos completos para projetos
- Adição de múltiplas composições
- Cálculo automático de valores totais
- Controle de status (Em Análise, Aprovado, Rejeitado, etc.)
- Informações do cliente e projeto

## 🚀 Tecnologias Utilizadas

- **Frontend**: React 18, React Bootstrap, React Icons
- **Backend**: Firebase (Firestore, Authentication)
- **Estilização**: Bootstrap 5, CSS personalizado
- **Roteamento**: React Router DOM

## 📋 Pré-requisitos

- Node.js 16+ 
- npm ou yarn
- Conta no Firebase

## 🛠️ Instalação

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd orcamento-obra
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o Firebase

1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Crie um novo projeto ou use um existente
3. Ative o Authentication (Email/Password)
4. Ative o Firestore Database
5. Configure as regras de segurança do Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

### 4. Configure as credenciais do Firebase

Edite o arquivo `src/firebase/config.js` e substitua as configurações:

```javascript
const firebaseConfig = {
  apiKey: "sua-api-key",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "seu-app-id"
};
```

### 5. Execute o projeto
```bash
npm start
```

O projeto estará disponível em `http://localhost:3000`

## 📱 Como Usar

### 1. Primeiro Acesso
- Crie uma conta no sistema
- Faça login com suas credenciais

### 2. Cadastro de Insumos
- Acesse a seção "Insumos"
- Clique em "Novo Insumo"
- Preencha: Nome, Descrição, Categoria, Unidade e Preço Unitário
- Salve o insumo

### 3. Criação de Composições
- Acesse a seção "Composições"
- Clique em "Nova Composição"
- Defina: Nome, Descrição e Categoria
- Adicione insumos com quantidades e custos
- O sistema calcula automaticamente o valor total

### 4. Geração de Orçamentos
- Acesse a seção "Orçamentos"
- Clique em "Novo Orçamento"
- Preencha: Nome do Projeto, Cliente, Endereço e Data
- Adicione composições com quantidades
- O sistema calcula o valor total do orçamento

## 🗂️ Estrutura do Projeto

```
src/
├── components/          # Componentes React
│   ├── Dashboard.js     # Dashboard principal
│   ├── Insumos.js       # Gerenciamento de insumos
│   ├── Composicoes.js   # Gerenciamento de composições
│   ├── Orcamentos.js    # Gerenciamento de orçamentos
│   ├── Login.js         # Autenticação
│   ├── Navbar.js        # Navegação
│   └── PrivateRoute.js  # Rota protegida
├── contexts/            # Contextos React
│   └── AuthContext.js   # Contexto de autenticação
├── firebase/            # Configuração Firebase
│   └── config.js        # Configurações do Firebase
├── App.js               # Componente principal
├── App.css              # Estilos da aplicação
└── index.js             # Ponto de entrada
```

## 🔐 Segurança

- Autenticação obrigatória para todas as operações
- Dados isolados por usuário (userId)
- Validação de formulários
- Regras de segurança no Firestore

## 📊 Funcionalidades Avançadas

- **Dashboard**: Visão geral com estatísticas
- **Busca**: Filtros em todas as listas
- **Responsivo**: Interface adaptável para mobile
- **Impressão**: Funcionalidade de impressão de orçamentos
- **Categorização**: Organização por tipos e status

## 🚀 Deploy

### Build para Produção
```bash
npm run build
```

### Deploy no Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para dúvidas ou problemas:
- Abra uma issue no GitHub
- Entre em contato através do email: [seu-email@exemplo.com]

## 🔄 Atualizações Futuras

- [ ] Sistema de relatórios
- [ ] Exportação para PDF
- [ ] Múltiplos usuários por projeto
- [ ] Histórico de alterações
- [ ] API REST
- [ ] Aplicativo mobile

---

**Desenvolvido com ❤️ para facilitar o trabalho de profissionais da construção civil**
