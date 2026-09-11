# Publicar em garagemjusta.com.br

O site inteiro é estático: são arquivos HTML, CSS e JavaScript que rodam no
navegador de quem abre. Não há servidor de aplicação, não há banco de dados,
não há nada para configurar depois de publicar.

## Como está montado

```
pasta no computador  →  GitHub  →  Vercel  →  garagemjusta.com.br
   C:\sorteio-vagas     rodrigo-exacto/      projeto            registro A
                        sorteio-vagas        sorteio-vagas      216.150.1.1
                                             (Root Directory: site)
```

A Vercel observa o repositório. Todo push na branch `main` dispara uma
publicação nova, em um ou dois minutos, sem comando nenhum. O DNS fica na
Hostinger, que é onde o domínio está registrado, e aponta para a Vercel:

| Tipo  | Nome | Valor                | Para quê |
|-------|------|----------------------|----------|
| A     | `@`  | `216.150.1.1`        | o site   |
| CNAME | `www`| `garagemjusta.com.br`| redireciona para o endereço sem www |

Não há site, hospedagem nem `public_html` na Hostinger. Ela só resolve o nome.

## Gerar a pasta

```bash
python3 tools/gerar-site.py
```

Isso monta `site/` a partir do app, do verificador e dos documentos. **Nada
dentro de `site/` se edita à mão:** é pasta derivada, e o próximo comando
apaga e refaz tudo. A única exceção é `site/v/`, o acervo de versões antigas
do verificador, que o comando preserva de propósito.

O comando imprime no fim o SHA-256 do verificador publicado. Guarde esse valor:
é ele que vai na ata de cada assembleia, e é com ele que um condômino confere
que o arquivo que baixou é o mesmo que a administração publicou.

## Publicar uma alteração

1. Faça a alteração na fonte, nunca em `site/`. O verificador é
   `app/verificador.html`, a aplicação é `app/`, o motor é `core/`, os textos
   do site são `docs/PROTOCOLO.md` e o próprio `tools/gerar-site.py`.
2. Rode `python3 core/teste.py`. Se não terminar em "Todos os vetores
   conferem", pare aqui: o motor quebrou.
3. Rode `python3 tools/gerar-site.py`.
4. Abra o GitHub Desktop, confira a lista de arquivos alterados, escreva a
   mensagem do commit e clique em **Commit to main**.
5. Clique em **Push origin**.
6. Em um ou dois minutos, confira em `https://garagemjusta.com.br`.

Se algo sair errado, o painel da Vercel guarda todas as publicações anteriores
em **Deployments**, e o botão **Promote to Production** volta para qualquer uma
delas em segundos. Isso é rede de segurança, não o caminho normal: o caminho
normal é corrigir na pasta e dar push de novo.

## Conferir depois de publicar

- `https://garagemjusta.com.br/` abre a página inicial.
- `https://garagemjusta.com.br/verificador.html` abre e o botão Verificar
  responde CONFERE com o exemplo que já vem carregado.
- `https://garagemjusta.com.br/app/` abre a aplicação.
- O SHA-256 mostrado na página inicial é igual ao que o comando imprimiu.

## O verificador é caso à parte

`verificador.html` **nunca** se edita direto em `site/`, nem para consertar um
erro de digitação. O SHA-256 dele está lavrado em ata, e um único byte diferente
faz o arquivo deixar de bater com todas as atas já assinadas.

Quando ele precisar mudar de verdade, edite `app/verificador.html` e rode o
gerador normalmente. **O arquivamento é automático:** o gerador percebe que o
hash mudou, guarda a versão que saiu de cartaz em
`site/v/<hash dela>/verificador.html` e monta o índice do acervo em `site/v/`.
Basta dar commit e push como em qualquer outra alteração.

O endereço do acervo é formado pelo próprio hash porque é o hash que a ata
registra. Um condômino que em 2035 abrir uma ata de 2026 lê ali um SHA-256,
monta o endereço com ele e encontra exatamente aquele arquivo, sem depender de
saber a data em que o verificador mudou.

Depois de publicar uma versão nova, anote o SHA-256 novo: é ele que vale para
as atas dali em diante.

As demais páginas (`index.html`, `protocolo.html`) não têm hash lavrado em lugar
nenhum e podem ser corrigidas à vontade.

## O que fica público e o que não fica

Público: a página inicial, o verificador, o protocolo, o motor em Python e os
vetores de teste. Isso é proposital, porque um verificador que ninguém pode
auditar não verifica nada. O repositório no GitHub também é público, pelo mesmo
motivo.

Não público: nenhum dado de condomínio. A aplicação guarda o projeto no
navegador de quem opera e no arquivo `.json` que a pessoa salva. Nada é enviado
ao servidor, que serve apenas arquivos. O `robots.txt` mantém a aplicação e o
motor fora dos buscadores, mas isso é higiene, não segurança: o que protege os
dados é não existir para onde enviá-los.

**Cuidado com o que entra no repositório.** Ele é público, e o histórico do git
guarda o que já foi commitado mesmo depois de apagado. O `.gitignore` da raiz
bloqueia planilhas, PDFs, os `.json` de projeto e os CSVs de condomínio real.
Antes de qualquer commit, olhe a lista de arquivos alterados no GitHub Desktop:
se aparecer nome de condomínio ali, pare e me chame antes de dar push.
