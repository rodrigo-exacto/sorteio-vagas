# Repositório e publicação

O projeto funciona sem Git: a pasta basta e o site sobe por upload. Mas o fluxo
que você já opera nos outros sistemas (GitHub Desktop, commit, push, Vercel
publica sozinha) é melhor aqui, e por razões que não são só de conforto.

## Por que vale neste produto

**Histórico do verificador.** O SHA-256 do `verificador.html` fica lavrado em
cada ata. Daqui a cinco anos alguém pode querer conferir um sorteio de 2026 e
vai precisar exatamente do arquivo daquela época. Com Git, toda versão fica
recuperável por commit, com data, sem depender de você ter guardado cópia.

**Auditabilidade.** O argumento do produto é que ninguém precisa confiar na
administração. Verificador de código fechado não sustenta isso.

**Iteração.** Eu escrevo os arquivos direto na pasta do seu computador. Com
repositório, você só dá Commit e Push e a publicação acontece sozinha, sem
zipar, subir e extrair no painel a cada correção.

## O que nunca entra no repositório

O `.gitignore` já bloqueia, mas o princípio precisa estar claro: **nenhum dado de
condomínio**. O `.json` de cada assembleia tem unidade, rótulo e vaga de cada
morador. Ele vive na pasta do condomínio e no dossiê da ata. O mesmo vale para
as planilhas e os PDFs recebidos do síndico e para os CSVs de cadastro real,
como os do Unicco. O que entra é só o programa.

## Público ou privado

Diferente dos seus outros repositórios, este faz sentido **público**. Não expõe
nada: não há dado de morador, não há credencial, não há segredo de operação. E é
a auditabilidade que sustenta o discurso na assembleia, quando alguém perguntar
por que deveria acreditar no sistema.

Começar privado e abrir depois funciona, mas abra antes da primeira assembleia
de verdade.

## Criar o repositório

No GitHub Desktop, com a pasta `C:\sorteio-vagas` já pronta:

1. **File**, depois **Add local repository**, e aponte `C:\sorteio-vagas`.
   Ele vai avisar que a pasta não é um repositório e oferecer **create a
   repository**. Aceite.
2. Na tela de criação, confirme o nome (`sorteio-vagas` ou `garagem-justa`) e
   **não** marque para adicionar .gitignore nem licença: o `.gitignore` já está
   escrito e é específico deste projeto.
3. **Commit** inicial, depois **Publish repository**. Desmarque "Keep this code
   private" se for seguir a recomendação acima.

## Publicar na Vercel

1. Na Vercel, **Add New**, **Project**, e importe o repositório.
2. Em **Framework Preset** escolha **Other**.
3. Em **Root Directory** aponte **`site`**. É o passo que importa: a pasta
   publicada é `site/`, não a raiz do repositório.
4. Deixe Build Command e Install Command vazios. Não há build.
5. Depois do primeiro deploy, em **Settings**, **Domains**, adicione
   `garagemjusta.com.br` e o `www`.
6. Na Hostinger, no DNS do domínio, crie o registro A do apex apontando para
   `76.76.21.21` e o CNAME do `www` com o valor que a Vercel mostrar no cartão
   do domínio daquele projeto. Esse valor é específico do projeto: copie o que
   aparecer na sua tela.

## O ciclo depois disso

1. Eu altero os arquivos direto em `C:\sorteio-vagas`.
2. Se o site mudou, rode `python3 tools/gerar-site.py` para regerar `site/`, ou
   me peça que eu já entrego a pasta regerada.
3. GitHub Desktop: **Commit**, **Push**.
4. A Vercel publica em segundos.

## Troca de versão do verificador

Continua valendo, e agora é mais fácil de cumprir. Antes de subir uma versão
nova do `verificador.html`, copie a atual para `site/v/<ano-mes>/verificador.html`
e comite as duas. Assim o endereço citado numa ata antiga continua respondendo
com o arquivo cujo hash aquela ata registrou, e o histórico do Git guarda a
prova de quando cada versão entrou.
