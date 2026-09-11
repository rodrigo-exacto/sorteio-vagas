/**
 * Gera os payloads canônicos de referência.
 *
 * Exemplo realista: Condomínio Unicco, Poá. Números fictícios para teste.
 * 16 unidades, 3 delas com direito a duas vagas. O condomínio divide a garagem
 * em cobertas (subsolo, G1) e descobertas (pátio, G2), e cada unidade concorre
 * dentro do seu grupo: é o caso de "grupos fixos por unidade".
 *
 *   node core/gerar-exemplo.mjs
 */
import { serializePayload, rodadaDrandEm, DRAND } from "./sorteio.mjs";
import { writeFileSync } from "node:fs";

// codigo, rotulo, tickets que entram no sorteio, porte, grupo
const unidades = [
  ["11", "APTO 11", 1, "M", "Coberta"],
  ["12", "APTO 12", 1, "P", "Coberta"],
  ["13", "APTO 13", 2, "M", "Coberta"],
  ["14", "APTO 14", 1, "G", "Coberta"],
  ["21", "APTO 21", 1, "M", "Coberta"],
  ["22", "APTO 22", 1, "M", "Coberta"],
  ["23", "APTO 23", 1, "P", "Coberta"],
  ["24", "APTO 24", 2, "M", "Coberta"],
  ["31", "APTO 31", 1, "G", "Descoberta"],
  ["32", "APTO 32", 1, "M", "Descoberta"],
  ["33", "APTO 33", 1, "M", "Descoberta"],
  ["34", "APTO 34", 1, "P", "Descoberta"],
  ["41", "APTO 41", 1, "M", "Descoberta"],
  // 42 tem direito a duas vagas, mas uma já foi destinada fora do sorteio
  ["42", "APTO 42", 1, "G", "Descoberta"],
  ["43", "APTO 43", 1, "M", "Descoberta"],
  ["44", "APTO 44", 1, "M", "Descoberta"],
];

// codigo, vagas, porte, capacidade, grupo
const lotes = [
  ["L01", ["G1-01"], "M", 1, "Coberta"],
  ["L02", ["G1-02"], "M", 1, "Coberta"],
  ["L03", ["G1-03"], "G", 1, "Coberta"],
  ["L04", ["G1-04"], "P", 1, "Coberta"],
  ["L05", ["G1-05"], "M", 1, "Coberta"],
  ["L06", ["G1-06", "G1-07"], "G", 2, "Coberta"], // vagas presas, dupla
  ["L07", ["G1-08"], "M", 1, "Coberta"],
  ["L08", ["G1-09"], "M", 1, "Coberta"],
  ["L09", ["G1-10"], "P", 1, "Coberta"],
  ["L10", ["G2-01"], "G", 1, "Descoberta"],
  ["L11", ["G2-02"], "G", 1, "Descoberta"],
  ["L12", ["G2-03", "G2-04"], "M", 2, "Descoberta"], // vagas presas, dupla
  ["L13", ["G2-05"], "M", 1, "Descoberta"],
  ["L14", ["G2-06"], "P", 1, "Descoberta"],
  ["L15", ["G2-07"], "M", 1, "Descoberta"],
  ["L16", ["G2-08"], "M", 1, "Descoberta"],
];

// Etiquetas descritivas. A família Cobertura é a que rege o sorteio; Nivel
// entra só como informação que fica travada no compromisso.
const etiquetas = [];
for (let i = 1; i <= 12; i++) {
  etiquetas.push({
    vaga: `G1-${String(i).padStart(2, "0")}`,
    valores: { Cobertura: "Coberta", Nivel: "Subsolo" },
  });
}
for (let i = 1; i <= 9; i++) {
  etiquetas.push({
    vaga: `G2-${String(i).padStart(2, "0")}`,
    valores: { Cobertura: "Descoberta", Nivel: "Patio" },
  });
}

// Congelamento na abertura da assembleia, minutos antes da extração das 20h.
const CONGELADO_EM = "2026-10-14T19:47:00-03:00";

const spec = {
  meta: {
    condominio: "Condominio Residencial Unicco",
    cnpj: "00.000.000/0001-00",
    assembleia: "2026-10-14T19:30:00-03:00",
    congelado_em: CONGELADO_EM,
    modalidade: "ATRIBUICAO_DIRETA",
    politica_casamento: "MENOR_ADEQUADO",
    agrupamento: "Cobertura",
    beacon: "LOTERIA_FEDERAL|concurso 6107|2026-10-14",
    beacon_fallback: "LOTERIA_FEDERAL|concurso 6108|2026-10-17",
    sem_vaga: "LISTA_DE_ESPERA_POR_ORDEM_DE_SORTEIO",
    salt: "7f3c9a21e8b04d5f6a1c2e9b8d47f350",
    regras: "Sorteio de vagas de garagem em area comum, ciclo anual. Cada unidade concorre dentro do seu grupo de cobertura, na forma da convencao. Vagas acessiveis ficam sob administracao do condominio e fora do pool. Unidade com direito a duas vagas concorre com dois pedidos. Lote duplo comporta duas unidades em vagas presas. Pedido sem lote elegivel entra em lista de espera pela ordem sorteada.",
  },
  demandantes: unidades.map(([codigo, rotulo, tickets, porte, grupo]) => ({
    codigo, rotulo, tickets, porte, grupo,
  })),
  lotes: lotes.map(([codigo, vagas, porte, capacidade, grupo]) => ({
    codigo, vagas, porte, capacidade, grupo,
  })),
  etiquetas,
  preAtribuidas: [
    {
      vaga: "G2-09",
      unidade: "42",
      motivo: "Vaga contigua a rampa destinada a unidade 42 por laudo medico apresentado, deliberado em AGE de 12/09/2026",
    },
  ],
  foraDoPool: [
    { vaga: "G1-11", motivo: "Vaga acessivel, Decreto 9.451/2018 art. 8 par. 3, sob administracao do condominio" },
    { vaga: "G1-12", motivo: "Vaga acessivel adicional aprovada em AGE, ata de 12/09/2026" },
  ],
};

const texto = serializePayload(spec);
writeFileSync(new URL("./exemplo-unicco.txt", import.meta.url), texto, "utf-8");

// Mesmo cadastro, outra fonte: rodada do drand dez minutos à frente do
// congelamento. É o caminho para assembleia em dia que não tem extração.
const rodada = rodadaDrandEm(Date.parse(CONGELADO_EM) + 10 * 60 * 1000);
const specDrand = {
  ...spec,
  meta: {
    ...spec.meta,
    beacon: `DRAND_QUICKNET|${DRAND.cadeia}|${rodada}`,
    beacon_fallback: `DRAND_QUICKNET|${DRAND.cadeia}|${rodada + 200}`,
  },
};
writeFileSync(
  new URL("./exemplo-unicco-drand.txt", import.meta.url),
  serializePayload(specDrand),
  "utf-8"
);

console.log(texto);
console.log("\nrodada drand do exemplo:", rodada);
