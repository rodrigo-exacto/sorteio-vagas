# Garagem Justa

Sorteio de vagas de garagem em assembleia de condomínio, publicamente
verificável. Qualquer condômino refaz a conta no próprio computador e chega ao
mesmo resultado, sem precisar confiar na administradora.

**Conferir um sorteio:** https://garagemjusta.com.br/verificador.html
**Protocolo:** https://garagemjusta.com.br/protocolo.html

## A garantia, em quatro linhas

O cadastro fica editável até a assembleia. Na abertura do sorteio ele é
congelado e dele sai um resumo criptográfico, lido em voz alta e lançado em ata.
Só depois se colhe a aleatoriedade, de fonte externa: a Loteria Federal, quando
a assembleia cai em quarta ou sábado antes das 20h, ou uma rodada do drand a
poucos minutos de distância, em qualquer outro dia. O resultado é função
determinística das duas coisas.

O que isso garante é preciso e limitado: dados o conjunto congelado e o valor do
beacon, o resultado é único, reproduzível e não pôde ser escolhido por ninguém.
O que não garante é que o conjunto congelado descreva a realidade. Essa camada é
jurídica e documental, e está tratada no PROTOCOLO.

## Por que o código é público

O argumento do produto é que ninguém precisa confiar em quem organizou. Um
verificador de código fechado não sustenta isso. Aqui estão o motor, o
verificador e a especificação normativa, para que qualquer condômino, ou o
advogado dele, confira que o programa faz o que o protocolo diz.

O motor está implementado duas vezes, de forma independente, em JavaScript
(`core/sorteio.mjs`) e em Python (`core/sorteio.py`), e as duas implementações
são conferidas uma contra a outra pelos vetores de `core/vetores.json`:

```bash
cd core && python3 teste.py
```

Duas implementações independentes que concordam valem mais que uma.

## O que não está aqui

Nenhum dado de condomínio. O sistema roda inteiro no navegador de quem opera e
guarda o projeto num arquivo local; nada trafega e nada é enviado a servidor
nenhum. Este repositório tem só o programa.

## Documentação

| Arquivo | O que é |
|---|---|
| `COMECE-AQUI.md` | Roteiro do primeiro uso |
| `docs/PROTOCOLO.md` | Especificação normativa do protocolo |
| `docs/COMO-USAR.md` | Passo a passo operacional |
| `docs/PUBLICAR.md` | Como o site vai ao ar |
| `docs/GIT.md` | Repositório e fluxo de publicação |

## Licença e operação

Operado por Exacto Gestão de Condomínios, em Mogi das Cruzes, São Paulo.
