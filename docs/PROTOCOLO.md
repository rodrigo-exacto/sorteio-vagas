# Protocolo Garagem Justa v1

Especificação do sorteio de vagas publicamente verificável.

Este documento é normativo. Quem quiser reimplementar o sorteio em outra
linguagem e conferir o resultado de uma assembleia precisa apenas dele e dos
vetores de teste em `core/vetores.json`.

Versão do protocolo: `garagem-justa/v1`
Data: 11/09/2026

---

## 1. O que o protocolo garante, e o que não garante

**Garante** que, dados o payload do compromisso e o valor do beacon, o resultado
é único, reproduzível por qualquer pessoa, e não pôde ser escolhido nem pelo
organizador nem por nenhum participante.

**Não garante** que o payload descreve a realidade. Se a lista de unidades
estiver errada, ou se uma vaga que deveria ser sorteada ficou de fora, o
protocolo vai calcular certinho a coisa errada. Essa camada é jurídica e
documental, não criptográfica: é o edital, a ata e a triagem dominial das vagas
que respondem por ela.

---

## 2. Ordenação temporal

A prova inteira depende de uma única ordem: **o compromisso antes do beacon**.
Se o beacon já existia quando o compromisso foi gerado, não há prova nenhuma.

Note o que essa exigência **não** diz. Ela não exige que o compromisso seja
gerado dias antes, nem que saia no edital. Exige apenas que ele anteceda a
aleatoriedade. Isso permite congelar o cadastro na própria assembleia, que é o
que o protocolo adota:

```
t-n  Convocação. Anuncia o método, a fonte de aleatoriedade e a relação
     de vagas fora do sorteio. NÃO traz o compromisso, que ainda não
     existe: o cadastro segue aberto justamente para que a assembleia
     possa corrigi-lo.

t0   Abertura do sorteio, já em assembleia, encerrada a deliberação
     sobre quem participa e o que é sorteável. Congela-se o payload,
     calcula-se C, lê-se C em voz alta e lança-se em ata.
     Nesse instante o beacon AINDA NÃO EXISTE.

t1   O beacon é produzido publicamente, minutos depois.

t2   Apura-se. Ata registra C, o beacon, a semente e o hash do resultado.
```

A distância entre t0 e t1 é de minutos, não de dias. Isso é suficiente: o que
torna o resultado inescolhível não é a antecedência, é a impossibilidade de
conhecer o beacon em t0.

**Consequência prática.** Tudo permanece editável até t0: exceções de PNE que
dependem de documento entregue na hora, unidade que apareceu, vaga que a
assembleia decidiu retirar do pool. O que se perde ao congelar tarde é a
possibilidade de o edital já trazer C; o que se ganha é que o compromisso
descreve o cadastro que a assembleia efetivamente aprovou, e não uma versão
anterior que precisaria ser retificada depois.

**O que substitui o edital como prova de que C veio antes.** A ata, lavrada na
ordem dos fatos, com C lido em voz alta antes de colhida a aleatoriedade; a
cadeia de eventos da aplicação, que registra o congelamento com carimbo próprio;
e, na fonte drand, a própria aritmética: a rodada citada só nasce depois, e o
verificador recusa payload cuja rodada seja anterior a `congelado_em`.

---

## 3. Payload do compromisso

Arquivo de texto UTF-8. É o insumo congelado do sorteio.

### 3.1 Forma canônica

Um payload só é válido se for canônico. Canônico significa:

- Normalização Unicode **NFC**. "José" tem duas representações possíveis e elas
  produzem hashes diferentes.
- Quebra de linha **LF**. CRLF é convertido antes do hash.
- Sem BOM.
- Sem linha em branco.
- Sem espaço no início ou no fim de qualquer linha.
- Quebras de linha no fim do arquivo são descartadas antes do hash, para que um
  editor de texto não altere o commit ao salvar.
- Campos do cabeçalho na ordem fixa da seção 3.2.
- Listas ordenadas lexicograficamente **pelos bytes UTF-8** do código. Nunca por
  locale: `localeCompare` e `sorted(key=locale)` variam entre máquinas.

A implementação confere isso reserializando o payload e comparando com o
original. Se não for idêntico byte a byte, recusa.

### 3.2 Estrutura

```
GARAGEM-JUSTA/COMMIT/v1
condominio=<texto>
cnpj=<texto>
assembleia=<ISO 8601 com fuso, ex 2026-10-14T19:30:00-03:00>
congelado_em=<ISO 8601 com fuso, instante do congelamento, com segundos>
modalidade=ATRIBUICAO_DIRETA
politica_casamento=MENOR_ADEQUADO | PRIMEIRO_ELEGIVEL
agrupamento=NENHUM | <nome da família de etiquetas que divide o sorteio>
beacon=LOTERIA_FEDERAL|concurso <n>|<data>
       ou DRAND_QUICKNET|<cadeia em 64 hex>|<rodada>
beacon_fallback=<mesma gramática, fonte de contingência>
sem_vaga=<regra declarada para quem não receber lote>
salt=<32 hexadecimais, 128 bits, gerados por CSPRNG>
regras=<texto em uma linha>
[DEMANDANTES]
<codigo>;<rotulo>;tickets=<n>;porte=<P|M|G>;grupo=<nome>
[LOTES]
<codigo>;<vaga1+vaga2...>;porte=<P|M|G>;capacidade=<n>;grupo=<nome>
[ETIQUETAS]
<vaga>;<familia>=<valor>;<familia>=<valor>...
[PRE_ATRIBUIDAS]
<vaga>;<unidade>;<motivo com fundamento>
[FORA_DO_POOL]
<vaga>;<motivo com fundamento>
```

**Campos que merecem explicação:**

`grupo` é a fatia do sorteio a que a unidade e o lote pertencem. Sem divisão,
todos ficam no grupo `GERAL` e o sorteio é um só. Com divisão, cada grupo é um
sorteio independente dentro do mesmo compromisso e da mesma semente: quem está
no grupo das cobertas concorre apenas às cobertas. Nome de grupo não pode ser
vazio nem conter `;` `=` `+` `[` `]`.

`agrupamento` diz **qual família de etiquetas** define os grupos, ou `NENHUM`.
É informação para quem lê, porque o que rege o cálculo são os campos `grupo`;
serve para que a ata possa dizer "dividido por Cobertura" sem ambiguidade.

`[ETIQUETAS]` descreve cada vaga: cobertura, nível, o que o condomínio quiser
registrar. Entra no compromisso porque é parte do que se está prometendo.
Dizer depois que a vaga sorteada era descoberta, quando o compromisso diz
coberta, passa a ser impossível. Famílias e valores são livres: quem define é o
condomínio, não o protocolo.

`[PRE_ATRIBUIDAS]` são as vagas que já têm destino certo e por isso não são
sorteadas: laudo médico, decisão judicial, permuta homologada, direito
reconhecido em assembleia. Cada linha traz a vaga, a unidade e o motivo. A vaga
não aparece em nenhum lote, e o pedido correspondente já foi descontado dos
`tickets` da unidade. Ficam no compromisso, e portanto no edital e na ata, pela
mesma razão que `[FORA_DO_POOL]`: retirada de vaga que ninguém vê é o modo mais
comum de fraudar um sorteio honesto.

`congelado_em` é o instante em que o payload foi fechado, declarado pelo
organizador. Entra no hash e cumpre duas funções: fixa na própria prova a
afirmação de que o cadastro estava fechado naquele momento, e permite que o
verificador recuse, sozinho, um payload que cite rodada drand anterior a ele.
É declaração unilateral, e por isso não substitui a ata: um organizador
desonesto pode antedatar. Antedatar, porém, não o ajuda em nada, porque não lhe
dá acesso ao beacon; o que ele não consegue é pós-datar, e é isso que a
verificação automática impede.

`beacon` declara a fonte de aleatoriedade **no primeiro segmento**. É daí que o
verificador descobre qual fonte deve exigir, e é por isso que não existe campo
separado para a fonte: seria redundância com possibilidade de divergência.

`salt` existe para dar entropia ao compromisso. Sem ele, alguém que conheça a
lista de unidades poderia testar payloads por força bruta e descobrir C antes da
hora. 128 bits tornam isso inviável.

`tickets` é quantas vagas a unidade tem direito a disputar. Unidade com duas
vagas concorre com dois pedidos independentes.

`porte` do demandante é o tamanho mínimo de vaga que o veículo exige. `porte` do
lote é o tamanho da vaga. Um lote serve um pedido quando `porte_lote >=
porte_pedido`, na escala `P < M < G`.

`capacidade` é quantas unidades cabem no lote. Vaga simples tem capacidade 1.
Par de vagas presas que será dividido entre dois moradores tem capacidade 2. Box
duplo entregue inteiro a uma única unidade tem duas vagas e capacidade 1.

`[FORA_DO_POOL]` lista o que **não** entra no sorteio, com o fundamento de cada
exclusão. Esta seção é o coração da defesa contra impugnação, porque é publicada
no edital antes do sorteio: ninguém é surpreendido por uma vaga que sumiu.

### 3.3 Compromisso

```
C = SHA-256( payload_canonico_em_UTF-8 )
```

`C` em hexadecimal minúsculo é o que vai no edital.

---

## 4. Beacon

Duas fontes são admitidas, e a escolha é **por assembleia**, declarada no campo
`beacon`. A escolha depende de quando a assembleia acontece:

| | Loteria Federal | drand quicknet |
|---|---|---|
| Quando existe | quarta e sábado, 20h | a cada 3 segundos |
| Assembleia possível | quarta ou sábado, antes das 20h | qualquer dia e hora |
| Intervalo t0→t1 | até 15 minutos, congelando às 19h45 | os minutos que se quiser |
| Entropia | ~83 bits | 256 bits |
| Reconhecimento público | alto, é a âncora da Portaria MF 41/2008 | baixo, exige explicação |
| Conferência pelo condômino | site da Caixa, jornais, TV | api.drand.sh, no celular |
| Falha possível | extração adiada ou suspensa | rede parada, sem precedente relevante |

Na dúvida, e podendo escolher a data, prefira a Federal: a assembleia entende
sem explicação o que é a Loteria Federal, e o que se está provando é justamente
confiança. Quando a data não permite, o drand faz o mesmo trabalho e ainda
encurta a espera.

### 4.1 Loteria Federal

Cinco prêmios, cinco dígitos cada. A API da Caixa devolve os números com zero à
esquerda em seis caracteres: `064423` é o bilhete `64423`. **Normalize sempre
para cinco dígitos**, tomando os cinco últimos, e junte com `|`:

```
064423 083481 037422 027068 057566
        vira
64423|83481|37422|27068|57566
```

Entropia: cinco números de cinco dígitos, cerca de 83 bits. Suficiente para
qualquer condomínio real.

**Não use** a convenção de promoção comercial de tomar só o último algarismo de
cada prêmio. Isso derruba a entropia para cerca de 17 bits e permite
pré-computar todos os resultados possíveis.

Valor apurado, forma canônica: `NNNNN|NNNNN|NNNNN|NNNNN|NNNNN`.

### 4.2 drand quicknet

Rede de aleatoriedade pública operada por um consórcio de instituições, em
esquema de limiar: nenhum participante isolado consegue produzir nem antecipar o
valor de uma rodada. A cadeia `quicknet` publica uma rodada a cada 3 segundos, e
a relação entre rodada e horário é pública, fixa e verificável por aritmética:

```
cadeia  = 52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971
genesis = 1692803367   (época Unix)
periodo = 3            (segundos)

rodada(t)      = floor((t - genesis) / periodo) + 1
instante(r)    = genesis + (r - 1) * periodo
url(r)         = https://api.drand.sh/v2/chains/<cadeia>/rounds/<r>
```

**Uso.** No congelamento, calcule `rodada(t0 + antecedência)` com antecedência
entre 5 e 15 minutos e cite esse número no campo `beacon`. Projete a URL da
rodada na tela: qualquer pessoa presente abre no próprio celular e confere que o
número transcrito é o que a rede publicou. A aleatoriedade é o campo
`randomness` da resposta, 64 caracteres hexadecimais minúsculos.

Valor apurado, forma canônica: `<rodada>|<64 hexadecimais minúsculos>`.

**Verificação obrigatória.** A implementação recusa o sorteio quando
`instante(rodada) <= congelado_em`. É a checagem que impede citar uma rodada já
publicada, isto é, escolher a aleatoriedade depois de conhecê-la.

**Limite honesto.** Esta implementação não verifica a assinatura BLS da rodada.
Ela confia que o número transcrito é o que a rede publicou, e o que sustenta
essa confiança é a conferência pública na URL, feita por quem quiser, e não o
cálculo. Quem quiser verificação criptográfica da própria rodada precisa de uma
biblioteca de curvas BLS, que não cabe em uma página offline de arquivo único.

### 4.3 Contingência

A regra de contingência tem que estar declarada **na convocação**, nunca
decidida na hora, e vai no campo `beacon_fallback`. Padrão:

- Loteria Federal: se a extração citada não ocorrer, usa-se a primeira seguinte.
  A assembleia suspende os trabalhos e retoma, ou delibera adiar a apuração,
  mantendo o mesmo compromisso já lançado em ata.
- drand: se a rodada citada não for obtida, usa-se a rodada seguinte que a
  contingência declarar. Como a rede publica a cada 3 segundos e mantém as
  rodadas acessíveis depois, a hipótese prática é falta de internet no local, e
  não falha da rede.

---

## 5. Semente

```
semente = HMAC-SHA-256( chave = C, mensagem = "garagem-justa/v1/seed|" + beacon )
```

HMAC, e não `SHA-256(C || beacon)`, para evitar ambiguidade de concatenação.

O organizador controla o payload mas não o beacon. O beacon não sabe que o
condomínio existe. Nenhum dos dois consegue escolher o resultado, e é por isso
que o esquema resiste ao ataque de *grinding*, em que o organizador geraria um
milhão de sementes e publicaria o hash daquela cujo resultado lhe agrada.

---

## 6. Gerador determinístico

Fluxo de bytes por HMAC em modo contador:

```
bloco(i) = HMAC-SHA-256( chave = semente, mensagem = "garagem-justa/v1/prng" || uint32_be(i) )
```

Os blocos são concatenados na ordem `i = 0, 1, 2, ...` e consumidos sob demanda.
Cabe em dez linhas em qualquer linguagem, e essa simplicidade é requisito, não
elegância: quem vai reimplementar é um condômino curioso.

### 6.1 Inteiro uniforme

```
uniforme(n):
    se n == 1: retorna 0
    nbytes = ceil(ceil(log2(n)) / 8)
    espaco = 2^(8*nbytes)
    limite = floor(espaco / n) * n
    repita:
        x = inteiro big-endian sem sinal dos proximos nbytes bytes
        se x < limite: retorna x mod n
        senao: descarta e repete
```

**Nunca** `bytes % n`. Se `n` não divide uma potência de 256, os resíduos menores
saem com mais frequência. A rejeição consome bytes do fluxo, então precisa estar
implementada exatamente assim, ou duas implementações divergem no primeiro
descarte.

### 6.2 Embaralhamento

Fisher-Yates, variante de Durstenfeld, descendente:

```
para i de len(a)-1 ate 1:
    j = uniforme(i+1)
    troca a[i] com a[j]
```

---

## 7. Sorteio

### 7.1 Construção dos pedidos

Para cada demandante, gera-se um pedido por ticket, com identificador
`<codigo>#<k>`, `k` de 1 até `tickets`. A lista de pedidos é ordenada pelos bytes
UTF-8 do identificador antes de qualquer embaralhamento.

### 7.2 Grupos

Os grupos são os valores distintos de `grupo` que aparecem em `[DEMANDANTES]` e
em `[LOTES]`, ordenados por **bytes do nome**, não por ordem de digitação nem
por locale. Cada grupo é percorrido inteiro antes do seguinte.

Grupo com pedidos e sem lotes deixa todos esses pedidos na regra `sem_vaga`.
Grupo com lotes e sem pedidos simplesmente sobra. Nenhum dos dois é erro do
protocolo: são fatos do cadastro, e é a conferência da aplicação que avisa.

### 7.3 Ordem de consumo do PRNG

Declarada e imutável. Para cada grupo, na ordem definida em 7.2:

1. permutação dos **pedidos do grupo**
2. permutação dos **lotes do grupo**

Inverter qualquer parte dessa ordem muda todo o resultado. Sem divisão existe um
único grupo, `GERAL`, e a ordem se reduz ao caso simples: embaralha pedidos,
embaralha lotes.

Permutação de lista vazia ou de um só elemento não consome byte nenhum do fluxo.

### 7.4 Casamento

Percorre-se a permutação de pedidos. Para cada pedido, consideram-se os lotes
com capacidade restante e porte suficiente, na ordem da permutação de lotes.

- `PRIMEIRO_ELEGIVEL`: pega o primeiro da permutação.
- `MENOR_ADEQUADO`: pega o de menor porte que serve; empate resolvido pela ordem
  da permutação.

**Use `MENOR_ADEQUADO`.** As duas políticas são igualmente aleatórias e
igualmente verificáveis, mas a primeira desperdiça vaga grande com carro
pequeno. No exemplo de referência, com 19 pedidos e 19 posições, a política
`PRIMEIRO_ELEGIVEL` deixa em média 1,41 pedido sem vaga e só consegue atender
todo mundo em 46 de 500 sorteios; `MENOR_ADEQUADO` atende todos em 500 de 500.

Não havendo lote elegível, o pedido vai para a regra declarada em `sem_vaga`.

### 7.5 Vaga concreta dentro do lote

- `capacidade == número de vagas`: cada ocupante recebe uma vaga, na ordem em que
  foi contemplado. É o caso da vaga presa dividida entre dois moradores.
- `capacidade < número de vagas`: o ocupante recebe todas as vagas do lote. É o
  box duplo entregue a uma única unidade.

### 7.6 Resultado

```
GARAGEM-JUSTA/RESULTADO/v1
<pedido>;<grupo>;<lote>;<vaga1+vaga2...>
...
<pedido>;<grupo>;SEM_VAGA
...
```

Atribuições ordenadas pelos bytes UTF-8 do identificador do pedido, seguidas dos
sem vaga na ordem em que ocorreram.

As vagas de `[PRE_ATRIBUIDAS]` **não** entram neste texto: elas não foram
sorteadas, e o hash do resultado é o hash do que o sorteio produziu. Elas já
estão no compromisso, que é o que prova que foram declaradas antes.

```
hash_resultado = SHA-256( texto_do_resultado )
```

---

## 8. O que vai para a ata

A ata é o que prova a ordem dos fatos, já que o compromisso não saiu no edital.
Lavre **na ordem em que aconteceram**:

1. Que, encerrada a deliberação sobre participantes e vagas sorteáveis, o
   cadastro foi congelado, exibido na tela, e dele se extraiu o compromisso `C`,
   lido em voz alta **antes** de colhida a aleatoriedade.
2. O compromisso `C` e o instante do congelamento.
3. A fonte declarada, exatamente como está no campo `beacon`.
3.1. A divisão do sorteio, com os grupos e quantos pedidos e posições cada um
   tinha, e a relação de vagas já destinadas fora do sorteio, com o fundamento
   de cada uma, lida antes da apuração.
4. O valor apurado:
   - Loteria Federal: número do concurso e os cinco prêmios.
   - drand: número da rodada, os 64 hexadecimais e a URL de conferência.
5. A semente derivada.
6. O hash do resultado.
7. O hash do `verificador.html` publicado.
8. A versão do protocolo, `garagem-justa/v1`.
9. O endereço em que o payload integral e o verificador ficam publicados.

Anexo: comprovante impresso do resultado, obtido no portal da Caixa ou na URL da
rodada drand.

Se um ciclo tiver sido congelado e depois reaberto, ou apurado e depois anulado,
isso consta da cadeia de eventos e **deve** constar da ata, com o motivo. Omitir
é o que transformaria uma ferramenta de prova em ferramenta de encenação.

---

## 9. Como um terceiro confere

1. Abre `verificador.html`, confere o SHA-256 do arquivo contra o da ata.
2. Cola o payload publicado e o valor da fonte:
   - Loteria Federal: `64423|83481|37422|27068|57566`
   - drand: `33071752|8d3c2b1a…` (rodada, barra, 64 hexadecimais)
3. Confere na origem que aquele valor é o que a fonte publicou: portal da Caixa,
   ou a URL da rodada em api.drand.sh.
4. Compara o commit e o hash do resultado com os da ata.

Quem preferir não confiar em JavaScript roda `python3 core/sorteio.py
payload.txt "<valor do beacon>"` e chega ao mesmo resultado. Duas implementações
independentes que concordam valem muito mais que uma.

---

## 10. Limites conhecidos

**Contingência do beacon é ponto de julgamento.** Se a extração citada não
ocorrer e a regra de contingência não estiver clara na convocação, abre-se
espaço para discussão. A regra tem que estar escrita antes.

**Congelar na assembleia desloca prova do papel para a ata.** No modelo em que o
compromisso sai no edital, a prova de anterioridade é documental e antecede o
ato. No modelo adotado aqui, ela depende de a ata registrar a ordem correta dos
fatos. É uma escolha deliberada: o custo é depender do rigor do secretário, e o
ganho é que o compromisso descreve o cadastro que a assembleia aprovou. Na fonte
drand parte desse ônus volta a ser automática, porque a aritmética da rodada não
admite inversão. Quem quiser reforço adicional pode carimbar o payload com
OpenTimestamps no intervalo entre o congelamento e a apuração, sem custo.

**A assinatura da rodada drand não é verificada.** Ver 4.2. A conferência é
pública, na URL, e não criptográfica dentro da aplicação.

**O protocolo não sabe quem pode participar.** Legitimidade de condômino,
inadimplência, procuração e convocação são camadas externas, e são justamente as
que mais anulam assembleia na prática.

**A divisão em grupos é decisão da assembleia, não do protocolo.** O protocolo
executa a divisão declarada; ele não julga se dividir cobertas e descobertas por
unidade é legítimo naquele condomínio. Isso depende da convenção, do que a
assembleia aprovou e, quando a divisão perpetua vantagem, da própria isonomia
entre condôminos. Dividir é lícito quando há fundamento; o protocolo só garante
que a divisão declarada foi a divisão aplicada.

**Porte é declarado, não medido.** Se um morador declarar porte G para aumentar a
chance de vaga grande, o protocolo não percebe. Isso é controle administrativo,
resolvido no cadastro e na conferência antes do congelamento.

**O commit não prova que o payload é verdadeiro.** Prova que ele não mudou.
