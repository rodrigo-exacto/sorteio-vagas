/**
 * Gera os vetores de teste a partir da implementação em JavaScript.
 * A implementação em Python é conferida contra este arquivo por teste.py.
 *
 * Qualquer mudança no protocolo tem que quebrar estes vetores. Se mudar o
 * protocolo e os vetores continuarem passando, o teste está errado.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  hex, commit, derivarSemente, criarPrng, uniforme, embaralhar,
  normalizarLoteriaFederal, sortear,
  DRAND, GRUPO_UNICO, rodadaDrandEm, instanteDaRodada, urlDaRodada, normalizarDrand,
  fonteDoBeacon, rodadaDeclarada, validarBeacon,
} from "./sorteio.mjs";

const enc = new TextEncoder();
const sha = async (s) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));

const vetores = {};

/* 1. Normalização da Loteria Federal, incluindo o zero à esquerda da API */
vetores.loteria_federal = {
  entrada_api_caixa: ["064423", "083481", "037422", "027068", "057566"],
  saida: normalizarLoteriaFederal(["064423", "083481", "037422", "027068", "057566"]),
};

/* 2. Fluxo do PRNG a partir de uma semente conhecida */
const sementeTeste = await sha("garagem-justa/teste");
{
  const prng = criarPrng(sementeTeste);
  const b1 = await prng.proximos(16);
  const b2 = await prng.proximos(48); // força o segundo bloco do contador
  vetores.prng = {
    semente: hex(sementeTeste),
    primeiros_16_bytes: hex(b1),
    proximos_48_bytes: hex(b2),
  };
}

/* 3. Inteiro uniforme: cobre potência de dois, primo e n=1 */
{
  const prng = criarPrng(sementeTeste);
  const seq = [];
  for (const n of [1, 2, 3, 7, 10, 17, 52, 100, 256, 257, 1000]) {
    seq.push({ n, valor: await uniforme(prng, n) });
  }
  vetores.uniforme = { semente: hex(sementeTeste), sequencia: seq };
}

/* 4. Fisher-Yates */
{
  const prng = criarPrng(sementeTeste);
  vetores.embaralhar = {
    semente: hex(sementeTeste),
    entrada: ["A", "B", "C", "D", "E", "F", "G", "H"],
    saida: await embaralhar(["A", "B", "C", "D", "E", "F", "G", "H"], prng),
  };
}

/* 5. Sorteio completo do exemplo Unicco */
const payload = readFileSync(new URL("./exemplo-unicco.txt", import.meta.url), "utf-8");
const beacon = vetores.loteria_federal.saida;

const C = await commit(payload);
const semente = await derivarSemente(C, beacon);
const resultado = await sortear(payload, beacon);

vetores.exemplo_unicco = {
  arquivo: "exemplo-unicco.txt",
  beacon,
  commit: hex(C),
  semente: hex(semente),
  agrupamento: resultado.agrupamento,
  grupos: resultado.grupos,
  pre_atribuidas: resultado.preAtribuidas.map((a) => `${a.vaga} -> ${a.unidade}`),
  resultado_hash: resultado.resultadoHash,
  ordem_sorteada: resultado.ordemSorteada,
  atribuicoes: resultado.atribuicoes.map((a) => `${a.pedido} -> ${a.grupo}/${a.lote} (${a.vagas.join("+")})`),
  sem_vaga: resultado.semVaga.map((s) => s.pedido),
};

/* 6. A outra política de casamento, travada nos vetores também */
{
  const payloadPE = payload.replace(
    "politica_casamento=MENOR_ADEQUADO",
    "politica_casamento=PRIMEIRO_ELEGIVEL"
  );
  const pe = await sortear(payloadPE, beacon);
  vetores.politica_primeiro_elegivel = {
    commit: pe.commit,
    resultado_hash: pe.resultadoHash,
    sem_vaga: pe.semVaga.map((s) => s.pedido),
  };
}

/* 6a. Sorteio por grupo: ninguém atravessa a fronteira do seu grupo, e trocar
       o agrupamento por um grupo único muda o resultado inteiro */
{
  const porGrupo = {};
  for (const a of resultado.atribuicoes) {
    (porGrupo[a.grupo] ||= []).push(a.vagas.join("+"));
  }

  const payloadUnico = payload
    .replace(/grupo=Coberta/g, `grupo=${GRUPO_UNICO}`)
    .replace(/grupo=Descoberta/g, `grupo=${GRUPO_UNICO}`)
    .replace("agrupamento=Cobertura", "agrupamento=NENHUM");
  const u = await sortear(payloadUnico, beacon);

  vetores.grupos = {
    vagas_por_grupo: Object.fromEntries(
      Object.keys(porGrupo).sort().map((g) => [g, porGrupo[g].sort()])
    ),
    grupo_unico: {
      grupos: u.grupos,
      commit: u.commit,
      resultado_hash: u.resultadoHash,
      difere_do_agrupado: u.resultadoHash !== resultado.resultadoHash,
      sem_vaga: u.semVaga.map((s) => s.pedido),
    },
  };
}

/* 6b. Drand quicknet: aritmética de rodadas e forma canônica do valor */
{
  const instantes = [
    "2026-10-14T19:47:00-03:00",
    "2026-10-14T19:57:00-03:00",
    "2023-08-23T15:09:27Z", // gênese da quicknet
  ];
  vetores.drand = {
    cadeia: DRAND.cadeia,
    genesis: DRAND.genesis,
    periodo: DRAND.periodo,
    rodada_em: instantes.map((iso) => ({ iso, rodada: rodadaDrandEm(Date.parse(iso)) })),
    instante_da_rodada: [1, 2, 33071752].map((r) => ({
      rodada: r,
      epoch_s: instanteDaRodada(r) / 1000,
    })),
    url: urlDaRodada(33071752),
    normalizado: normalizarDrand(
      "33071752",
      "8D3C2B1A0F9E8D7C6B5A49382716059483726150AF9E8D7C6B5A493827160594".toLowerCase()
    ),
  };
}

/* 6c. Sorteio completo pela outra fonte, com o mesmo cadastro */
const payloadDrand = readFileSync(
  new URL("./exemplo-unicco-drand.txt", import.meta.url),
  "utf-8"
);
{
  const rodada = rodadaDeclarada(payloadDrand.split("\n").find((l) => l.startsWith("beacon=")).slice(7));
  const aleatorio = "8d3c2b1a0f9e8d7c6b5a49382716059483726150af9e8d7c6b5a493827160594";
  const valor = normalizarDrand(rodada, aleatorio);
  const d = await sortear(payloadDrand, valor);
  vetores.exemplo_drand = {
    arquivo: "exemplo-unicco-drand.txt",
    rodada,
    beacon: valor,
    fonte: d.fonte,
    commit: d.commit,
    semente: d.semente,
    resultado_hash: d.resultadoHash,
    ordem_sorteada: d.ordemSorteada,
    atribuicoes: d.atribuicoes.map((a) => `${a.pedido} -> ${a.grupo}/${a.lote} (${a.vagas.join("+")})`),
    sem_vaga: d.semVaga.map((s) => s.pedido),
    resultado_difere_do_federal: d.resultadoHash !== resultado.resultadoHash,
  };
}

/* 6d. O que a validação do beacon tem que recusar */
{
  const linhaBeacon = payloadDrand.split("\n").find((l) => l.startsWith("beacon="));
  const declDrand = linhaBeacon.slice(7);
  const rodada = rodadaDeclarada(declDrand);
  const bom = normalizarDrand(rodada, "8d3c2b1a0f9e8d7c6b5a49382716059483726150af9e8d7c6b5a493827160594");
  const casos = [
    ["federal com quatro premios", "LOTERIA_FEDERAL|concurso 1|2026-01-01", "64423|83481|37422|27068", "2026-10-14T19:47:00-03:00"],
    ["fonte inexistente", "RANDOM_ORG|hoje", "64423|83481|37422|27068|57566", "2026-10-14T19:47:00-03:00"],
    ["drand com outra rodada", declDrand, normalizarDrand(rodada + 1, "8d3c2b1a0f9e8d7c6b5a49382716059483726150af9e8d7c6b5a493827160594"), "2026-10-14T19:47:00-03:00"],
    ["drand com rodada anterior ao congelamento", declDrand, bom, "2026-10-14T20:47:00-03:00"],
    ["valor federal em compromisso drand", declDrand, "64423|83481|37422|27068|57566", "2026-10-14T19:47:00-03:00"],
  ];
  vetores.beacon_recusado = casos.map(([nome, decl, valor, congelado]) => {
    let recusou = false;
    try { validarBeacon(decl, valor, congelado); } catch (e) { recusou = true; }
    return { nome, declaracao: decl, valor, congelado_em: congelado, recusou };
  });
  vetores.beacon_aceito = {
    fonte_federal: fonteDoBeacon("LOTERIA_FEDERAL|concurso 6107|2026-10-14"),
    fonte_drand: fonteDoBeacon(declDrand),
  };
}

/* 7. Sensibilidade: mudar 1 dígito do beacon muda tudo */
{
  const beaconAlterado = beacon.replace(/^64423/, "64424");
  const alt = await sortear(payload, beaconAlterado);
  vetores.sensibilidade = {
    beacon_alterado: beaconAlterado,
    commit_igual: alt.commit === hex(C),
    semente_diferente: alt.semente !== hex(semente),
    resultado_diferente: alt.resultadoHash !== resultado.resultadoHash,
    resultado_hash_alterado: alt.resultadoHash,
  };
}

writeFileSync(
  new URL("./vetores.json", import.meta.url),
  JSON.stringify(vetores, null, 2) + "\n",
  "utf-8"
);

console.log(JSON.stringify(vetores, null, 2));
