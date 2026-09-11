/**
 * Gera core/sorteio.browser.js a partir de core/sorteio.mjs.
 *
 * Motivo: páginas abertas por file:// não carregam ES modules (o navegador
 * bloqueia por CORS), mas carregam <script src> clássico normalmente. Como a
 * aplicação tem que abrir com duplo clique, sem servidor e sem build, o motor
 * precisa existir também como script clássico.
 *
 * Uma fonte só: sorteio.mjs. Este arquivo é derivado e não deve ser editado.
 *
 *   node tools/gerar-browser.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const origem = new URL("../core/sorteio.mjs", import.meta.url);
const destino = new URL("../core/sorteio.browser.js", import.meta.url);

const fonte = readFileSync(origem, "utf-8");

// Nomes exportados, na ordem em que aparecem, para montar o objeto global.
// Pega funções e constantes: o motor exporta as duas coisas.
const exportados = [
  ...fonte.matchAll(/^export\s+(?:async\s+function|function|const)\s+([A-Za-z0-9_]+)/gm),
].map((m) => m[1]);

if (exportados.length === 0) throw new Error("nada exportado encontrado");

const corpo = fonte.replace(/^export\s+/gm, "");

const saida = `/* ARQUIVO GERADO. Não edite.
 * Origem: core/sorteio.mjs
 * Regere com: node tools/gerar-browser.mjs
 * Expõe o motor como window.GJ para uso em páginas abertas por file://.
 */
(function (global) {
"use strict";

${corpo}

global.GJ = { ${exportados.join(", ")} };
})(typeof window !== "undefined" ? window : globalThis);
`;

writeFileSync(destino, saida, "utf-8");
console.log(`core/sorteio.browser.js gerado com ${exportados.length} exportações:`);
console.log("  " + exportados.join(", "));
