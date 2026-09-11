# Garagem Justa

Sorteio de vagas de garagem em assembleia de condomínio, publicamente
verificável. Qualquer condômino refaz a conta no próprio computador e chega ao
mesmo resultado, sem precisar confiar na administradora.

Protocolo `garagem-justa/v1`. Sem servidor, sem banco, sem build, sem internet.

## Estrutura

```
README.md                  rosto do repositório, para quem chega pelo GitHub
COMECE-AQUI.md             roteiro do primeiro uso, leia antes
.gitignore                 mantém dado de condomínio fora do repositório
ABRIR-GARAGEM-JUSTA.html   atalho: duplo clique aqui
app/
  index.html               aplicação
  app.css  app.js          interface
  verificador.html         verificador independente, arquivo único
core/
  sorteio.mjs              motor, fonte única (ES module)
  sorteio.browser.js       derivado do anterior, para file://
  sorteio.py               motor em Python, implementação independente
  vetores.json             vetores que travam o protocolo
  teste.py                 confere Python contra os vetores do JavaScript
  exemplo-unicco.txt       payload canônico de referência, fonte Federal
  exemplo-unicco-drand.txt mesmo cadastro, fonte drand
  gerar-exemplo.mjs        regera o exemplo
  gerar-vetores.mjs        regera os vetores
site/                      DERIVADO: pronto para subir no servidor, não editar
tools/
  gerar-browser.mjs        gera core/sorteio.browser.js a partir do .mjs
  gerar-site.py            monta site/ para garagemjusta.com.br
dados/
  modelo-unidades.csv      modelo de importação
  modelo-vagas.csv         modelo de importação
  unicco-unidades.csv      cadastro do piloto, 182 unidades com grupo
  unicco-vagas.csv         cadastro do piloto, 182 vagas com etiqueta
docs/
  COMO-USAR.md             passo a passo operacional
  PROTOCOLO.md             especificação normativa
  PUBLICAR.md              hospedagem e publicação
  GIT.md                   repositório, o que não entra nele, fluxo de deploy
  README.md                este arquivo
```

## Manutenção

Só se mexe em `core/sorteio.mjs`. Depois:

```bash
node tools/gerar-browser.mjs      # regera a versão para o navegador
node core/gerar-exemplo.mjs       # regera o payload de exemplo
node core/gerar-vetores.mjs       # regera os vetores
cd core && python3 teste.py       # confere que Python continua concordando
python3 tools/gerar-site.py       # remonta site/ para publicação
```

Mudou o protocolo e os vetores continuaram passando? O teste está errado.

## Como a prova funciona, em quatro linhas

O cadastro fica editável até a assembleia. Na abertura do sorteio ele é
congelado e dele sai um hash, lido em voz alta e lançado em ata. Só depois se
colhe a aleatoriedade, de fonte externa: a Loteria Federal, quando a assembleia
cai em quarta ou sábado antes das 20h, ou uma rodada do drand a poucos minutos
de distância, em qualquer outro dia. Resultado é função determinística das duas
coisas, e qualquer pessoa refaz a conta.

## Estado da verificação

Conferido em 11/09/2026:

- Motor em Node, motor no navegador, motor em Python e a aplicação completa
  produzem commit, semente, ordem, atribuições e hash do resultado idênticos,
  pelas duas fontes de aleatoriedade.
- O motor recusa beacon que não corresponda à fonte declarada no compromisso:
  formato errado, rodada diferente da citada, e rodada drand anterior ao
  congelamento declarado.
- Sorteio dividido em grupos: nenhuma unidade recebeu vaga de outro grupo,
  nenhuma vaga já destinada foi sorteada, e trocar a divisão muda o resultado
  inteiro.
- Uniformidade do embaralhamento: 120.000 permutações de 5 elementos, todas as
  120 possíveis observadas, qui-quadrado 81,4 com 119 graus de liberdade
  (crítico a 5% em torno de 145,5).
- Payload não canônico é recusado: linha em branco, espaço no fim da linha,
  ordem trocada, porte inválido.
- Conservação: nenhuma vaga atribuída duas vezes, nenhuma vaga fora do pool
  sorteada, total de pedidos igual à soma dos pedidos das unidades.
- Sensibilidade: um dígito trocado no beacon mantém o commit e muda o resultado
  inteiro; o verificador passa de CONFERE para NÃO CONFERE.
- Ciclo completo pela interface, do cadastro ao dossiê, sem erro de console.

## Decisões de arquitetura

**Sem build.** A aplicação abre com duplo clique. Nenhuma dependência, nenhum
`npm install`, nada para quebrar em três anos. Por isso os scripts são clássicos
e não módulos: o navegador bloqueia ES modules em `file://`.

**Duas implementações do motor.** JavaScript e Python, com vetores cruzados.
Duas implementações independentes que concordam valem muito mais que uma quando
alguém questiona o resultado.

**O verificador é um arquivo só.** Sem CDN, sem fonte externa, sem requisição de
rede. Ele precisa continuar funcionando depois que este projeto for esquecido.

**A fonte de aleatoriedade é escolhida por assembleia.** Não há fonte melhor em
abstrato: há a que a assembleia daquele dia consegue usar. A Federal é a que o
público reconhece e só existe duas vezes por semana; o drand existe sempre e
precisa ser explicado. A escolha entra no compromisso, no primeiro segmento do
campo `beacon`, e o verificador recusa valor de outra fonte.

**Congela-se na assembleia, não no edital.** O que a prova exige é que o
compromisso anteceda a aleatoriedade, não que anteceda em dias. Congelar na
abertura mantém editável até o fim aquilo que de fato muda até o fim: laudo de
PNE entregue na hora, unidade esquecida, vaga retirada por deliberação. O ônus
que isso cria é de ata, e está descrito no PROTOCOLO.md.

**Etiquetas são livres, a divisão é declarada.** O protocolo não sabe o que é
uma vaga coberta. O condomínio cadastra as famílias de etiquetas que usa, marca
uma delas como a que divide o sorteio, e tudo isso entra no compromisso. Assim a
ferramenta serve a convenções diferentes sem ganhar um campo novo a cada
condomínio, e a divisão aplicada fica provada junto com o resultado.

**Vaga destinada fora do sorteio é pública por construção.** Atribuição direta
exige motivo, retira a vaga do pool, desconta o pedido da unidade e aparece no
edital e na ata. Retirada de vaga que ninguém vê é o modo mais comum de fraudar
um sorteio honesto, e por isso não existe forma de fazer isso em silêncio aqui.

**A triagem dominial bloqueia.** Vaga matriculada e vaga acessória determinada
não entram no pool, e não há como forçar pela interface. Sortear o que é
propriedade individual é nulidade absoluta, imprescritível.

## Próxima fase, que depende de servidor

Convocação com prova de entrega individual por condômino, procuração eletrônica,
preferências antecipadas, fluxo de permuta ao longo do ano, coleta automática do
resultado da Loteria Federal, assinatura da ata em PAdES
AD-RT com e-CPF ICP-Brasil, e histórico multiciclo por unidade.

## Licença e publicação

Uso interno da Exacto. Decidir antes de publicar o repositório: o verificador
precisa ser público para cumprir sua função, e o ideal é que o motor também
seja, porque um verificador que ninguém pode auditar não verifica nada.
