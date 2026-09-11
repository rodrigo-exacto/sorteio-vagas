# Repositório e publicação

O projeto vive em Git e publica sozinho. Este documento registra como está
montado e qual é o ciclo do dia a dia.

| O quê | Onde |
|---|---|
| Pasta de trabalho | `C:\sorteio-vagas` |
| Repositório | `github.com/rodrigo-exacto/sorteio-vagas`, público |
| Branch | `main` |
| Publicação | Vercel, projeto `sorteio-vagas`, Root Directory `site` |
| Endereço | `garagemjusta.com.br` |
| DNS | Hostinger: registro A `@` para `216.150.1.1`, CNAME `www` para `garagemjusta.com.br` |

O detalhe do DNS e do que conferir depois de publicar está no PUBLICAR.md.

## Por que Git, neste produto

**Histórico do verificador.** O SHA-256 do `verificador.html` fica lavrado em
cada ata. Daqui a cinco anos alguém pode querer conferir um sorteio de 2026 e
vai precisar exatamente do arquivo daquela época. Com Git, toda versão fica
recuperável por commit, com data, sem depender de você ter guardado cópia. O
acervo em `site/v/` resolve o lado público disso; o Git resolve a prova de
quando cada versão entrou.

**Auditabilidade.** O argumento do produto é que ninguém precisa confiar na
administração. Verificador de código fechado não sustenta isso. Por isso o
repositório é público: não expõe nada, porque não há dado de morador, não há
credencial e não há segredo de operação.

**Iteração.** Eu escrevo os arquivos direto na pasta do seu computador. Você dá
Commit e Push, e a publicação acontece sozinha.

## O que nunca entra no repositório

O `.gitignore` já bloqueia, mas o princípio precisa estar claro: **nenhum dado de
condomínio**. O `.json` de cada assembleia tem unidade, rótulo e vaga de cada
morador. Ele vive na pasta do condomínio e no dossiê da ata. O mesmo vale para
as planilhas e os PDFs recebidos do síndico e para os CSVs de cadastro real,
como os do Unicco. O que entra é só o programa.

O repositório é público e o histórico do Git guarda o que já foi commitado mesmo
depois de apagado. Antes de cada push, olhe a lista de arquivos alterados no
GitHub Desktop: se aparecer nome de condomínio ali, pare antes de publicar.

## O ciclo

1. Eu altero os arquivos direto em `C:\sorteio-vagas`.
2. Rode `python3 core/teste.py`. Tem que terminar em "Todos os vetores
   conferem".
3. Se o site mudou, rode `python3 tools/gerar-site.py` para regerar `site/`, ou
   me peça que eu já entrego a pasta regerada.
4. GitHub Desktop: confira a lista de arquivos, **Commit to main**, **Push
   origin**.
5. A Vercel publica em um ou dois minutos.

Para voltar atrás: no painel da Vercel, **Deployments**, e **Promote to
Production** na publicação anterior. Serve como rede de segurança; o caminho
normal é corrigir na pasta e dar push de novo.

## Troca de versão do verificador

O arquivamento é automático. Quando `app/verificador.html` muda, o
`tools/gerar-site.py` guarda a versão que saiu de cartaz em
`site/v/<hash dela>/verificador.html` e regera o índice do acervo. Você só
comita e dá push, como em qualquer outra alteração.

O endereço é formado pelo próprio hash porque é o hash que a ata registra. Assim
uma ata antiga continua respondendo com o arquivo cujo hash ela lavrou, sem
depender de saber a data em que o verificador mudou.
