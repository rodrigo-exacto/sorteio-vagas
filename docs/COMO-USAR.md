# Como usar

## Abrir

Dê duplo clique em **ABRIR-GARAGEM-JUSTA.html**, na raiz da pasta. Não precisa
instalar nada, não precisa de servidor e não precisa de internet. Recomendo
Chrome ou Edge.

Não mova arquivos de lugar. A aplicação está em `app/` e procura o motor em
`core/`, lado a lado.

## O ciclo, do começo ao fim

### 1. Condomínio
Nome, CNPJ, data da assembleia e as regras como devem aparecer no edital.

**Escolha a fonte de aleatoriedade pela data da assembleia:**

- Assembleia em **quarta ou sábado, começando antes das 20h**: use a Loteria
  Federal e cite o concurso **pelo número**, o daquela mesma noite. É o que a
  assembleia reconhece sem precisar de explicação.
- **Qualquer outro dia ou horário**: use o drand. O sistema fixa, no momento do
  congelamento, o número de uma rodada alguns minutos à frente. Deixe a
  antecedência em 10 minutos: dá tempo de ler o compromisso em voz alta e
  explicar o que vai acontecer.

Nos dois casos vale a mesma garantia, e é só ela que a prova exige: no instante
em que o cadastro é congelado, a aleatoriedade ainda não existe.

**Divisão do sorteio.** Sem divisão, todo mundo concorre a todas as vagas e a
sorte decide quem fica com a melhor. Dividindo por uma família de etiquetas,
cada unidade concorre só dentro do seu grupo: quem está no grupo das cobertas
disputa apenas as cobertas, e você marca o grupo de cada unidade na aba 2. Use a
divisão quando a convenção ou a assembleia estabeleceram grupos; sem isso, o
sorteio único é mais simples de defender, porque todos tiveram a mesma chance.

Cadastre as etiquetas na aba 3 antes de escolher a divisão aqui.

Deixe a política em "menor vaga adequada". A outra desperdiça vaga grande com
carro pequeno e deixa gente sem vaga à toa.

### 2. Unidades
Importe por CSV ou digite. Baixe o modelo pelo botão. Colunas:

| coluna | o que é |
|---|---|
| codigo | identificador curto, ex. 11, 202, A-13 |
| rotulo | como aparece no telão, ex. APTO 11 |
| pedidos | quantas vagas a unidade tem direito a disputar |
| porte | P, M ou G, o tamanho mínimo que o veículo exige |
| grupo | só quando o sorteio é dividido: o grupo da unidade |
| prioridade | sim quando há prioridade declarada |
| documento | sim quando o documento já foi conferido |

O modelo de CSV sai com as colunas certas para as famílias que você cadastrou,
então baixe o modelo depois de cadastrar as etiquetas, e não antes. Vaga já
destinada não vai aqui: vai na aba 5.

### 3. Vagas

Comece pelas **etiquetas**, no cartão de cima. Cadastre as famílias que este
condomínio usa e os valores de cada uma: Cobertura com coberta e descoberta,
Nível com subsolo e térreo, Porte da vaga, Bloco, o que for. Uma vaga pode ter
um valor de cada família. O botão "usar cobertura e nível" preenche o caso mais
comum, e você ajusta os valores depois.

Essas etiquetas servem para duas coisas. Descrevem a vaga no edital e na ata, e
ficam travadas no compromisso, de modo que ninguém pode sustentar depois que a
vaga sorteada era outra. E uma delas, a que você escolher na aba 1, pode dividir
o sorteio em grupos.

A coluna que importa é a **classificação dominial**. Vaga com matrícula própria
e vaga acessória determinada são bloqueadas: não se sorteia o que é propriedade
individual. O sistema não deixa passar.

Vagas acessíveis e outras retiradas por deliberação saem do pool marcando "fora
do pool" e preenchendo o motivo. O motivo é obrigatório e vai para o edital.

**Se o sorteio for dividido**, toda vaga que entra no sorteio precisa ter valor
na família que divide. Vaga sem esse valor trava a conferência, porque não há
como saber em que grupo ela entra. Vagas presas no mesmo lote têm que ser do
mesmo grupo.

### 4. Lotes
Vaga sem código de lote vira um lote sozinha. Vagas com o mesmo código de lote
formam um conjunto, o caso das vagas presas. Escolha se o conjunto é dividido
entre duas unidades ou entregue inteiro a uma.

### 5. Atribuições diretas

Vaga que já tem destino certo e não vai a sorteio: laudo médico apresentado,
decisão judicial, permuta homologada, direito reconhecido em assembleia. Escolha
a unidade, a vaga e escreva o motivo. O motivo é obrigatório.

Cada linha faz duas coisas sozinha: retira a vaga do pool e desconta um pedido
da unidade, que segue concorrendo com o que sobrar. Unidade com direito a duas
vagas e uma já destinada concorre com uma.

Tudo isso aparece no bloco da convocação, com unidade, vaga e motivo, e é lido
na abertura antes do sorteio. É o oposto de um acerto de bastidor: quanto mais
linhas aqui, menos vagas restam para os demais, e cada uma precisa de fundamento
que se sustente sozinho diante da assembleia.

### 6. Conferência e abertura do sorteio
O semáforo separa o que impede de abrir do que é ponto de atenção. Resolva os
vermelhos. Leia os amarelos: eles existem porque alguém vai perguntar.

**Antes da assembleia**, copie o bloco da convocação e publique com o edital. Ele
anuncia o método, a fonte e a lista de vagas fora do sorteio. Ele **não** traz o
compromisso, e isso é proposital: o cadastro continua aberto até a assembleia,
para que ela mesma possa corrigir uma exceção, incluir quem faltou ou retirar
uma vaga por deliberação.

**Na assembleia**, encerrada a discussão sobre quem participa e o que é
sorteável, clique em **Abrir o sorteio e congelar**. Copie o bloco da abertura,
leia o compromisso em voz alta e mande lançar em ata, nessa ordem, **antes** de
colher a aleatoriedade. É essa ordem que prova que ninguém escolheu o resultado.

Enquanto a aleatoriedade não foi colhida, **Reabrir o cadastro** está disponível
e não custa nada: a assembleia lembrou de alguém, você reabre, corrige e congela
de novo. Depois de apurado, esse botão some e no lugar dele fica **Anular o
ciclo**, que exige motivo e registra para sempre o resultado descartado. Anular
é ato de ata, não de conveniência.

### 7. Sorteio

**Com a Loteria Federal:** às 20h, digite os cinco prêmios da extração. Zero à
esquerda tanto faz.

**Com o drand:** a tela mostra a rodada citada, o horário previsto e o endereço
público dela. Projete o endereço: quem quiser abre no celular e acompanha.
Passado o horário, clique em "Buscar na internet", ou digite à mão os 64
caracteres se a máquina estiver offline.

Depois, apure e clique em modo apresentação para projetar no telão. Barra de
espaço revela a próxima unidade.

### 8. Dossiê
Baixe tudo e guarde junto com a ata:

- `payload.txt`, o conjunto congelado
- `resultado.txt`, a apuração
- `trecho-da-ata.md`, pronto para colar
- `resultado.csv`, para planilha
- `cadeia-de-eventos.txt`, o log encadeado
- o `.json` do projeto inteiro

## Onde ficam os dados

No arquivo `.json` que você salva, e numa cópia de conveniência no navegador da
máquina. Nada é enviado para lugar nenhum. **Salve o projeto ao terminar cada
sessão**: limpar os dados do navegador apaga a cópia de conveniência.

## Antes da primeira assembleia de verdade

1. Publique `app/verificador.html` em endereço acessível, por exemplo
   `https://garagemjusta.com.br/verificador.html`.
2. Anote o SHA-256 desse arquivo e registre na ata. No Windows:
   `certutil -hashfile verificador.html SHA256`
3. Cite o endereço na convocação e na ata.
4. Leve o comprovante impresso da fonte: resultado da Federal pelo portal da
   Caixa, ou a página da rodada do drand.
5. Teste o ciclo inteiro com o botão "Carregar exemplo" antes de usar com dados
   reais, pelos dois caminhos: Federal e drand.
6. Se for usar o drand, confirme que a máquina da assembleia tem internet, ou
   combine com alguém que abra a URL no celular e dite os 64 caracteres.

## O que ainda não está aqui

Convocação com prova de entrega individual, procuração eletrônica, preferências
antecipadas, permuta ao longo do ano, assinatura da ata em PAdES e coleta
automática do resultado da Federal. Tudo isso está no roteiro e depende de
servidor, que é a fase seguinte.
