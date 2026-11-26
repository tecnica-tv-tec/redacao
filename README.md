# Redação — Pautas e Espelho de Telejornal (SaaS)

Sistema de redação inspirado no Avid iNews: produção de **pautas**, **calendário** de pautas,
montagem do **espelho** (rundown) com cronometragem, **laudas**, prompter e equipe com login.

**Versão publicada:** https://tecnica-tv-tec.github.io/redacao/
(site no GitHub Pages, banco no Supabase, projeto `redacao-tvtec`, região São Paulo).
Cada envio para a branch `main` publica o site de novo, pelo fluxo `.github/workflows/pages.yml`.

## Módulos

| Tela | O que faz |
|---|---|
| **Pautas** | Cadastro no modelo: **1. Retranca** (nome da matéria) · **2. Proposta** (o que se espera da matéria) · **3. Marcação** (entrevistados: nome, função, contato, data, horário, local; roteiro de gravação) · **4. Informações** (o que o jornalista precisa saber). Mais: encaminhamento, equipe, perguntas, imagens/arte, observações. Indicador R·P·M·I na lista. Retranca e Proposta são obrigatórias; para marcar a pauta como "Pronta", "Gravada" ou "Exibida", os 4 itens precisam estar preenchidos. |
| **Capa da pauta** | Botão **🗒 Capa da pauta** na tela Pautas: cronograma do dia seguinte (a data pode ser trocada) em ordem de horário, com retranca, equipe, local e marcação, mais observações do dia. Dá para ver na tela, imprimir ou baixar PDF. As observações ficam guardadas só no aparelho de quem digitou. |
| **Transcrição** | Botão **🎙 Transcrever** na matéria: envia um áudio ou vídeo ao [transcribe.so](https://transcribe.so) e insere o texto como sonoras separadas por falante ou texto corrido, depois de conferido. Cada pessoa cola a própria chave de API (fica só no aparelho dela). Serviço externo e pago; recomenda-se definir limite de gastos na chave. |
| **Logotipo** | A tela Pautas, a capa, as pautas impressas ou em PDF e a lista impressa usam o logotipo de **Equipe → Identidade da emissora**; sem cadastro, usam `public/logo-ftvtec.png`. |
| **Matérias** | Aba própria para o repórter escrever: lista das pautas do dia ("Só as minhas", "Já escritas", busca), editor grande com salvamento automático e, ao lado, a proposta, a marcação e as informações da pauta para consulta. O botão **✎ Matéria** da pauta abre direto aqui. |
| **Impressão / PDF** | Pauta, matéria ou as duas com o layout da emissora: logotipo, cor, cabeçalho com a retranca e rodapé com número de página. A matéria sai em formato de lauda (marcação · texto). **⬇ Baixar PDF** gera um PDF vetorial, com texto nítido em qualquer zoom e arquivo leve (cerca de 20 KB). **Imprimir** usa a impressora do navegador. O logotipo, a cor e o rodapé são cadastrados em **Equipe → Identidade da emissora**. |
| **No ar** | Botão **● No ar** no espelho. O apresentador dá OK em cada retranca assim que ela termina (botão grande, Espaço ou Enter; Backspace desfaz). Mostra a retranca no ar, um cronômetro contra o tempo previsto, a próxima, a hora real do OK, a duração real, a diferença e o término projetado. Funciona mesmo com o espelho fechado, e quem está no espelho vê as retrancas exibidas riscadas. |
| **Matéria** | Seção **5 · Matéria** dentro da pauta, onde o repórter escreve o texto. Tem botões para inserir as marcações [OFF], [SONORA], [PASSAGEM], [ARTE], [GC], [TRILHA] e [IMAGEM], contagem de palavras com tempo estimado, situação (Em redação → Enviada p/ edição → Revisada → Aprovada) e registro de quem editou por último e quando. O texto fica salvo no sistema junto com a pauta. |
| **Busca** | Pesquisa em todas as datas: retranca, proposta, informações, marcação/entrevistados, encaminhamento e **texto da matéria**. Destaca os termos encontrados e tem filtros por período, status, repórter e "só com matéria escrita". O campo de busca no topo funciona em qualquer tela. Ao clicar num resultado, você lê a pauta e a matéria completas e pode imprimir ou abrir para editar. |
| **Calendário** | Visão mensal com as retrancas de cada dia, coloridas pelo status. Clique no dia para ver as pautas dele, em uma retranca para abri-la ou em **+** para criar uma pauta naquela data. |
| **Espelho** | Um espelho por telejornal por dia. Blocos separados por intervalos, página automática (A1, A2, B1…), tipos (VT, NC, NOTA, NP, LINK, VIVO…), tempo de cabeça calculado pela leitura (palavras/min), VT, total, **horário no ar**, acumulado, sobra/estouro, arrastar e soltar, inclusão a partir da pauta, status (rascunho → aprovado), fechamento pelo editor, impressão e **prompter**. |
| **Lauda** | Cabeça, texto do VT/off, deixa, GC e observações, com salvamento automático. Ao enviar a pauta ao espelho, a matéria vira o texto do VT. O botão **Puxar matéria** atualiza esse texto depois. Texto entre `[colchetes]` não conta no tempo de leitura. |
| **Salvamento automático** | A pauta é gravada sozinha 3 segundos depois que a pessoa para de digitar, assim que houver retranca. Antes disso, e a cada alteração, um rascunho fica guardado no navegador. Se a página fechar, a tela Pautas oferece **Recuperar** a pauta não salva. |
| **Equipe da pauta** | No item 1 da pauta: **Repórter**, **Repórter cinematográfico** e **Motorista**. Cada campo sugere nomes da lista e também aceita um nome digitado. Os repórteres vêm dos usuários do sistema. Cinegrafistas e motoristas são cadastrados em **Equipe → Equipe técnica** pelo administrador ou pelo chefe de reportagem. |
| **Edição** | Tela do **editor de imagens**. Lista as matérias do dia, e o texto do repórter vira um roteiro de edição numerado: marcação (OFF, SONORA, PASSAGEM, GC…), texto, tempo estimado de cada bloco e tempo acumulado. Ao lado ficam as imagens necessárias, o pedido de arte, o roteiro de gravação e os entrevistados. Tem a lista de GCs para copiar e o registro da situação da edição (A editar → Em edição → Editada → Aprovada), com o editor responsável e observações. |
| **Relatórios** | Produção por período (este mês, mês passado, últimos 30 dias, ano ou datas livres). Filtros por editoria, tema/assunto, situação, repórter e telejornal. Pode agrupar por editoria, tema, repórter, telejornal ou geral. Mostra pautas, produzidas, em andamento, quedas, aproveitamento, tempo médio de produção (da criação até "Gravada") e tempo no espelho. Visualização em **gráfico**, **tabela** ou **lista**, com exportação para planilha (CSV) e impressão. |
| **Queda de pauta** | Ao marcar a pauta como "Caiu", o **motivo da queda** é obrigatório. Há botões de motivos frequentes, e os motivos aparecem no relatório. |
| **Equipe** | Funções: Administrador, Chefe de reportagem, Editor, Produtor, Repórter e Apresentador. |
| **Colaboração** | Atualização automática a cada 4 s e trava de edição ("🔒 em edição por Fulano"). |

## Rodar localmente (modo demonstração)

Requer Node 18+.

```powershell
node server.js
```

Abra http://localhost:3000. Os dados ficam em `data/db.json`.
Login de demonstração: `admin@demo.local` / `demo1234`. Também existem `chefe@`, `produtor@`,
`reporter@`, `editor@` e `apresentador@demo.local`, todos com a mesma senha.

## Banco de dados no Supabase (produção SaaS)

1. Crie um projeto em https://supabase.com.
2. No projeto, abra **SQL Editor → New query**, cole todo o arquivo [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
   O script cria as tabelas, as regras de segurança (RLS: cada emissora só vê os próprios dados),
   as travas de edição e os convites.
3. Em **Project Settings → API**, copie a *Project URL* e a chave **anon public**. Cole as duas em
   [`public/config.js`](public/config.js). Nunca use a chave `service_role` no navegador.
4. Em **Authentication → URL Configuration**, coloque o endereço do site em *Site URL*
   (por exemplo, `http://localhost:3000` ou o domínio de produção).
5. Publique a pasta `public/` em qualquer hospedagem estática (Vercel, Netlify, Cloudflare Pages)
   ou continue usando `node server.js`. Com o `config.js` preenchido, o app passa a usar o Supabase.

### Como funciona o acesso no Supabase
- **Criar conta** com o nome da emissora: cria uma nova redação, e você vira o administrador.
- **Equipe → Convidar**: o administrador registra o e-mail e a função. A pessoa usa **Criar conta**
  com esse e-mail, deixando o campo da emissora em branco, e entra direto na redação.
- **Esqueci minha senha**: o Supabase envia o link de redefinição por e-mail.

## Funcionários e equipe da pauta

- **Equipe → Funcionários:** cadastro de nome e função (não cria login). Pode mexer: Administrador, Diretor de Produção e Multimídia e Chefe de reportagem.
- Na pauta, o bloco **Equipe** tem Produtor, Repórter, Repórter cinematográfico, Motorista e Editor de imagens, com sugestões do cadastro e digitação livre.
- Cargo de acesso **Diretor de Produção e Multimídia:** gerencia telejornais e funcionários, aprova espelhos e exclui pautas. A gestão de contas continua só com o Administrador.

## Licenças por usuário

O administrador define em **Equipe**, na coluna **Licença** (e também no convite):

| Licença | O que pode fazer |
|---|---|
| **Leitura** | Consultar pautas e matérias, baixar PDF e imprimir |
| **Edição** | Tudo da Leitura, mais criar e editar pautas e matérias |
| **Geral** | Tudo da Edição, mais o espelho do jornal, o modo No ar e os telejornais |

Administradores sempre têm Geral. Contas novas sem convite começam em Leitura. As regras valem também no banco.

## Celular

Em telas pequenas, as pautas aparecem em cartões com repórter, cinegrafista e motorista. Tocar no cartão abre a ficha
de consulta, com a equipe, a marcação e botões **Ligar** e **Mapa**.

**👁 Visualizar** (no cartão, na ficha e na pauta aberta) mostra o documento da emissora na própria tela, com abas
Pauta e Matéria, sem baixar o PDF.

Ao salvar o site nos favoritos ou na tela inicial, o ícone é o logotipo da emissora (`public/icon-*.png` e
`public/manifest.json`). Esses ícones são arquivos fixos: trocar o logo em **Equipe** não os altera.

## Acesso restrito ao domínio

- Só cria conta quem usa e-mail **@tvtecjundiai.com.br**. A regra está no banco (`public.acesso_config` e o gancho
  `hook_restrict_signup`, ativado em **Authentication → Hooks → Before User Created**).
- Os e-mails dos administradores ficam só no banco, não no repositório. Para alterar, rode no SQL Editor:
  `update public.acesso_config set administradores = array['nome@tvtecjundiai.com.br'];`
- Administradores e convidados entram direto. Os demais ficam aguardando liberação em **Equipe → Ativar**.
- **Entrar com Google:** crie um *OAuth client* (tipo Web) no Google Cloud, com o URI de redirecionamento
  `https://qjedvtmoqcarhkkbausc.supabase.co/auth/v1/callback`, e cole o Client ID e o Client Secret em
  **Supabase → Authentication → Sign In / Providers → Google**.

## Estrutura

```
server.js                   servidor local (API + arquivos estáticos)
public/index.html           página
public/app.js               aplicação (pautas, calendário, espelho, laudas, equipe)
public/styles.css           visual estilo redação/iNews
public/config.js            chaves do Supabase
public/supabase-adapter.js  ponte entre o app e o Supabase
supabase/schema.sql         banco de dados (tabelas, RLS, gatilhos, funções)
```
