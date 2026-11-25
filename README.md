# RedaÃ§Ã£o â€” Pautas e Espelho de Telejornal (SaaS)

Sistema de redaÃ§Ã£o inspirado no Avid iNews: produÃ§Ã£o de **pautas**, **calendÃ¡rio** de pautas,
montagem do **espelho** (rundown) com cronometragem, **laudas**, prompter e equipe com login.

**VersÃ£o publicada:** https://tecnica-tv-tec.github.io/redacao/
(site no GitHub Pages, banco no Supabase, projeto `redacao-tvtec`, regiÃ£o SÃ£o Paulo).
Cada envio para a branch `main` publica o site de novo, pelo fluxo `.github/workflows/pages.yml`.

## MÃ³dulos

| Tela | O que faz |
|---|---|
| **Pautas** | Cadastro no modelo: **1. Retranca** (nome da matÃ©ria) Â· **2. Proposta** (o que se espera da matÃ©ria) Â· **3. MarcaÃ§Ã£o** (entrevistados: nome, funÃ§Ã£o, contato, data, horÃ¡rio, local; roteiro de gravaÃ§Ã£o) Â· **4. InformaÃ§Ãµes** (o que o jornalista precisa saber). Mais: encaminhamento, equipe, perguntas, imagens/arte, observaÃ§Ãµes. Indicador RÂ·PÂ·MÂ·I na lista. Retranca e Proposta sÃ£o obrigatÃ³rias; para marcar a pauta como "Pronta", "Gravada" ou "Exibida", os 4 itens precisam estar preenchidos. |
| **MatÃ©rias** | Aba prÃ³pria para o repÃ³rter escrever: lista das pautas do dia ("SÃ³ as minhas", "JÃ¡ escritas", busca), editor grande com salvamento automÃ¡tico e, ao lado, a proposta, a marcaÃ§Ã£o e as informaÃ§Ãµes da pauta para consulta. O botÃ£o **âœŽ MatÃ©ria** da pauta abre direto aqui. |
| **ImpressÃ£o / PDF** | Pauta, matÃ©ria ou as duas com o layout da emissora: logotipo, cor, cabeÃ§alho com a retranca e rodapÃ© com nÃºmero de pÃ¡gina. A matÃ©ria sai em formato de lauda (marcaÃ§Ã£o Â· texto). **â¬‡ Baixar PDF** gera um PDF vetorial, com texto nÃ­tido em qualquer zoom e arquivo leve (cerca de 20 KB). **Imprimir** usa a impressora do navegador. O logotipo, a cor e o rodapÃ© sÃ£o cadastrados em **Equipe â†’ Identidade da emissora**. |
| **No ar** | BotÃ£o **â— No ar** no espelho. O apresentador dÃ¡ OK em cada retranca assim que ela termina (botÃ£o grande, EspaÃ§o ou Enter; Backspace desfaz). Mostra a retranca no ar, um cronÃ´metro contra o tempo previsto, a prÃ³xima, a hora real do OK, a duraÃ§Ã£o real, a diferenÃ§a e o tÃ©rmino projetado. Funciona mesmo com o espelho fechado, e quem estÃ¡ no espelho vÃª as retrancas exibidas riscadas. |
| **MatÃ©ria** | SeÃ§Ã£o **5 Â· MatÃ©ria** dentro da pauta, onde o repÃ³rter escreve o texto. Tem botÃµes para inserir as marcaÃ§Ãµes [OFF], [SONORA], [PASSAGEM], [ARTE], [GC], [TRILHA] e [IMAGEM], contagem de palavras com tempo estimado, situaÃ§Ã£o (Em redaÃ§Ã£o â†’ Enviada p/ ediÃ§Ã£o â†’ Revisada â†’ Aprovada) e registro de quem editou por Ãºltimo e quando. O texto fica salvo no sistema junto com a pauta. |
| **Busca** | Pesquisa em todas as datas: retranca, proposta, informaÃ§Ãµes, marcaÃ§Ã£o/entrevistados, encaminhamento e **texto da matÃ©ria**. Destaca os termos encontrados e tem filtros por perÃ­odo, status, repÃ³rter e "sÃ³ com matÃ©ria escrita". O campo de busca no topo funciona em qualquer tela. Ao clicar num resultado, vocÃª lÃª a pauta e a matÃ©ria completas e pode imprimir ou abrir para editar. |
| **CalendÃ¡rio** | VisÃ£o mensal com as retrancas de cada dia, coloridas pelo status. Clique no dia para ver as pautas dele, em uma retranca para abri-la ou em **+** para criar uma pauta naquela data. Um mini calendÃ¡rio tambÃ©m aparece na tela de Pautas. |
| **Espelho** | Um espelho por telejornal por dia. Blocos separados por intervalos, pÃ¡gina automÃ¡tica (A1, A2, B1â€¦), tipos (VT, NC, NOTA, NP, LINK, VIVOâ€¦), tempo de cabeÃ§a calculado pela leitura (palavras/min), VT, total, **horÃ¡rio no ar**, acumulado, sobra/estouro, arrastar e soltar, inclusÃ£o a partir da pauta, status (rascunho â†’ aprovado), fechamento pelo editor, impressÃ£o e **prompter**. |
| **Lauda** | CabeÃ§a, texto do VT/off, deixa, GC e observaÃ§Ãµes, com salvamento automÃ¡tico. Ao enviar a pauta ao espelho, a matÃ©ria vira o texto do VT. O botÃ£o **Puxar matÃ©ria** atualiza esse texto depois. Texto entre `[colchetes]` nÃ£o conta no tempo de leitura. |
| **Salvamento automÃ¡tico** | A pauta Ã© gravada sozinha 3 segundos depois que a pessoa para de digitar, assim que houver retranca. Antes disso, e a cada alteraÃ§Ã£o, um rascunho fica guardado no navegador. Se a pÃ¡gina fechar, a tela Pautas oferece **Recuperar** a pauta nÃ£o salva. |
| **Equipe da pauta** | No item 1 da pauta: **RepÃ³rter**, **RepÃ³rter cinematogrÃ¡fico** e **Motorista**. Cada campo sugere nomes da lista e tambÃ©m aceita um nome digitado. Os repÃ³rteres vÃªm dos usuÃ¡rios do sistema. Cinegrafistas e motoristas sÃ£o cadastrados em **Equipe â†’ Equipe tÃ©cnica** pelo administrador ou pelo chefe de reportagem. |
| **EdiÃ§Ã£o** | Tela do **editor de imagens**. Lista as matÃ©rias do dia, e o texto do repÃ³rter vira um roteiro de ediÃ§Ã£o numerado: marcaÃ§Ã£o (OFF, SONORA, PASSAGEM, GCâ€¦), texto, tempo estimado de cada bloco e tempo acumulado. Ao lado ficam as imagens necessÃ¡rias, o pedido de arte, o roteiro de gravaÃ§Ã£o e os entrevistados. Tem a lista de GCs para copiar e o registro da situaÃ§Ã£o da ediÃ§Ã£o (A editar â†’ Em ediÃ§Ã£o â†’ Editada â†’ Aprovada), com o editor responsÃ¡vel e observaÃ§Ãµes. |
| **RelatÃ³rios** | ProduÃ§Ã£o por perÃ­odo (este mÃªs, mÃªs passado, Ãºltimos 30 dias, ano ou datas livres). Filtros por editoria, tema/assunto, situaÃ§Ã£o, repÃ³rter e telejornal. Pode agrupar por editoria, tema, repÃ³rter, telejornal ou geral. Mostra pautas, produzidas, em andamento, quedas, aproveitamento, tempo mÃ©dio de produÃ§Ã£o (da criaÃ§Ã£o atÃ© "Gravada") e tempo no espelho. VisualizaÃ§Ã£o em **grÃ¡fico**, **tabela** ou **lista**, com exportaÃ§Ã£o para planilha (CSV) e impressÃ£o. |
| **Queda de pauta** | Ao marcar a pauta como "Caiu", o **motivo da queda** Ã© obrigatÃ³rio. HÃ¡ botÃµes de motivos frequentes, e os motivos aparecem no relatÃ³rio. |
| **Equipe** | FunÃ§Ãµes: Administrador, Chefe de reportagem, Editor, Produtor, RepÃ³rter e Apresentador. |
| **ColaboraÃ§Ã£o** | AtualizaÃ§Ã£o automÃ¡tica a cada 4 s e trava de ediÃ§Ã£o ("ðŸ”’ em ediÃ§Ã£o por Fulano"). |

## Rodar localmente (modo demonstraÃ§Ã£o)

Requer Node 18+.

```powershell
node server.js
```

Abra http://localhost:3000. Os dados ficam em `data/db.json`.
Login de demonstraÃ§Ã£o: `admin@demo.local` / `demo1234`. TambÃ©m existem `chefe@`, `produtor@`,
`reporter@`, `editor@` e `apresentador@demo.local`, todos com a mesma senha.

## Banco de dados no Supabase (produÃ§Ã£o SaaS)

1. Crie um projeto em https://supabase.com.
2. No projeto, abra **SQL Editor â†’ New query**, cole todo o arquivo [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
   O script cria as tabelas, as regras de seguranÃ§a (RLS: cada emissora sÃ³ vÃª os prÃ³prios dados),
   as travas de ediÃ§Ã£o e os convites.
3. Em **Project Settings â†’ API**, copie a *Project URL* e a chave **anon public**. Cole as duas em
   [`public/config.js`](public/config.js). Nunca use a chave `service_role` no navegador.
4. Em **Authentication â†’ URL Configuration**, coloque o endereÃ§o do site em *Site URL*
   (por exemplo, `http://localhost:3000` ou o domÃ­nio de produÃ§Ã£o).
5. Publique a pasta `public/` em qualquer hospedagem estÃ¡tica (Vercel, Netlify, Cloudflare Pages)
   ou continue usando `node server.js`. Com o `config.js` preenchido, o app passa a usar o Supabase.

### Como funciona o acesso no Supabase
- **Criar conta** com o nome da emissora: cria uma nova redaÃ§Ã£o, e vocÃª vira o administrador.
- **Equipe â†’ Convidar**: o administrador registra o e-mail e a funÃ§Ã£o. A pessoa usa **Criar conta**
  com esse e-mail, deixando o campo da emissora em branco, e entra direto na redaÃ§Ã£o.
- **Esqueci minha senha**: o Supabase envia o link de redefiniÃ§Ã£o por e-mail.

## Estrutura

```
server.js                   servidor local (API + arquivos estÃ¡ticos)
public/index.html           pÃ¡gina
public/app.js               aplicaÃ§Ã£o (pautas, calendÃ¡rio, espelho, laudas, equipe)
public/styles.css           visual estilo redaÃ§Ã£o/iNews
public/config.js            chaves do Supabase
public/supabase-adapter.js  ponte entre o app e o Supabase
supabase/schema.sql         banco de dados (tabelas, RLS, gatilhos, funÃ§Ãµes)
```
