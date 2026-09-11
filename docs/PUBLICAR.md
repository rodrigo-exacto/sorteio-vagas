# Publicar em garagemjusta.com.br

O site inteiro é estático: são arquivos HTML, CSS e JavaScript que rodam no
navegador de quem abre. Não há servidor de aplicação, não há banco de dados,
não há nada para configurar depois do upload.

## Gerar a pasta

```bash
python3 tools/gerar-site.py
```

Isso monta `site/` a partir do app, do verificador e dos documentos. **Nada
dentro de `site/` se edita à mão:** é pasta derivada, e o próximo comando
apaga e refaz tudo.

O comando imprime no fim o SHA-256 do verificador publicado. Guarde esse valor:
é ele que vai na ata de cada assembleia, e é com ele que um condômino confere
que o arquivo que baixou é o mesmo que a administração publicou.

## Onde hospedar

O site é estático, então praticamente qualquer hospedagem serve. Duas
considerações decidem:

**Hostinger, que é o caminho recomendado.** O domínio já está lá, a conta já é
paga, e publicar é copiar arquivos. Não há DNS para mexer, não há conta nova,
não há plano para escolher. Atualizar é subir por cima.

**Vercel foi considerado e descartado, por conta do deploy.** A conta paga da
Exacto resolve a questão de licença (o plano gratuito Hobby é restrito a uso não
comercial, o pago não tem essa restrição), mas o Vercel foi feito para publicar a
partir de repositório Git, que aqui não existe. Sem repositório sobram dois
caminhos, e os dois são piores que a Hostinger para este site: o Vercel Drop, que
cria um projeto novo a cada envio e obriga a repontar o domínio toda vez, e a
CLI, que exige Node instalado e comando na máquina de quem publica.

A conta do Vercel continua útil neste projeto, mas para a fase seguinte: a parte
que depende de servidor, banco e autenticação (convocação com prova de entrega,
procuração eletrônica, permuta ao longo do ano, histórico multiciclo). Site
estático não é onde ela rende.

Se ainda assim for para o Vercel: crie o projeto uma vez, adicione o domínio em
Settings, Domains, e na Hostinger aponte o apex por registro A para 76.76.21.21 e
o www por CNAME com o valor que o painel do Vercel mostrar no cartão do domínio
daquele projeto, que é específico dele. Não troque os nameservers.

## Subir no Hostinger

1. No hPanel, vá em **Websites**, clique em **Dashboard** ao lado de
   garagemjusta.com.br e depois em **File Manager**, que abre em outra aba.
2. Entre em `public_html`. Se houver a página padrão do Hostinger
   (`default.php`, `index.php` ou parecido), apague.
3. Clique em **Upload**, no topo, e envie o arquivo `garagemjusta-site.zip`.
   Depois clique com o botão direito nele e escolha **Extract**, extraindo em
   `public_html`. Confira que os arquivos ficaram na raiz e não dentro de uma
   subpasta, e apague o .zip no fim. O resultado esperado dentro de
   `public_html` é:

```
public_html/
  index.html
  verificador.html
  protocolo.html
  robots.txt
  app/
    index.html  app.css  app.js
  core/
    sorteio.browser.js  sorteio.py  vetores.json
    exemplo-unicco.txt  exemplo-unicco-drand.txt  teste.py
```

4. No hPanel, em **SSL**, confirme que o certificado está emitido e que o
   redirecionamento para HTTPS está ligado.

O `garagemjusta-site.zip` está pronto na raiz da pasta do projeto e é
regerado junto com `site/`.

## Conferir depois de subir

- `https://garagemjusta.com.br/` abre a página inicial.
- `https://garagemjusta.com.br/verificador.html` abre e o botão Verificar
  responde CONFERE com o exemplo que já vem carregado.
- `https://garagemjusta.com.br/app/` abre a aplicação.
- O SHA-256 mostrado na página inicial é igual ao que o comando imprimiu.

## A cada nova versão

Rode `python3 tools/gerar-site.py` de novo, gere o zip e suba por cima, pelo
mesmo caminho do primeiro envio. A URL não muda e não há nada a reconfigurar.
Para atualização em lote também dá para usar FTP, com um cliente como o FileZilla
ou o WinSCP e as credenciais que a Hostinger fornece no hPanel: é mais confortável
que zipar e extrair quando a mudança pega muitos arquivos.

**A pasta no computador é a fonte da verdade, o servidor só recebe.** O File
Manager da Hostinger tem editor embutido (botão direito no arquivo, **Edit**), e é
tentador corrigir uma vírgula direto lá. O problema não é o editor, é a
divergência: a correção feita no servidor some no envio seguinte, que vem da
pasta. Se for corrigir pelo painel, corrija também aqui, ou a correção tem
prazo de validade.

### O verificador é caso à parte

`verificador.html` **nunca** se edita no servidor, nem para consertar um erro de
digitação. O SHA-256 dele está lavrado em ata, e um único byte diferente faz o
arquivo deixar de bater com todas as atas já assinadas.

Quando ele precisar mudar de verdade, o procedimento é:

1. Antes de subir a versão nova, copie a atual para
   `/v/<ano-mes>/verificador.html` no servidor.
2. Suba a versão nova na raiz.
3. Anote o novo SHA-256 e use daí em diante.
4. Para atas já lavradas, o endereço válido passa a ser o da pasta com data.

Assim um condômino que for conferir em 2035 um sorteio de 2026 ainda encontra o
verificador de 2026, com o hash que a ata dele cita.

As demais páginas (`index.html`, `protocolo.html`) não têm hash lavrado em lugar
nenhum e podem ser corrigidas à vontade.

## O que fica público e o que não fica

Público: a página inicial, o verificador, o protocolo, o motor em Python e os
vetores de teste. Isso é proposital, porque um verificador que ninguém pode
auditar não verifica nada.

Não público: nenhum dado de condomínio. A aplicação guarda o projeto no
navegador de quem opera e no arquivo `.json` que a pessoa salva. Nada é enviado
ao servidor, que serve apenas arquivos. O `robots.txt` mantém a aplicação e o
motor fora dos buscadores, mas isso é higiene, não segurança: o que protege os
dados é não existir para onde enviá-los.
