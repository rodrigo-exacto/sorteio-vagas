/* ARQUIVO GERADO. Não edite.
 * Origem: core/sorteio.mjs
 * Regere com: node tools/gerar-browser.mjs
 * Expõe o motor como window.GJ para uso em páginas abertas por file://.
 */
(function (global) {
"use strict";

/**
 * Garagem Justa - motor de sorteio determinístico e verificável
 * Versão do protocolo: garagem-justa/v1
 *
 * Sem dependências. Roda em Node 18+ e no navegador (usa WebCrypto).
 * Toda função aqui é pura: mesmos insumos, mesmo resultado, em qualquer máquina.
 *
 * A implementação em Python (sorteio.py) produz resultados idênticos.
 * Os vetores de teste em vetores.json travam esse acordo.
 */

const PROTO = "garagem-justa/v1";
const enc = new TextEncoder();

/* ----------------------------------------------------------------------------
 * 1. Primitivas
 * ------------------------------------------------------------------------- */

function hex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function concat(...parts) {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function u32be(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function hmacSha256(keyBytes, msgBytes) {
  const k = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, msgBytes));
}

/** Comparação por bytes UTF-8. Nunca usar localeCompare: varia por ambiente. */
function cmpBytes(a, b) {
  const A = enc.encode(a);
  const B = enc.encode(b);
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    if (A[i] !== B[i]) return A[i] - B[i];
  }
  return A.length - B.length;
}

/* ----------------------------------------------------------------------------
 * 2. Payload canônico
 *
 * O compromisso congela TUDO que entra na função: lista de demandantes,
 * lista de lotes, vagas fora do pool, regras e a fonte de entropia escolhida.
 * Se qualquer byte mudar, o hash muda e o commit publicado no edital não bate.
 * ------------------------------------------------------------------------- */

const CABECALHO = `GARAGEM-JUSTA/COMMIT/v1`;

const CAMPOS_ORDEM = [
  "condominio",
  "cnpj",
  "assembleia",
  "congelado_em",
  "modalidade",
  "politica_casamento",
  "agrupamento",
  "beacon",
  "beacon_fallback",
  "sem_vaga",
  "salt",
  "regras",
];

const PORTES = { P: 1, M: 2, G: 3 };

/** Sorteio sem divisão por categoria roda num grupo único com este nome. */
const GRUPO_UNICO = "GERAL";

function grupoDe(x) {
  const g = (x.grupo || "").trim();
  return g === "" ? GRUPO_UNICO : g;
}

function serializePayload(spec) {
  const L = [CABECALHO];

  for (const campo of CAMPOS_ORDEM) {
    const v = spec.meta[campo];
    if (v === undefined || v === null || v === "") {
      throw new Error(`campo obrigatório ausente no payload: ${campo}`);
    }
    if (String(v).includes("\n")) {
      throw new Error(`campo ${campo} não pode conter quebra de linha`);
    }
    L.push(`${campo}=${String(v).trim()}`);
  }

  const dem = [...spec.demandantes].sort((a, b) => cmpBytes(a.codigo, b.codigo));
  L.push("[DEMANDANTES]");
  for (const d of dem) {
    L.push(
      `${d.codigo};${d.rotulo};tickets=${d.tickets};porte=${d.porte};grupo=${grupoDe(d)}`
    );
  }

  const lotes = [...spec.lotes].sort((a, b) => cmpBytes(a.codigo, b.codigo));
  L.push("[LOTES]");
  for (const l of lotes) {
    L.push(
      `${l.codigo};${l.vagas.join("+")};porte=${l.porte};capacidade=${l.capacidade};grupo=${grupoDe(l)}`
    );
  }

  // Etiquetas descritivas de cada vaga. Entram no compromisso porque descrevem
  // o que está sendo prometido: dizer depois que a vaga era descoberta, quando
  // o edital dizia coberta, passa a ser impossível.
  const etq = [...(spec.etiquetas || [])].sort((a, b) => cmpBytes(a.vaga, b.vaga));
  L.push("[ETIQUETAS]");
  for (const e of etq) {
    const pares = Object.keys(e.valores)
      .sort(cmpBytes)
      .map((f) => `${f}=${e.valores[f]}`);
    if (pares.length) L.push(`${e.vaga};${pares.join(";")}`);
  }

  // Vagas já destinadas a uma unidade fora do sorteio, com o motivo declarado.
  const pre = [...(spec.preAtribuidas || [])].sort((a, b) => cmpBytes(a.vaga, b.vaga));
  L.push("[PRE_ATRIBUIDAS]");
  for (const a of pre) {
    L.push(`${a.vaga};${a.unidade};${a.motivo}`);
  }

  const fora = [...(spec.foraDoPool || [])].sort((a, b) =>
    cmpBytes(a.vaga, b.vaga)
  );
  L.push("[FORA_DO_POOL]");
  for (const f of fora) {
    L.push(`${f.vaga};${f.motivo}`);
  }

  return L.join("\n").normalize("NFC");
}

/**
 * Normalização de entrada, aplicada de forma idêntica em toda parte antes de
 * qualquer hash: NFC, CRLF vira LF, e quebras de linha no fim do arquivo são
 * descartadas. Sem isso, um editor que salva com newline final mudaria o hash.
 */
function normalizarEntrada(texto) {
  return texto.normalize("NFC").replace(/\r\n?/g, "\n").replace(/\n+$/, "");
}

function parsePayload(texto) {
  const t = normalizarEntrada(texto);
  const linhas = t.split("\n");

  if (linhas[0] !== CABECALHO) {
    throw new Error(`payload não começa com ${CABECALHO}`);
  }

  const meta = {};
  const demandantes = [];
  const lotes = [];
  const etiquetas = [];
  const preAtribuidas = [];
  const foraDoPool = [];
  let secao = "META";

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (linha === "") throw new Error(`linha ${i + 1}: payload canônico não tem linha em branco`);
    if (linha !== linha.trim()) {
      throw new Error(`linha ${i + 1}: espaço no início ou no fim não é permitido`);
    }

    if (linha === "[DEMANDANTES]") { secao = "DEMANDANTES"; continue; }
    if (linha === "[LOTES]") { secao = "LOTES"; continue; }
    if (linha === "[ETIQUETAS]") { secao = "ETIQUETAS"; continue; }
    if (linha === "[PRE_ATRIBUIDAS]") { secao = "PRE_ATRIBUIDAS"; continue; }
    if (linha === "[FORA_DO_POOL]") { secao = "FORA_DO_POOL"; continue; }

    if (secao === "META") {
      const eq = linha.indexOf("=");
      if (eq < 1) throw new Error(`linha ${i + 1}: esperado campo=valor`);
      meta[linha.slice(0, eq)] = linha.slice(eq + 1);
    } else if (secao === "DEMANDANTES") {
      const [codigo, rotulo, ...resto] = linha.split(";");
      const kv = kvPairs(resto, i + 1);
      demandantes.push({
        codigo,
        rotulo,
        tickets: inteiroPositivo(kv.tickets, `tickets` , i + 1),
        porte: porteValido(kv.porte, i + 1),
        grupo: nomeSimples(kv.grupo, "grupo", i + 1),
      });
    } else if (secao === "LOTES") {
      const [codigo, vagas, ...resto] = linha.split(";");
      const kv = kvPairs(resto, i + 1);
      lotes.push({
        codigo,
        vagas: vagas.split("+"),
        porte: porteValido(kv.porte, i + 1),
        capacidade: inteiroPositivo(kv.capacidade, "capacidade", i + 1),
        grupo: nomeSimples(kv.grupo, "grupo", i + 1),
      });
    } else if (secao === "ETIQUETAS") {
      const [vaga, ...resto] = linha.split(";");
      if (!vaga || !resto.length) {
        throw new Error(`linha ${i + 1}: esperado vaga;familia=valor`);
      }
      etiquetas.push({ vaga, valores: kvPairs(resto, i + 1) });
    } else if (secao === "PRE_ATRIBUIDAS") {
      const partes = linha.split(";");
      if (partes.length < 3) {
        throw new Error(`linha ${i + 1}: esperado vaga;unidade;motivo`);
      }
      preAtribuidas.push({
        vaga: partes[0],
        unidade: partes[1],
        motivo: partes.slice(2).join(";"),
      });
    } else if (secao === "FORA_DO_POOL") {
      const idx = linha.indexOf(";");
      if (idx < 1) throw new Error(`linha ${i + 1}: esperado vaga;motivo`);
      foraDoPool.push({ vaga: linha.slice(0, idx), motivo: linha.slice(idx + 1) });
    }
  }

  for (const campo of CAMPOS_ORDEM) {
    if (meta[campo] === undefined) throw new Error(`campo obrigatório ausente: ${campo}`);
  }

  return { meta, demandantes, lotes, etiquetas, preAtribuidas, foraDoPool };
}

function kvPairs(partes, linhaNum) {
  const kv = {};
  for (const p of partes) {
    const eq = p.indexOf("=");
    if (eq < 1) throw new Error(`linha ${linhaNum}: esperado chave=valor em "${p}"`);
    kv[p.slice(0, eq)] = p.slice(eq + 1);
  }
  return kv;
}

function inteiroPositivo(v, nome, linhaNum) {
  if (!/^[1-9][0-9]*$/.test(v ?? "")) {
    throw new Error(`linha ${linhaNum}: ${nome} deve ser inteiro positivo`);
  }
  return Number(v);
}

/** Nome de grupo: não pode ser vazio nem conter separador do formato. */
function nomeSimples(v, campo, linhaNum) {
  const s = (v ?? "").trim();
  if (s === "") throw new Error(`linha ${linhaNum}: ${campo} não pode ser vazio`);
  if (/[;=+\[\]]/.test(s)) {
    throw new Error(`linha ${linhaNum}: ${campo} não pode conter ; = + [ ]`);
  }
  return s;
}

function porteValido(v, linhaNum) {
  if (!(v in PORTES)) throw new Error(`linha ${linhaNum}: porte deve ser P, M ou G`);
  return v;
}

/**
 * Um payload só é canônico se reserializar nele mesmo.
 * Isso impede duas representações do mesmo conteúdo gerando hashes diferentes.
 */
function assertCanonico(texto) {
  const spec = parsePayload(texto);
  const re = serializePayload(spec);
  if (re !== normalizarEntrada(texto)) {
    throw new Error(
      "payload não está na forma canônica (ordem, espaços ou normalização divergem)"
    );
  }
  return spec;
}

/* ----------------------------------------------------------------------------
 * 3. Compromisso e semente
 * ------------------------------------------------------------------------- */

async function commit(payloadTexto) {
  return await sha256(enc.encode(normalizarEntrada(payloadTexto)));
}

/**
 * A semente depende do compromisso E do valor do beacon.
 * O organizador controla o payload mas não o beacon; o beacon não sabe que o
 * condomínio existe. Nenhum dos dois consegue escolher o resultado.
 */
async function derivarSemente(commitBytes, beaconValor) {
  return await hmacSha256(
    commitBytes,
    enc.encode(`${PROTO}/seed|${beaconValor}`)
  );
}

/**
 * Normalização do resultado da Loteria Federal.
 * A API da Caixa devolve os prêmios com zero à esquerda em 6 caracteres.
 * Fixamos 5 dígitos, que é o bilhete de verdade, e juntamos com "|".
 */
function normalizarLoteriaFederal(premios) {
  if (premios.length !== 5) throw new Error("a Loteria Federal tem 5 prêmios");
  return premios
    .map((p) => {
      const s = String(p).replace(/\D/g, "");
      if (s.length < 5) throw new Error(`prêmio inválido: ${p}`);
      const cinco = s.slice(-5);
      if (!/^[0-9]{5}$/.test(cinco)) throw new Error(`prêmio inválido: ${p}`);
      return cinco;
    })
    .join("|");
}

/* ----------------------------------------------------------------------------
 * 3b. Fontes de aleatoriedade
 *
 * A fonte é declarada dentro do próprio campo beacon do payload, no primeiro
 * segmento, e portanto entra no compromisso. Duas fontes são admitidas:
 *
 *   LOTERIA_FEDERAL|concurso 6107|2026-10-14
 *     valor apurado: cinco prêmios de cinco dígitos separados por "|".
 *     Serve quando a assembleia cai em quarta ou sábado e começa antes das 20h.
 *
 *   DRAND_QUICKNET|<cadeia>|<rodada>
 *     valor apurado: "<rodada>|<aleatoriedade em 64 hexadecimais>".
 *     Serve em qualquer dia e hora: a rodada citada é de poucos minutos à
 *     frente, então o congelamento pode acontecer na própria abertura da
 *     assembleia e a aleatoriedade ainda não existe nesse instante.
 * ------------------------------------------------------------------------- */

const DRAND = {
  cadeia: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
  genesis: 1692803367,
  periodo: 3,
};

const FONTES = ["LOTERIA_FEDERAL", "DRAND_QUICKNET"];

/** Número da rodada quicknet vigente em um instante (ms desde a época). */
function rodadaDrandEm(instanteMs) {
  const t = Math.floor(instanteMs / 1000);
  if (t <= DRAND.genesis) return 1;
  return Math.floor((t - DRAND.genesis) / DRAND.periodo) + 1;
}

/** Instante em que a rodada é publicada (ms desde a época). */
function instanteDaRodada(rodada) {
  return (DRAND.genesis + (Number(rodada) - 1) * DRAND.periodo) * 1000;
}

function urlDaRodada(rodada) {
  return `https://api.drand.sh/v2/chains/${DRAND.cadeia}/rounds/${Number(rodada)}`;
}

/** Valor apurado do drand, na forma canônica que entra na semente. */
function normalizarDrand(rodada, aleatorio) {
  const r = String(rodada).trim();
  if (!/^[1-9][0-9]*$/.test(r)) throw new Error(`rodada inválida: ${rodada}`);
  const h = String(aleatorio).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) {
    throw new Error("a aleatoriedade do drand tem 64 caracteres hexadecimais");
  }
  return `${r}|${h}`;
}

/** Lê a fonte declarada no campo beacon do payload. */
function fonteDoBeacon(declaracao) {
  const fonte = String(declaracao).split("|")[0];
  if (FONTES.indexOf(fonte) === -1) {
    throw new Error(`fonte de aleatoriedade desconhecida: ${fonte}`);
  }
  return fonte;
}

/** Rodada citada na declaração do beacon. Só existe para o drand. */
function rodadaDeclarada(declaracao) {
  const partes = String(declaracao).split("|");
  if (partes[1] !== DRAND.cadeia) {
    throw new Error("a cadeia citada no beacon não é a quicknet do drand");
  }
  if (!/^[1-9][0-9]*$/.test(partes[2] || "")) {
    throw new Error("o beacon do drand deve terminar com o número da rodada");
  }
  return Number(partes[2]);
}

/**
 * Confere se o valor apurado corresponde à fonte declarada no compromisso.
 * É isto que impede trocar de fonte depois de conhecer os dois resultados.
 */
function validarBeacon(declaracao, valor, congeladoEm) {
  const fonte = fonteDoBeacon(declaracao);

  if (fonte === "LOTERIA_FEDERAL") {
    if (!/^[0-9]{5}(\|[0-9]{5}){4}$/.test(valor)) {
      throw new Error("valor da Loteria Federal fora do formato: cinco prêmios de cinco dígitos");
    }
    return fonte;
  }

  const rodada = rodadaDeclarada(declaracao);
  if (!/^[1-9][0-9]*\|[0-9a-f]{64}$/.test(valor)) {
    throw new Error("valor do drand fora do formato: rodada|aleatoriedade");
  }
  if (Number(valor.split("|")[0]) !== rodada) {
    throw new Error(
      `a rodada apurada (${valor.split("|")[0]}) não é a rodada do compromisso (${rodada})`
    );
  }
  // A rodada citada tem que ser posterior ao congelamento declarado. Sem isso a
  // aleatoriedade já existiria no momento do compromisso e a prova não vale.
  const t = Date.parse(congeladoEm);
  if (Number.isNaN(t)) throw new Error(`congelado_em não é uma data válida: ${congeladoEm}`);
  if (instanteDaRodada(rodada) <= t) {
    throw new Error(
      "a rodada citada já existia quando o ciclo foi congelado: o compromisso não antecede a aleatoriedade"
    );
  }
  return fonte;
}

/* ----------------------------------------------------------------------------
 * 4. PRNG determinístico
 * ------------------------------------------------------------------------- */

function criarPrng(semente) {
  let buffer = new Uint8Array(0);
  let contador = 0;
  return {
    async proximos(n) {
      while (buffer.length < n) {
        const bloco = await hmacSha256(
          semente,
          concat(enc.encode(`${PROTO}/prng`), u32be(contador++))
        );
        buffer = concat(buffer, bloco);
      }
      const saida = buffer.slice(0, n);
      buffer = buffer.slice(n);
      return saida;
    },
  };
}

/** Inteiro uniforme em [0, n). Rejection sampling: nunca resto de módulo. */
async function uniforme(prng, n) {
  if (n < 1) throw new Error("n deve ser >= 1");
  if (n === 1) return 0;
  const bits = Math.ceil(Math.log2(n));
  const nbytes = Math.ceil(bits / 8);
  const espaco = 2n ** BigInt(8 * nbytes);
  const limite = (espaco / BigInt(n)) * BigInt(n);
  for (;;) {
    const b = await prng.proximos(nbytes);
    let x = 0n;
    for (const by of b) x = (x << 8n) | BigInt(by);
    if (x < limite) return Number(x % BigInt(n));
  }
}

/** Fisher-Yates (Durstenfeld), descendente. */
async function embaralhar(lista, prng) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = await uniforme(prng, i + 1);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/* ----------------------------------------------------------------------------
 * 5. Sorteio
 * ------------------------------------------------------------------------- */

/**
 * Ordem de consumo do fluxo do PRNG, declarada e imutável:
 *   para cada grupo, em ordem crescente de bytes do nome do grupo:
 *     1) permutação dos pedidos do grupo
 *     2) permutação dos lotes do grupo
 * Inverter qualquer parte dessa ordem muda todo o resultado. Por isso está
 * escrito aqui e no PROTOCOLO.md, e é parte do que o verificador confere.
 *
 * Sem divisão por categoria existe um único grupo, GERAL, e a ordem se reduz a
 * "embaralha pedidos, embaralha lotes", que é o caso simples.
 */
async function sortear(payloadTexto, beaconValor) {
  const spec = assertCanonico(payloadTexto);
  const fonte = validarBeacon(spec.meta.beacon, beaconValor, spec.meta.congelado_em);
  const C = await commit(payloadTexto);
  const semente = await derivarSemente(C, beaconValor);
  const prng = criarPrng(semente);

  // Um pedido por ticket. Unidade com direito a duas vagas concorre duas vezes.
  const pedidos = [];
  for (const d of spec.demandantes) {
    for (let k = 1; k <= d.tickets; k++) {
      pedidos.push({
        id: `${d.codigo}#${k}`,
        codigo: d.codigo,
        rotulo: d.rotulo,
        porte: d.porte,
        grupo: grupoDe(d),
      });
    }
  }
  pedidos.sort((a, b) => cmpBytes(a.id, b.id));

  const politica = spec.meta.politica_casamento;
  if (politica !== "PRIMEIRO_ELEGIVEL" && politica !== "MENOR_ADEQUADO") {
    throw new Error(`politica_casamento desconhecida: ${politica}`);
  }

  // Cada grupo é um sorteio independente dentro do mesmo compromisso e da mesma
  // semente: quem está no grupo das cobertas concorre só às cobertas. A ordem
  // dos grupos é por bytes do nome, para não depender de como foram digitados.
  const grupos = [
    ...new Set([
      ...pedidos.map((p) => p.grupo),
      ...spec.lotes.map((l) => grupoDe(l)),
    ]),
  ].sort(cmpBytes);

  const atribuicoes = [];
  const semVaga = [];
  const ordemSorteada = [];

  for (const grupo of grupos) {
    const pedidosG = pedidos.filter((p) => p.grupo === grupo);
    const lotesG = spec.lotes.filter((l) => grupoDe(l) === grupo);

    const permPedidos = await embaralhar(pedidosG, prng);
    const permLotes = await embaralhar(lotesG, prng);
    for (const p of permPedidos) ordemSorteada.push(p.id);

    const restante = new Map(permLotes.map((l) => [l.codigo, l.capacidade]));

    for (const pedido of permPedidos) {
      const livres = permLotes.filter(
        (l) => restante.get(l.codigo) > 0 && PORTES[l.porte] >= PORTES[pedido.porte]
      );

      let escolhido = null;
      if (livres.length > 0) {
        if (politica === "PRIMEIRO_ELEGIVEL") {
          escolhido = livres[0];
        } else {
          // MENOR_ADEQUADO: menor porte que serve; empate pela ordem sorteada.
          escolhido = livres.reduce((melhor, l) =>
            PORTES[l.porte] < PORTES[melhor.porte] ? l : melhor
          );
        }
      }

      if (escolhido === null) {
        semVaga.push({
          pedido: pedido.id,
          rotulo: pedido.rotulo,
          porte: pedido.porte,
          grupo,
        });
        continue;
      }

      // Qual vaga concreta o ocupante recebe dentro do lote.
      // Lote cuja capacidade é igual ao número de vagas: cada ocupante fica com
      // uma vaga, na ordem em que foi contemplado (é o caso da vaga presa).
      // Lote com menos capacidade que vagas: o ocupante fica com todas
      // (box duplo entregue a uma única unidade).
      const indice = escolhido.capacidade - restante.get(escolhido.codigo);
      const vagasDoOcupante =
        escolhido.capacidade === escolhido.vagas.length
          ? [escolhido.vagas[indice]]
          : escolhido.vagas;

      restante.set(escolhido.codigo, restante.get(escolhido.codigo) - 1);
      atribuicoes.push({
        pedido: pedido.id,
        codigo: pedido.codigo,
        rotulo: pedido.rotulo,
        grupo,
        lote: escolhido.codigo,
        vagas: vagasDoOcupante,
      });
    }
  }

  // Ordenação de apresentação: por unidade. Não afeta o sorteio, só a leitura.
  const apresentacao = atribuicoes
    .slice()
    .sort((a, b) => cmpBytes(a.pedido, b.pedido));

  const resultadoTexto = serializarResultado(apresentacao, semVaga);
  const resultadoHash = await sha256(enc.encode(resultadoTexto));

  return {
    protocolo: PROTO,
    commit: hex(C),
    fonte,
    beaconDeclarado: spec.meta.beacon,
    beacon: beaconValor,
    semente: hex(semente),
    modalidade: spec.meta.modalidade,
    agrupamento: spec.meta.agrupamento,
    grupos,
    politica,
    ordemSorteada,
    atribuicoes: apresentacao,
    semVaga,
    preAtribuidas: spec.preAtribuidas || [],
    resultadoTexto,
    resultadoHash: hex(resultadoHash),
  };
}

function serializarResultado(atribuicoes, semVaga) {
  const L = ["GARAGEM-JUSTA/RESULTADO/v1"];
  for (const a of atribuicoes) {
    L.push(`${a.pedido};${a.grupo};${a.lote};${a.vagas.join("+")}`);
  }
  for (const s of semVaga) {
    L.push(`${s.pedido};${s.grupo};SEM_VAGA`);
  }
  return L.join("\n");
}


global.GJ = { hex, GRUPO_UNICO, serializePayload, normalizarEntrada, parsePayload, assertCanonico, commit, derivarSemente, normalizarLoteriaFederal, DRAND, FONTES, rodadaDrandEm, instanteDaRodada, urlDaRodada, normalizarDrand, fonteDoBeacon, rodadaDeclarada, validarBeacon, criarPrng, uniforme, embaralhar, sortear, serializarResultado };
})(typeof window !== "undefined" ? window : globalThis);
