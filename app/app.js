/* Garagem Justa - aplicação de sorteio de vagas
 *
 * Script clássico de propósito: a página abre por file://, sem servidor e sem
 * build, e ES modules não carregam nesse contexto.
 *
 * O motor de sorteio vive em core/sorteio.browser.js, exposto como window.GJ.
 * Aqui só existe cadastro, conferência, apresentação e exportação. Nenhuma
 * decisão de sorteio é tomada neste arquivo.
 */
(function () {
"use strict";

var CHAVE_LOCAL = "garagem-justa/projeto/v1";
var enc = new TextEncoder();

/* ====================================================================== */
/* Utilidades                                                              */
/* ====================================================================== */

function $(id) { return document.getElementById(id); }
function el(tag, props, filhos) {
  var n = document.createElement(tag);
  if (props) for (var k in props) {
    if (k === "class") n.className = props[k];
    else if (k === "text") n.textContent = props[k];
    else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), props[k]);
    else n.setAttribute(k, props[k]);
  }
  (filhos || []).forEach(function (f) { if (f) n.appendChild(f); });
  return n;
}

async function sha256Hex(texto) {
  var b = await crypto.subtle.digest("SHA-256", enc.encode(texto));
  return Array.from(new Uint8Array(b), function (x) {
    return x.toString(16).padStart(2, "0");
  }).join("");
}

function aviso(msg) {
  var a = $("aviso-flutuante");
  a.textContent = msg;
  a.classList.add("on");
  clearTimeout(aviso._t);
  aviso._t = setTimeout(function () { a.classList.remove("on"); }, 3200);
}

function baixar(nomeArquivo, conteudo, tipo) {
  var blob = new Blob([conteudo], { type: (tipo || "text/plain") + ";charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = el("a", { href: url, download: nomeArquivo });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
}

/** ISO 8601 com o fuso da máquina, segundos inclusive. */
function isoDeData(d) {
  var off = -d.getTimezoneOffset();
  var sinal = off >= 0 ? "+" : "-";
  var hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  var mm = String(Math.abs(off) % 60).padStart(2, "0");
  function p(n) { return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
    "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()) +
    sinal + hh + ":" + mm;
}

/** Converte o valor do datetime-local em ISO 8601 com o fuso da máquina. */
function isoComFuso(valor) {
  if (!valor) return "";
  var d = new Date(valor);
  if (isNaN(d)) return valor;
  return isoDeData(d);
}

function isoAgora() { return isoDeData(new Date()); }

/** dd/mm/aaaa hh:mm:ss, para o instante do congelamento. */
function dataBRSeg(iso) {
  if (!iso) return "-";
  var d = new Date(iso);
  if (isNaN(d)) return iso;
  function p(n) { return String(n).padStart(2, "0"); }
  return dataBR(iso) + ":" + p(d.getSeconds());
}

function dataBR(iso) {
  if (!iso) return "-";
  var d = new Date(iso);
  if (isNaN(d)) return iso;
  function p(n) { return String(n).padStart(2, "0"); }
  return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() +
    " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

/** Remove caracteres que quebrariam o formato canônico do payload. */
function limpo(s) {
  return String(s == null ? "" : s).replace(/[;\n\r\t+=\[\]]/g, " ").replace(/\s+/g, " ").trim();
}

function csvParse(texto) {
  var linhas = texto.replace(/\r\n?/g, "\n").split("\n").filter(function (l) { return l.trim() !== ""; });
  if (!linhas.length) return [];
  var sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ";" : ",";
  var cab = linhas[0].split(sep).map(function (c) {
    return c.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  });
  return linhas.slice(1).map(function (l) {
    var celulas = l.split(sep);
    var obj = {};
    cab.forEach(function (c, i) { obj[c] = (celulas[i] || "").trim(); });
    return obj;
  });
}

function csvEscape(v) {
  var s = String(v == null ? "" : v);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/* ====================================================================== */
/* Estado                                                                  */
/* ====================================================================== */

var PORTES = ["P", "M", "G"];
var CLASSIF = [
  ["AREA_COMUM", "Área comum"],
  ["ACESSORIA_INDETERMINADA", "Acessória indeterminada"],
  ["ACESSORIA_DETERMINADA", "Acessória determinada (bloqueada)"],
  ["UNIDADE_AUTONOMA", "Unidade autônoma matriculada (bloqueada)"],
];
var CLASSIF_BLOQUEADA = ["ACESSORIA_DETERMINADA", "UNIDADE_AUTONOMA"];

function projetoNovo() {
  return {
    versao: 1,
    meta: {
      condominio: "", cnpj: "", assembleia: "",
      modalidade: "ATRIBUICAO_DIRETA",
      politica_casamento: "MENOR_ADEQUADO",
      agrupamento: "",
      fonte: "LOTERIA_FEDERAL",
      beacon: "", beacon_fallback: "", antecedencia: 10,
      sem_vaga: "LISTA_DE_ESPERA_POR_ORDEM_DE_SORTEIO",
      salt: "", regras: "",
    },
    familias: [],
    unidades: [],
    vagas: [],
    diretas: [],
    lotesCfg: {},
    ciclo: null,
    log: [],
  };
}

var GRUPO_UNICO = "GERAL";

/* ---------- etiquetas ---------- */

function familias() { return P.familias || (P.familias = []); }

function valoresDa(nome) {
  var f = familias().filter(function (x) { return x.nome === nome; })[0];
  if (!f) return [];
  return String(f.valores || "").split(",").map(function (v) { return limpo(v); })
    .filter(function (v) { return v; });
}

/** Nome da família que rege o sorteio, ou "" quando não há divisão. */
function agrupamento() {
  var a = limpo(P.meta.agrupamento);
  return valoresDa(a).length ? a : "";
}

function etqDa(vaga, familia) {
  return (vaga.etq && vaga.etq[familia]) || "";
}

/**
 * Grupo de uma vaga. Por padrão é o valor dela na família regente, que é o
 * caso normal. O campo grupo permite dizer outra coisa, e existe por um motivo
 * concreto: quando sobram vagas cobertas depois de atendido o grupo das
 * cobertas, elas precisam concorrer no grupo das descobertas sem deixar de ser
 * cobertas na descrição. A conferência avisa sempre que os dois divergem, para
 * que a exceção vá declarada no edital.
 */
function grupoDaVaga(vaga) {
  var a = agrupamento();
  if (!a) return GRUPO_UNICO;
  return limpo(vaga.grupo) || etqDa(vaga, a);
}

function grupoDivergeDaEtiqueta(vaga) {
  var a = agrupamento();
  if (!a || !limpo(vaga.grupo)) return false;
  var etq = etqDa(vaga, a);
  return !!etq && etq !== limpo(vaga.grupo);
}

function gruposPossiveis() {
  var a = agrupamento();
  return a ? valoresDa(a) : [GRUPO_UNICO];
}

function grupoDaUnidade(u) {
  var a = agrupamento();
  if (!a) return GRUPO_UNICO;
  return limpo(u.grupo);
}

/* ---------- atribuições diretas ---------- */

function diretas() { return P.diretas || (P.diretas = []); }

function diretasDa(codigoUnidade) {
  return diretas().filter(function (d) { return limpo(d.unidade) === codigoUnidade; });
}

function vagaEstaDireta(codigoVaga) {
  return diretas().some(function (d) { return limpo(d.vaga) === codigoVaga; });
}

var P = projetoNovo();

/* Filtros das tabelas. São só de visualização: não entram no payload, não
   afetam o sorteio e não são salvos no projeto. */
var filtroU = "", filtroV = "";

function achatar(s) {
  return String(s == null ? "" : s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function casa(termo, partes) {
  var t = achatar(termo).trim();
  if (!t) return true;
  var alvo = partes.map(achatar).join(" ");
  return t.split(/\s+/).every(function (p) { return alvo.indexOf(p) !== -1; });
}

function salvarLocal() {
  try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(P)); } catch (e) { /* sem storage, tudo bem */ }
}
function carregarLocal() {
  try {
    var bruto = localStorage.getItem(CHAVE_LOCAL);
    if (!bruto) return false;
    var p = JSON.parse(bruto);
    if (!p || !p.meta) return false;
    P = normalizarProjeto(p);
    return true;
  } catch (e) { return false; }
}

/**
 * Preenche o que projetos antigos não tinham. Ciclo congelado por versão
 * anterior é descartado: o payload dele não traz congelado_em nem a fonte
 * declarada, e sortear com ele falharia na conferência do beacon.
 */
function normalizarProjeto(p) {
  var padrao = projetoNovo().meta;
  Object.keys(padrao).forEach(function (k) {
    if (p.meta[k] === undefined || p.meta[k] === null || p.meta[k] === "") {
      if (padrao[k] !== "") p.meta[k] = padrao[k];
    }
  });
  if (!p.log) p.log = [];
  if (!p.familias) p.familias = [];
  if (!p.diretas) p.diretas = [];
  // Versão anterior guardava a vaga já destinada num campo escondido da
  // unidade. Vira linha da aba de atribuições diretas, com motivo a preencher.
  (p.unidades || []).forEach(function (u) {
    if (u.atribuicaoAdm) {
      p.diretas.push({ unidade: u.codigo, vaga: u.atribuicaoAdm, motivo: "" });
      delete u.atribuicaoAdm;
    }
  });
  if (p.ciclo && !p.ciclo.beaconDecl) p.ciclo = null;
  return p;
}

function congelado() { return !!(P.ciclo && P.ciclo.payload); }
function apurado() { return !!(P.ciclo && P.ciclo.resultado); }

/** Fonte em vigor: a do compromisso, se já houver, senão a escolhida na aba 1. */
function fonteAtual() {
  if (congelado() && P.ciclo.fonte) return P.ciclo.fonte;
  return P.meta.fonte || "LOTERIA_FEDERAL";
}

function nomeFonte(f) {
  return f === "DRAND_QUICKNET" ? "drand quicknet" : "Loteria Federal";
}

/** Declaração do beacon que entra no payload, montada no congelamento. */
function declararBeacon(congeladoEm) {
  if (fonteAtual() === "LOTERIA_FEDERAL") return limpo(P.meta.beacon);
  var minutos = Math.max(2, Number(P.meta.antecedencia) || 10);
  var rodada = GJ.rodadaDrandEm(Date.parse(congeladoEm) + minutos * 60000);
  return "DRAND_QUICKNET|" + GJ.DRAND.cadeia + "|" + rodada;
}

function contingenciaPadrao() {
  var f = fonteAtual();
  if (limpo(P.meta.beacon_fallback)) return limpo(P.meta.beacon_fallback);
  return f === "DRAND_QUICKNET"
    ? "DRAND_QUICKNET|" + GJ.DRAND.cadeia + "|rodada seguinte a de numero declarado"
    : "LOTERIA_FEDERAL|extracao seguinte a citada";
}

/* ====================================================================== */
/* Cadeia de eventos                                                       */
/* ====================================================================== */

async function registrar(tipo, dados) {
  var anterior = P.log.length ? P.log[P.log.length - 1].hash : "";
  var ev = {
    seq: P.log.length,
    ts: new Date().toISOString(),
    tipo: tipo,
    dados: dados || "",
  };
  ev.hash = await sha256Hex([anterior, ev.seq, ev.ts, ev.tipo, ev.dados].join("|"));
  P.log.push(ev);
  salvarLocal();
  return ev;
}

function cadeiaTexto() {
  var L = ["GARAGEM-JUSTA/CADEIA/v1"];
  P.log.forEach(function (e) {
    L.push([e.seq, e.ts, e.tipo, e.dados, e.hash].join("|"));
  });
  return L.join("\n");
}

/* ====================================================================== */
/* Derivação de lotes                                                      */
/* ====================================================================== */

function vagasNoPool() {
  return P.vagas.filter(function (v) {
    return !v.foraPool &&
      CLASSIF_BLOQUEADA.indexOf(v.classificacao) === -1 &&
      !vagaEstaDireta(limpo(v.codigo));
  });
}

function lotesDerivados() {
  var acc = {};
  vagasNoPool().forEach(function (v) {
    var cod = limpo(v.lote) || ("L-" + limpo(v.codigo));
    if (!acc[cod]) acc[cod] = { codigo: cod, vagas: [], porte: "P", grupos: {} };
    acc[cod].vagas.push(limpo(v.codigo));
    acc[cod].grupos[grupoDaVaga(v) || "(sem grupo)"] = true;
    // O porte do lote é o menor entre suas vagas: o conjunto só comporta o que
    // couber na vaga mais apertada.
    if (PORTES.indexOf(v.porte) < PORTES.indexOf(acc[cod].porte) || acc[cod].vagas.length === 1) {
      acc[cod].porte = v.porte;
    }
  });
  return Object.keys(acc).sort().map(function (cod) {
    var g = acc[cod];
    var cfg = P.lotesCfg[cod];
    g.capacidade = cfg && cfg.capacidade ? Math.min(cfg.capacidade, g.vagas.length) : g.vagas.length;
    var nomes = Object.keys(g.grupos);
    // Lote só pode pertencer a um grupo. Misturado, a conferência acusa.
    g.grupo = nomes.length === 1 ? nomes[0] : "";
    g.gruposMisturados = nomes.length > 1 ? nomes : null;
    return g;
  });
}

function pedidosPorUnidade(u) {
  var t = Number(u.tickets) || 0;
  t -= diretasDa(limpo(u.codigo)).length;
  return Math.max(0, t);
}

function capacidadePorGrupo() {
  var mapa = {};
  lotesDerivados().forEach(function (l) {
    if (!l.grupo) return;
    mapa[l.grupo] = (mapa[l.grupo] || 0) + l.capacidade;
  });
  return mapa;
}

function pedidosPorGrupo() {
  var mapa = {};
  P.unidades.forEach(function (u) {
    var n = pedidosPorUnidade(u);
    if (!n) return;
    var g = grupoDaUnidade(u) || "(sem grupo)";
    mapa[g] = (mapa[g] || 0) + n;
  });
  return mapa;
}

function totalPedidos() {
  return P.unidades.reduce(function (s, u) { return s + pedidosPorUnidade(u); }, 0);
}
function totalCapacidade() {
  return lotesDerivados().reduce(function (s, l) { return s + l.capacidade; }, 0);
}

/* ====================================================================== */
/* Montagem do payload                                                     */
/* ====================================================================== */

function montarSpec(congeladoEm, beaconDecl) {
  var demandantes = [];
  P.unidades.forEach(function (u) {
    var n = pedidosPorUnidade(u);
    if (n > 0) {
      demandantes.push({
        codigo: limpo(u.codigo),
        rotulo: limpo(u.rotulo) || limpo(u.codigo),
        tickets: n,
        porte: u.porte,
        grupo: grupoDaUnidade(u) || GRUPO_UNICO,
      });
    }
  });

  var etiquetas = [];
  P.vagas.forEach(function (v) {
    var valores = {};
    familias().forEach(function (f) {
      var val = etqDa(v, f.nome);
      if (val) valores[limpo(f.nome)] = limpo(val);
    });
    if (Object.keys(valores).length) {
      etiquetas.push({ vaga: limpo(v.codigo), valores: valores });
    }
  });

  var pre = diretas().map(function (d) {
    return {
      vaga: limpo(d.vaga),
      unidade: limpo(d.unidade),
      motivo: limpo(d.motivo),
    };
  });

  var fora = P.vagas.filter(function (v) {
    return (v.foraPool || CLASSIF_BLOQUEADA.indexOf(v.classificacao) !== -1) &&
      !vagaEstaDireta(limpo(v.codigo));
  }).map(function (v) {
    var motivo = limpo(v.motivo);
    if (!motivo) {
      if (v.classificacao === "UNIDADE_AUTONOMA") motivo = "Unidade autonoma matriculada, art. 1.331 par. 1 do CC";
      else if (v.classificacao === "ACESSORIA_DETERMINADA") motivo = "Acessoria determinada, art. 1.339 do CC";
    }
    return { vaga: limpo(v.codigo), motivo: motivo };
  });

  return {
    meta: {
      condominio: limpo(P.meta.condominio),
      cnpj: limpo(P.meta.cnpj),
      assembleia: isoComFuso(P.meta.assembleia),
      congelado_em: congeladoEm,
      modalidade: P.meta.modalidade,
      politica_casamento: P.meta.politica_casamento,
      agrupamento: agrupamento() || "NENHUM",
      beacon: beaconDecl,
      beacon_fallback: contingenciaPadrao(),
      sem_vaga: limpo(P.meta.sem_vaga),
      salt: P.meta.salt,
      regras: limpo(P.meta.regras),
    },
    demandantes: demandantes,
    lotes: lotesDerivados(),
    etiquetas: etiquetas,
    preAtribuidas: pre,
    foraDoPool: fora,
  };
}

/* ====================================================================== */
/* Conferência                                                             */
/* ====================================================================== */

function conferir() {
  var erros = [], avisos = [];
  var m = P.meta;

  ["condominio", "cnpj", "assembleia", "sem_vaga", "regras"].forEach(function (c) {
    if (!limpo(m[c])) erros.push("Campo obrigatório vazio na aba Condomínio: " + c);
  });

  if (fonteAtual() === "LOTERIA_FEDERAL") {
    var decl = limpo(m.beacon);
    if (!decl) {
      erros.push("Informe a extração da Loteria Federal que será usada, na aba Condomínio.");
    } else if (decl.indexOf("LOTERIA_FEDERAL|") !== 0) {
      erros.push("A extração citada deve começar com LOTERIA_FEDERAL| seguido do concurso e da data.");
    }
    if (m.assembleia) {
      var dia = new Date(m.assembleia).getDay();
      if (dia !== 3 && dia !== 6) {
        avisos.push("A assembleia não cai em quarta nem em sábado, e a Loteria Federal só " +
          "extrai nesses dias, às 20h. Ou a apuração fica para depois da extração seguinte, " +
          "ou convém usar o drand, que publica uma rodada a cada três segundos.");
      }
    }
  } else {
    var minutos = Number(m.antecedencia);
    if (!(minutos >= 2 && minutos <= 120)) {
      erros.push("A antecedência da rodada do drand deve ficar entre 2 e 120 minutos.");
    } else if (minutos < 5) {
      avisos.push("Antecedência de " + minutos + " minutos é apertada: a rodada precisa nascer " +
        "depois do congelamento, e ainda há a leitura do compromisso em voz alta.");
    }
  }

  var codsU = {};
  P.unidades.forEach(function (u) {
    var c = limpo(u.codigo);
    if (!c) erros.push("Unidade sem código.");
    else if (codsU[c]) erros.push("Código de unidade repetido: " + c);
    codsU[c] = true;
    if (PORTES.indexOf(u.porte) === -1) erros.push("Unidade " + c + " sem porte válido.");
    if (!(Number(u.tickets) >= 1)) erros.push("Unidade " + c + " precisa de ao menos 1 pedido.");
    if (u.prioridade && !u.docOk) avisos.push("Unidade " + c + " marcada com prioridade e documento ainda não conferido.");
  });

  var mapaU = {};
  P.unidades.forEach(function (u) { mapaU[limpo(u.codigo)] = u; });

  var codsV = {}, mapaV = {};
  P.vagas.forEach(function (v) {
    var c = limpo(v.codigo);
    if (!c) erros.push("Vaga sem código.");
    else if (codsV[c]) erros.push("Código de vaga repetido: " + c);
    codsV[c] = true; mapaV[c] = v;
    if (PORTES.indexOf(v.porte) === -1) erros.push("Vaga " + c + " sem porte válido.");
    if (!v.classificacao) erros.push("Vaga " + c + " sem classificação dominial. A triagem é obrigatória.");
    if (v.foraPool && !limpo(v.motivo)) erros.push("Vaga " + c + " retirada do pool sem motivo declarado.");
  });

  // Atribuições diretas
  var vagasDiretas = {};
  diretas().forEach(function (d, i) {
    var cu = limpo(d.unidade), cv = limpo(d.vaga), n = i + 1;
    if (!cu || !cv) { erros.push("Atribuição direta " + n + " sem unidade ou sem vaga."); return; }
    if (!mapaU[cu]) erros.push("Atribuição direta " + n + " aponta para unidade inexistente: " + cu);
    if (!mapaV[cv]) erros.push("Atribuição direta " + n + " aponta para vaga inexistente: " + cv);
    if (!limpo(d.motivo)) {
      erros.push("Atribuição direta da vaga " + cv + " à unidade " + cu +
        " está sem motivo. O motivo é obrigatório e vai para o edital.");
    }
    if (vagasDiretas[cv]) {
      erros.push("Vaga " + cv + " foi destinada a mais de uma unidade.");
    }
    vagasDiretas[cv] = true;
    if (mapaV[cv] && CLASSIF_BLOQUEADA.indexOf(mapaV[cv].classificacao) !== -1) {
      avisos.push("Vaga " + cv + " tem classificação dominial bloqueada e já não era sorteável. " +
        "Registrá-la como atribuição direta só faz sentido para deixar o destino expresso no edital.");
    }
  });
  P.unidades.forEach(function (u) {
    var cu = limpo(u.codigo);
    var n = diretasDa(cu).length;
    if (n > (Number(u.tickets) || 0)) {
      erros.push("Unidade " + cu + " tem " + n + " vagas destinadas diretamente, mais do que os " +
        (Number(u.tickets) || 0) + " pedidos a que tem direito.");
    }
  });

  // Agrupamento
  var agr = agrupamento();
  if (limpo(P.meta.agrupamento) && !agr) {
    erros.push("A divisão do sorteio aponta para uma família de etiquetas que não existe " +
      "ou está sem valores: " + limpo(P.meta.agrupamento) + ".");
  }
  if (agr) {
    var validos = valoresDa(agr);
    P.unidades.forEach(function (u) {
      var g = grupoDaUnidade(u);
      if (!g) erros.push("Unidade " + limpo(u.codigo) + " está sem grupo de " + agr + ".");
      else if (validos.indexOf(g) === -1) {
        erros.push("Unidade " + limpo(u.codigo) + " tem grupo " + g +
          ", que não é um valor cadastrado de " + agr + ".");
      }
    });
    vagasNoPool().forEach(function (v) {
      if (!grupoDaVaga(v)) {
        erros.push("Vaga " + limpo(v.codigo) + " está no sorteio mas não tem " + agr +
          " definida. Sem isso não dá para saber em qual grupo ela entra.");
      } else if (validos.indexOf(grupoDaVaga(v)) === -1) {
        erros.push("Vaga " + limpo(v.codigo) + " foi posta no grupo " + grupoDaVaga(v) +
          ", que não é um valor cadastrado de " + agr + ".");
      }
    });
    var divergentes = vagasNoPool().filter(grupoDivergeDaEtiqueta);
    if (divergentes.length) {
      avisos.push("Há " + divergentes.length + " vagas sorteadas em grupo diferente do que a " +
        "etiqueta de " + agr + " diz: " + divergentes.map(function (v) {
          return limpo(v.codigo) + " (" + etqDa(v, agr) + " concorrendo em " + grupoDaVaga(v) + ")";
        }).join(", ") + ". Isso é lícito e é o caminho normal para vaga excedente de um grupo, " +
        "mas beneficia quem for contemplado no outro grupo: a relação e o motivo precisam " +
        "constar do edital e ser lidos na abertura.");
    }
    lotesDerivados().forEach(function (l) {
      if (l.gruposMisturados) {
        erros.push("Lote " + l.codigo + " reúne vagas de grupos diferentes (" +
          l.gruposMisturados.join(", ") + "). Vagas presas têm que ser do mesmo grupo.");
      }
    });
  }

  var pedidos = totalPedidos();
  var capacidade = totalCapacidade();
  if (pedidos === 0) erros.push("Nenhum pedido: não há o que sortear.");
  if (capacidade === 0) erros.push("Nenhum lote disponível no pool.");

  var pg = pedidosPorGrupo(), cg = capacidadePorGrupo();
  var nomesGrupos = Object.keys(pg).concat(Object.keys(cg)).filter(function (g, i, a) {
    return a.indexOf(g) === i;
  }).sort();
  var dimensionamento = nomesGrupos.map(function (g) {
    return { grupo: g, pedidos: pg[g] || 0, capacidade: cg[g] || 0 };
  });
  dimensionamento.forEach(function (d) {
    var nome = agr ? "grupo " + d.grupo : "sorteio";
    if (d.pedidos > 0 && d.capacidade === 0) {
      avisos.push("O " + nome + " tem " + d.pedidos + " pedidos e nenhuma vaga. Todos vão " +
        "para a regra de quem fica sem vaga. Confira se as etiquetas das vagas estão preenchidas.");
    } else if (d.capacidade < d.pedidos) {
      avisos.push("No " + nome + " há " + d.pedidos + " pedidos para " + d.capacidade +
        " posições. " + (d.pedidos - d.capacidade) + " ficarão sem vaga, pela regra declarada.");
    } else if (d.capacidade > d.pedidos && d.pedidos > 0) {
      avisos.push("No " + nome + " sobram " + (d.capacidade - d.pedidos) +
        " posições depois de atendidos todos os pedidos.");
    }
  });

  // Reserva de vagas acessíveis: 2% do total vinculado, piso de uma.
  var totalVagas = P.vagas.length;
  var minimoLegal = totalVagas > 0 ? Math.max(1, Math.floor(totalVagas * 0.02)) : 0;
  var retiradas = P.vagas.filter(function (v) {
    return v.foraPool || vagaEstaDireta(limpo(v.codigo));
  }).length;
  if (totalVagas > 0 && retiradas > minimoLegal) {
    avisos.push("Foram retiradas " + retiradas + " vagas do pool, acima do mínimo de " + minimoLegal +
      " (2% de " + totalVagas + ", com piso de uma). Isso é possível, mas afeta os demais condôminos: " +
      "a lista de retiradas e o fundamento de cada uma precisam constar do edital, e a retirada além do " +
      "mínimo depende de deliberação assemblear.");
  }
  if (totalVagas > 0 && retiradas === 0) {
    avisos.push("Nenhuma vaga foi reservada. Confirme se o empreendimento tem projeto protocolado a partir " +
      "de janeiro de 2020, caso em que o Decreto 9.451/2018 impõe o mínimo de " + minimoLegal + ".");
  }

  return { erros: erros, avisos: avisos, pedidos: pedidos, capacidade: capacidade,
           minimoLegal: minimoLegal, retiradas: retiradas,
           dimensionamento: dimensionamento, agrupamento: agr };
}

/* ====================================================================== */
/* Renderização                                                            */
/* ====================================================================== */

function selectDe(opcoes, valor, onChange) {
  var s = el("select", { onchange: onChange });
  opcoes.forEach(function (o) {
    var v = Array.isArray(o) ? o[0] : o;
    var t = Array.isArray(o) ? o[1] : o;
    var op = el("option", { value: v, text: t });
    if (v === valor) op.setAttribute("selected", "selected");
    s.appendChild(op);
  });
  s.value = valor || "";
  return s;
}

function campoTexto(valor, onChange, extra) {
  var i = el("input", Object.assign({ type: "text", value: valor == null ? "" : valor }, extra || {}));
  i.addEventListener("input", function () { onChange(i.value); });
  return i;
}

function renderUnidades() {
  var tb = $("u-corpo");
  tb.textContent = "";
  var trava = congelado();
  var agr = agrupamento();
  $("u-th-grupo").classList.toggle("oculto", !agr);
  $("u-th-grupo").textContent = agr || "Grupo";

  if (!P.unidades.length) {
    tb.appendChild(el("tr", {}, [el("td", { colspan: "8" }, [el("div", { class: "vazio",
      text: "Nenhuma unidade. Adicione manualmente ou importe um CSV." })])]));
  }

  var mostradas = 0;
  P.unidades.forEach(function (u, idx) {
    if (!casa(filtroU, [u.codigo, u.rotulo, u.grupo, u.porte])) return;
    mostradas++;
    function set(campo) {
      return function (v) { u[campo] = v; salvarLocal(); atualizarSelos(); };
    }
    var tr = el("tr");
    tr.appendChild(el("td", {}, [campoTexto(u.codigo, set("codigo"))]));
    tr.appendChild(el("td", {}, [campoTexto(u.rotulo, set("rotulo"))]));

    var inpT = el("input", { type: "number", min: "1", max: "9", value: String(u.tickets || 1) });
    inpT.addEventListener("input", function () { u.tickets = Number(inpT.value) || 1; salvarLocal(); atualizarSelos(); });
    tr.appendChild(el("td", { class: "num" }, [inpT]));

    tr.appendChild(el("td", {}, [selectDe(PORTES, u.porte || "M", function (e) {
      u.porte = e.target.value; salvarLocal(); atualizarSelos();
    })]));

    var tdG = el("td", { class: agr ? "" : "oculto" });
    if (agr) {
      tdG.appendChild(selectDe([""].concat(valoresDa(agr)), limpo(u.grupo), function (e) {
        u.grupo = e.target.value; salvarLocal(); renderConferencia(); atualizarSelos();
      }));
    }
    tr.appendChild(tdG);

    var chP = el("input", { type: "checkbox" });
    chP.checked = !!u.prioridade;
    chP.addEventListener("change", function () { u.prioridade = chP.checked; salvarLocal(); atualizarSelos(); });
    tr.appendChild(el("td", {}, [chP]));

    var chD = el("input", { type: "checkbox" });
    chD.checked = !!u.docOk;
    chD.addEventListener("change", function () { u.docOk = chD.checked; salvarLocal(); atualizarSelos(); });
    tr.appendChild(el("td", {}, [chD]));

    tr.appendChild(el("td", {}, [el("button", {
      class: "mini", type: "button", text: "remover",
      onclick: function () { P.unidades.splice(idx, 1); salvarLocal(); renderTudo(); },
    })]));

    if (trava) tr.querySelectorAll("input,select,button").forEach(function (n) { n.disabled = true; });
    tb.appendChild(tr);
  });

  var comPrioridade = P.unidades.filter(function (u) { return u.prioridade; }).length;
  var nd = diretas().length;
  $("u-resumo").textContent = P.unidades.length + " unidades, " + totalPedidos() +
    " pedidos no sorteio" + (nd ? " (já descontadas " + nd + " vagas destinadas diretamente)" : "") +
    ", " + comPrioridade + " com prioridade declarada." +
    (filtroU ? " Mostrando " + mostradas + " pelo filtro." : "");
}

function renderFamilias() {
  var tb = $("f-corpo");
  tb.textContent = "";
  var trava = congelado();

  if (!familias().length) {
    tb.appendChild(el("tr", {}, [el("td", { colspan: "3" }, [el("div", { class: "vazio",
      text: "Nenhuma família de etiquetas. Sem elas o sorteio roda com todas as vagas juntas." })])]));
  }

  familias().forEach(function (f, idx) {
    var tr = el("tr");
    tr.appendChild(el("td", {}, [campoTexto(f.nome, function (v) {
      f.nome = v; salvarLocal(); renderVagas(); renderUnidades(); renderMeta(); atualizarSelos();
    }, { placeholder: "Cobertura" })]));
    tr.appendChild(el("td", {}, [campoTexto(f.valores, function (v) {
      f.valores = v; salvarLocal(); renderVagas(); renderUnidades(); renderMeta(); atualizarSelos();
    }, { placeholder: "Coberta, Descoberta" })]));
    tr.appendChild(el("td", {}, [el("button", {
      class: "mini", type: "button", text: "remover",
      onclick: function () { P.familias.splice(idx, 1); salvarLocal(); renderTudo(); },
    })]));
    if (trava) tr.querySelectorAll("input,button").forEach(function (n) { n.disabled = true; });
    tb.appendChild(tr);
  });

  $("f-add").disabled = trava;
  $("f-sugerir").disabled = trava;
}

function renderVagas() {
  var tb = $("v-corpo");
  tb.textContent = "";
  var trava = congelado();

  // Cabeçalho dinâmico: uma coluna por família cadastrada.
  var cab = $("v-cabecalho");
  cab.textContent = "";
  ["Código", "Porte", "Classificação dominial"].forEach(function (t) {
    cab.appendChild(el("th", { text: t }));
  });
  familias().forEach(function (f) { cab.appendChild(el("th", { text: limpo(f.nome) || "etiqueta" })); });
  var agr = agrupamento();
  cab.appendChild(el("th", { class: agr ? "" : "oculto",
    text: agr ? "Concorre em" : "" }));
  ["Lote", "Fora do pool", "Motivo da retirada", ""].forEach(function (t) {
    cab.appendChild(el("th", { text: t }));
  });

  if (!P.vagas.length) {
    tb.appendChild(el("tr", {}, [el("td", { colspan: String(8 + familias().length) }, [el("div", { class: "vazio",
      text: "Nenhuma vaga. Adicione manualmente ou importe um CSV." })])]));
  }

  var mostradasV = 0;
  P.vagas.forEach(function (v, idx) {
    var etqs = familias().map(function (f) { return etqDa(v, limpo(f.nome)); });
    if (!casa(filtroV, [v.codigo, v.lote, v.motivo, v.porte, v.grupo].concat(etqs))) return;
    mostradasV++;
    function set(campo) {
      return function (x) { v[campo] = x; salvarLocal(); renderLotes(); atualizarSelos(); };
    }
    var bloq = CLASSIF_BLOQUEADA.indexOf(v.classificacao) !== -1;
    var tr = el("tr", { class: bloq ? "bloqueada" : (v.foraPool ? "fora" : "") });

    tr.appendChild(el("td", {}, [campoTexto(v.codigo, set("codigo"))]));
    tr.appendChild(el("td", {}, [selectDe(PORTES, v.porte || "M", function (e) {
      v.porte = e.target.value; salvarLocal(); renderLotes(); atualizarSelos();
    })]));
    tr.appendChild(el("td", {}, [selectDe(CLASSIF, v.classificacao || "", function (e) {
      v.classificacao = e.target.value;
      if (CLASSIF_BLOQUEADA.indexOf(v.classificacao) !== -1) v.foraPool = true;
      salvarLocal(); renderVagas(); renderLotes(); atualizarSelos();
    })]));

    familias().forEach(function (f) {
      var nome = limpo(f.nome);
      var td = el("td");
      td.appendChild(selectDe([""].concat(valoresDa(nome)), etqDa(v, nome), function (e) {
        if (!v.etq) v.etq = {};
        v.etq[nome] = e.target.value;
        salvarLocal(); renderLotes(); renderConferencia(); atualizarSelos();
      }));
      tr.appendChild(td);
    });

    var tdGV = el("td", { class: agr ? "" : "oculto" });
    if (agr) {
      var sel = selectDe([""].concat(valoresDa(agr)), limpo(v.grupo), function (e) {
        v.grupo = e.target.value;
        salvarLocal(); renderVagas(); renderLotes(); renderConferencia(); atualizarSelos();
      });
      if (grupoDivergeDaEtiqueta(v)) sel.classList.add("divergente");
      tdGV.appendChild(sel);
    }
    tr.appendChild(tdGV);

    tr.appendChild(el("td", {}, [campoTexto(v.lote, set("lote"), { placeholder: "opcional" })]));

    var ch = el("input", { type: "checkbox" });
    ch.checked = !!v.foraPool || bloq;
    ch.disabled = bloq;
    ch.addEventListener("change", function () { v.foraPool = ch.checked; salvarLocal(); renderVagas(); renderLotes(); atualizarSelos(); });
    tr.appendChild(el("td", {}, [ch]));

    tr.appendChild(el("td", {}, [campoTexto(v.motivo, set("motivo"),
      { placeholder: (v.foraPool || bloq) ? "obrigatório" : "" })]));

    tr.appendChild(el("td", {}, [el("button", {
      class: "mini", type: "button", text: "remover",
      onclick: function () { P.vagas.splice(idx, 1); salvarLocal(); renderTudo(); },
    })]));

    if (trava) tr.querySelectorAll("input,select,button").forEach(function (n) { n.disabled = true; });
    tb.appendChild(tr);
  });

  var bloqueadas = P.vagas.filter(function (v) { return CLASSIF_BLOQUEADA.indexOf(v.classificacao) !== -1; }).length;
  var fora = P.vagas.filter(function (v) { return v.foraPool; }).length;
  $("v-resumo").textContent = P.vagas.length + " vagas cadastradas, " + bloqueadas +
    " bloqueadas pela triagem dominial, " + fora + " retiradas por deliberação, " +
    diretas().length + " destinadas diretamente, " + vagasNoPool().length + " no sorteio." +
    (filtroV ? " Mostrando " + mostradasV + " pelo filtro." : "");
}

function renderLotes() {
  var tb = $("l-corpo");
  tb.textContent = "";
  var lotes = lotesDerivados();
  var trava = congelado();
  var agr = agrupamento();
  $("l-th-grupo").classList.toggle("oculto", !agr);
  $("l-th-grupo").textContent = agr || "Grupo";

  if (!lotes.length) {
    tb.appendChild(el("tr", {}, [el("td", { colspan: "6" }, [el("div", { class: "vazio",
      text: "Nenhum lote no pool. Cadastre vagas na aba anterior." })])]));
  }

  lotes.forEach(function (l) {
    var tr = el("tr");
    tr.appendChild(el("td", { class: "num", text: l.codigo }));
    tr.appendChild(el("td", { class: "num", text: l.vagas.join(" + ") }));
    tr.appendChild(el("td", { text: l.porte }));

    if (l.vagas.length > 1) {
      var s = selectDe(
        [[String(l.vagas.length), l.vagas.length + " unidades (vagas presas divididas)"], ["1", "1 unidade (box inteiro)"]],
        String(l.capacidade),
        function (e) {
          P.lotesCfg[l.codigo] = { capacidade: Number(e.target.value) };
          salvarLocal(); renderLotes(); atualizarSelos();
        }
      );
      if (trava) s.disabled = true;
      tr.appendChild(el("td", {}, [s]));
    } else {
      tr.appendChild(el("td", { class: "num", text: "1" }));
    }

    var tdG = el("td", { class: agr ? "" : "oculto" });
    if (agr) {
      tdG.appendChild(l.gruposMisturados
        ? el("span", { class: "selo s-erro", text: l.gruposMisturados.join(" + ") })
        : (l.grupo
            ? el("span", { class: "selo", text: l.grupo })
            : el("span", { class: "selo s-erro", text: "sem " + agr })));
    }
    tr.appendChild(tdG);

    tr.appendChild(el("td", {}, [el("span", {
      class: "selo " + (l.vagas.length > 1 ? "s-aviso" : "s-ok"),
      text: l.vagas.length > 1 ? "conjunto" : "simples",
    })]));
    tb.appendChild(tr);
  });

  var resumo = lotes.length + " lotes no pool, capacidade total de " +
    totalCapacidade() + " posições para " + totalPedidos() + " pedidos.";
  if (agr) {
    var cg = capacidadePorGrupo(), pg = pedidosPorGrupo();
    resumo += " Por grupo: " + gruposPossiveis().map(function (g) {
      return g + " " + (pg[g] || 0) + "/" + (cg[g] || 0);
    }).join(", ") + " (pedidos/posições).";
  }
  $("l-resumo").textContent = resumo;
}

/* ---------- atribuições diretas ---------- */

function renderDiretas() {
  var tb = $("a-corpo");
  tb.textContent = "";
  var trava = congelado();

  if (!diretas().length) {
    tb.appendChild(el("tr", {}, [el("td", { colspan: "4" }, [el("div", { class: "vazio",
      text: "Nenhuma vaga destinada fora do sorteio. Todas vão para o sorteio." })])]));
  }

  var opcoesU = [""].concat(P.unidades.map(function (u) {
    return [limpo(u.codigo), (limpo(u.rotulo) || limpo(u.codigo))];
  }));
  var opcoesV = [""].concat(P.vagas.map(function (v) { return limpo(v.codigo); }));

  diretas().forEach(function (d, idx) {
    var tr = el("tr");
    tr.appendChild(el("td", {}, [selectDe(opcoesU, limpo(d.unidade), function (e) {
      d.unidade = e.target.value; salvarLocal(); renderTudo();
    })]));
    tr.appendChild(el("td", {}, [selectDe(opcoesV, limpo(d.vaga), function (e) {
      d.vaga = e.target.value; salvarLocal(); renderTudo();
    })]));
    tr.appendChild(el("td", {}, [campoTexto(d.motivo, function (v) {
      d.motivo = v; salvarLocal(); renderConferencia(); atualizarSelos();
    }, { placeholder: "obrigatório: o fundamento como vai para o edital" })]));
    tr.appendChild(el("td", {}, [el("button", {
      class: "mini", type: "button", text: "remover",
      onclick: function () { P.diretas.splice(idx, 1); salvarLocal(); renderTudo(); },
    })]));
    if (trava) tr.querySelectorAll("input,select,button").forEach(function (n) { n.disabled = true; });
    tb.appendChild(tr);
  });

  $("a-add").disabled = trava;
  $("a-resumo").textContent = diretas().length + " vagas destinadas fora do sorteio, de um total de " +
    P.vagas.length + " cadastradas.";
}

function renderConferencia() {
  var c = conferir();
  var lista = $("c-lista");
  lista.textContent = "";

  function item(situacao, titulo, textos) {
    var classe = situacao === "ok" ? "s-ok" : situacao === "aviso" ? "s-aviso" : "s-erro";
    var rotulo = situacao === "ok" ? "em ordem" : situacao === "aviso" ? "atenção" : "impede";
    var dir = el("div", {}, [el("b", { text: titulo })]);
    if (textos.length) {
      var ul = el("ul");
      textos.forEach(function (t) { ul.appendChild(el("li", { text: t })); });
      dir.appendChild(ul);
    }
    lista.appendChild(el("div", { class: "item" }, [
      el("div", {}, [el("span", { class: "selo " + classe, text: rotulo })]),
      dir,
    ]));
  }

  item(c.erros.length ? "erro" : "ok",
    c.erros.length ? "Pendências que impedem o congelamento" : "Cadastro consistente",
    c.erros);

  item(c.avisos.length ? "aviso" : "ok",
    c.avisos.length ? "Pontos de atenção, não bloqueantes" : "Nenhum ponto de atenção",
    c.avisos);

  var linhasDim = [c.pedidos + " pedidos para " + c.capacidade + " posições no total."];
  if (c.agrupamento) {
    c.dimensionamento.forEach(function (d) {
      linhasDim.push(c.agrupamento + " " + d.grupo + ": " + d.pedidos + " pedidos para " +
        d.capacidade + " posições.");
    });
  }
  if (diretas().length) {
    linhasDim.push(diretas().length + " vagas destinadas diretamente, fora do sorteio.");
  }
  linhasDim.push("Mínimo legal de vagas acessíveis calculado: " + c.minimoLegal +
    ". Retiradas do pool: " + c.retiradas + ".");
  item("ok", "Dimensionamento", linhasDim);

  $("c-congelar").disabled = c.erros.length > 0 || congelado();
  $("c-descongelar").classList.toggle("oculto", !congelado() || apurado());
  $("c-anular").classList.toggle("oculto", !apurado());
  $("c-resultado").classList.toggle("oculto", !congelado());
  $("c-edital").value = blocoEdital();

  if (congelado()) {
    $("c-commit").textContent = P.ciclo.commit;
    $("c-quando").textContent = dataBRSeg(P.ciclo.congeladoEm);
    $("c-fonte").textContent = P.ciclo.beaconDecl;
    $("c-pedidos").textContent = String(c.pedidos);
    $("c-capacidade").textContent = String(c.capacidade);
    $("c-abertura").value = blocoAbertura();
  }
}

function vagasForaDoPool() {
  return P.vagas.filter(function (v) {
    return v.foraPool || CLASSIF_BLOQUEADA.indexOf(v.classificacao) !== -1;
  });
}

/**
 * Bloco da convocação. Sai antes da assembleia e por isso NÃO traz o
 * compromisso: o cadastro segue aberto até a abertura do sorteio, para que a
 * própria assembleia possa corrigir uma exceção ou incluir quem faltava. O que
 * o edital assume é o método, e é o método que amarra a administração.
 */
function blocoEdital() {
  var m = P.meta;
  var fonte = fonteAtual();
  var L = [];
  L.push("SORTEIO DE VAGAS DE GARAGEM — MÉTODO E COMPROMISSO");
  L.push("");
  L.push("O sorteio será realizado por processo publicamente verificável, em três");
  L.push("atos, na própria assembleia e nesta ordem:");
  L.push("");
  L.push("1. Encerrada a discussão, a relação de unidades participantes e de vagas");
  L.push("   sorteáveis será exibida na tela e congelada. Do congelamento se extrai");
  L.push("   um resumo criptográfico (SHA-256), que será lido em voz alta e lançado");
  L.push("   em ata. Qualquer alteração posterior, ainda que de um único caractere,");
  L.push("   faz esse resumo deixar de bater.");
  if (fonte === "LOTERIA_FEDERAL") {
    L.push("2. Em seguida será colhida a fonte externa de aleatoriedade: " + limpo(m.beacon) + ".");
    L.push("   A extração é pública, federal e posterior ao congelamento, de modo que");
    L.push("   nem a administração nem qualquer condômino pode conhecê-la de antemão.");
  } else {
    L.push("2. Em seguida será colhida a fonte externa de aleatoriedade: uma rodada do");
    L.push("   sorteio distribuído drand, rede quicknet, cujo número será fixado no ato");
    L.push("   do congelamento e situado alguns minutos à frente. A rodada é publicada");
    L.push("   por um consórcio internacional de instituições, a cada três segundos, e");
    L.push("   fica disponível em api.drand.sh para conferência de qualquer pessoa.");
    L.push("   Por ser posterior ao congelamento, não pode ser conhecida de antemão.");
  }
  L.push("3. O resultado é calculado por função determinística a partir dos dois");
  L.push("   elementos acima. Quem repetir a conta com os mesmos insumos chega");
  L.push("   necessariamente ao mesmo resultado.");
  L.push("");
  L.push("Contingência, caso a fonte falhe: " + contingenciaPadrao() + ".");
  var agr = agrupamento();
  if (agr) {
    L.push("Divisão do sorteio: por " + agr + ". Cada unidade concorre apenas às vagas");
    L.push("do seu grupo, na forma da convenção e do que a assembleia deliberar.");
    var pg = pedidosPorGrupo(), cg = capacidadePorGrupo();
    gruposPossiveis().forEach(function (g) {
      L.push("  " + g + ": " + (pg[g] || 0) + " pedidos para " + (cg[g] || 0) + " posições");
    });
  } else {
    L.push("Divisão do sorteio: nenhuma. Todas as unidades concorrem a todas as vagas.");
  }
  L.push("Política de atribuição: " + m.politica_casamento + ".");
  L.push("Regra para quem não for contemplado: " + limpo(m.sem_vaga) + ".");
  L.push("");
  L.push("VAGAS QUE NÃO ENTRAM NO SORTEIO, COM O RESPECTIVO FUNDAMENTO:");
  var fora = vagasForaDoPool();
  if (!fora.length) L.push("  nenhuma");
  fora.forEach(function (v) { L.push("  " + limpo(v.codigo) + " — " + limpo(v.motivo)); });
  L.push("");
  L.push("VAGAS JÁ DESTINADAS A UNIDADE DETERMINADA, FORA DO SORTEIO:");
  if (!diretas().length) L.push("  nenhuma");
  diretas().forEach(function (d) {
    L.push("  " + limpo(d.vaga) + " — unidade " + limpo(d.unidade) + " — " + limpo(d.motivo));
  });
  L.push("");
  L.push("A relação acima pode ser alterada até a abertura do sorteio, por deliberação");
  L.push("da assembleia, e a versão efetivamente utilizada é a que constará do resumo");
  L.push("criptográfico lançado em ata.");
  L.push("");
  L.push("Encerrado o sorteio, qualquer condômino poderá refazer o cálculo por conta");
  L.push("própria, com o verificador publicado pela administração, sem depender de");
  L.push("informação adicional e sem precisar confiar em quem organizou.");
  return L.join("\n");
}

/** Bloco da abertura: é o que se lê em voz alta antes de colher a fonte. */
function blocoAbertura() {
  if (!congelado()) return "";
  var c = conferir();
  var L = [];
  L.push("ABERTURA DO SORTEIO — COMPROMISSO");
  L.push("");
  L.push("Congelado em " + dataBRSeg(P.ciclo.congeladoEm) + ".");
  L.push("Pedidos: " + c.pedidos + ". Posições disponíveis: " + c.capacidade + ".");
  if (c.agrupamento) {
    c.dimensionamento.forEach(function (d) {
      L.push("  " + c.agrupamento + " " + d.grupo + ": " + d.pedidos + " pedidos, " +
        d.capacidade + " posições.");
    });
  }
  L.push("Vagas fora do sorteio: " + vagasForaDoPool().length +
    ". Vagas já destinadas: " + diretas().length + ".");
  L.push("");
  L.push("Compromisso (SHA-256 do conjunto congelado):");
  L.push(P.ciclo.commit);
  L.push("");
  L.push("Fonte de aleatoriedade declarada neste ato:");
  L.push(P.ciclo.beaconDecl);
  if (P.ciclo.fonte === "DRAND_QUICKNET") {
    L.push("Publicação prevista da rodada: " + dataBRSeg(new Date(GJ.instanteDaRodada(P.ciclo.rodada)).toISOString()) + ".");
    L.push("Endereço para conferência: " + GJ.urlDaRodada(P.ciclo.rodada));
  }
  L.push("");
  L.push("A aleatoriedade acima ainda não existe neste instante. Ninguém, nem a");
  L.push("administração, sabe qual será o resultado.");
  return L.join("\n");
}

function renderSorteio() {
  $("s-bloqueio").classList.toggle("oculto", congelado());
  $("s-painel").classList.toggle("oculto", !congelado());
  var temResultado = apurado();
  $("s-saida").classList.toggle("oculto", !temResultado);
  $("s-apresentar").disabled = !temResultado;

  var drand = congelado() && P.ciclo.fonte === "DRAND_QUICKNET";
  $("s-federal").classList.toggle("oculto", !congelado() || drand);
  $("s-drand").classList.toggle("oculto", !drand);

  if (drand) {
    $("dr-rodada").textContent = String(P.ciclo.rodada);
    $("dr-quando").textContent =
      dataBRSeg(new Date(GJ.instanteDaRodada(P.ciclo.rodada)).toISOString());
    $("dr-url").textContent = GJ.urlDaRodada(P.ciclo.rodada);
    if (P.ciclo.aleatorio) $("dr-valor").value = P.ciclo.aleatorio;
  }
  if (P.ciclo && P.ciclo.premios) {
    P.ciclo.premios.forEach(function (v, i) { $("p" + (i + 1)).value = v; });
  }
  if (!temResultado) return;

  var r = P.ciclo.resultado;
  $("s-fonte").textContent = nomeFonte(r.fonte) + " — " + r.beaconDeclarado;
  $("s-beacon").textContent = r.beacon;
  $("s-semente").textContent = r.semente;
  $("s-hash").textContent = r.resultadoHash;

  var varios = r.grupos && r.grupos.length > 1;
  $("s-th-grupo").classList.toggle("oculto", !varios);
  $("s-th-grupo").textContent = r.agrupamento && r.agrupamento !== "NENHUM" ? r.agrupamento : "Grupo";

  var tb = $("s-corpo");
  tb.textContent = "";
  function tdGrupo(g) {
    return el("td", { class: varios ? "" : "oculto" }, varios ? [el("span", { class: "selo", text: g })] : []);
  }
  r.atribuicoes.forEach(function (a) {
    tb.appendChild(el("tr", {}, [
      el("td", { class: "num", text: a.pedido }),
      el("td", { text: rotuloPedido(a.pedido, a.rotulo) }),
      tdGrupo(a.grupo),
      el("td", { class: "num", text: a.lote }),
      el("td", { class: "num", text: a.vagas.join(" + ") }),
    ]));
  });
  r.semVaga.forEach(function (s) {
    tb.appendChild(el("tr", {}, [
      el("td", { class: "num", text: s.pedido }),
      el("td", { text: rotuloPedido(s.pedido, s.rotulo) }),
      tdGrupo(s.grupo),
      el("td", {}, [el("span", { class: "selo s-erro", text: "sem vaga" })]),
      el("td", { text: limpo(P.meta.sem_vaga) }),
    ]));
  });
}

function renderDossie() {
  var tb = $("d-log");
  tb.textContent = "";
  if (!P.log.length) {
    tb.appendChild(el("tr", {}, [el("td", { colspan: "4" }, [el("div", { class: "vazio",
      text: "Nenhum evento registrado ainda." })])]));
  }
  P.log.forEach(function (e) {
    tb.appendChild(el("tr", {}, [
      el("td", { class: "num", text: String(e.seq) }),
      el("td", { class: "num", text: dataBR(e.ts) }),
      el("td", { text: e.tipo + (e.dados ? " — " + e.dados : "") }),
      el("td", { class: "num mono", text: e.hash.slice(0, 16) + "…" }),
    ]));
  });
  $("d-hashfinal").textContent = P.log.length ? P.log[P.log.length - 1].hash : "-";
}

function atualizarSelos() {
  $("selo-unidades").textContent = String(P.unidades.length);
  $("selo-vagas").textContent = String(P.vagas.length);
  $("selo-lotes").textContent = String(lotesDerivados().length);

  var c = conferir();
  var s = $("selo-conferencia");
  s.className = "selo " + (c.erros.length ? "erro" : c.avisos.length ? "aviso" : "");
  s.textContent = c.erros.length ? String(c.erros.length) : c.avisos.length ? String(c.avisos.length) : "ok";

  $("ident").textContent = limpo(P.meta.condominio)
    ? limpo(P.meta.condominio) + (congelado() ? " · congelado" : " · em edição")
    : "Nenhum condomínio carregado";

  $("selo-diretas").textContent = String(diretas().length);
  ["u-add", "u-importar", "u-substituir", "v-add", "v-importar", "v-substituir",
   "a-add", "f-add", "f-sugerir"].forEach(function (id) {
    $(id).disabled = congelado();
  });
}

function renderMeta() {
  // O seletor de divisão é montado a partir das famílias cadastradas.
  var sel = $("m-agrupamento");
  var atual = P.meta.agrupamento || "";
  sel.textContent = "";
  sel.appendChild(el("option", { value: "", text: "Sem divisão: todos concorrem a todas as vagas" }));
  familias().forEach(function (f) {
    var nome = limpo(f.nome);
    if (!nome) return;
    var vs = valoresDa(nome);
    sel.appendChild(el("option", {
      value: nome,
      text: "Por " + nome + (vs.length ? " (" + vs.join(", ") + ")" : " — sem valores cadastrados"),
    }));
  });
  if (atual && !familias().some(function (f) { return limpo(f.nome) === atual; })) {
    sel.appendChild(el("option", { value: atual, text: atual + " — família não cadastrada" }));
  }

  document.querySelectorAll("[data-meta]").forEach(function (n) {
    var campo = n.getAttribute("data-meta");
    var v = P.meta[campo];
    n.value = (v === undefined || v === null) ? "" : v;
    n.disabled = congelado();
  });
  var drand = fonteAtual() === "DRAND_QUICKNET";
  $("campo-federal").classList.toggle("oculto", drand);
  $("campo-antecedencia").classList.toggle("oculto", !drand);
}

function renderTudo() {
  renderMeta();
  renderFamilias();
  renderUnidades();
  renderVagas();
  renderLotes();
  renderDiretas();
  renderConferencia();
  renderSorteio();
  renderDossie();
  atualizarSelos();
}

/* ====================================================================== */
/* Ações                                                                   */
/* ====================================================================== */

function trocarAba(nome) {
  document.querySelectorAll("section.aba").forEach(function (s) {
    s.classList.toggle("ativa", s.id === "aba-" + nome);
  });
  document.querySelectorAll("nav.abas button").forEach(function (b) {
    b.setAttribute("aria-current", b.getAttribute("data-aba") === nome ? "true" : "false");
  });
  if (nome === "conferencia") renderConferencia();
  if (nome === "lotes") renderLotes();
  if (nome === "diretas") renderDiretas();
  if (nome === "dossie") renderDossie();
}

async function congelar() {
  var c = conferir();
  if (c.erros.length) { aviso("Existem pendências que impedem a abertura."); return; }

  if (!P.meta.salt) {
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    P.meta.salt = Array.from(b, function (x) { return x.toString(16).padStart(2, "0"); }).join("");
  }

  var fonte = fonteAtual();
  var congeladoEm = isoAgora();
  var beaconDecl = declararBeacon(congeladoEm);
  var rodada = null;
  if (fonte === "DRAND_QUICKNET") {
    try { rodada = GJ.rodadaDeclarada(beaconDecl); }
    catch (e) { aviso("Falha ao fixar a rodada: " + e.message); return; }
  }

  var payload;
  try {
    payload = GJ.serializePayload(montarSpec(congeladoEm, beaconDecl));
    GJ.assertCanonico(payload);
  } catch (e) {
    aviso("Falha ao montar o payload: " + e.message);
    return;
  }

  var commitBytes = await GJ.commit(payload);
  var commit = GJ.hex(commitBytes);

  P.ciclo = { congeladoEm: congeladoEm, payload: payload, commit: commit,
              fonte: fonte, beaconDecl: beaconDecl, rodada: rodada,
              beacon: null, premios: null, aleatorio: null, resultado: null };

  await registrar("COMPROMISSO_PUBLICADO",
    "commit=" + commit + "; fonte=" + beaconDecl + "; congelado_em=" + congeladoEm);
  salvarLocal();
  renderTudo();
  if (fonte === "DRAND_QUICKNET") {
    trocarAba("sorteio");
    aviso("Congelado. Leia o compromisso em voz alta e aguarde a rodada nascer.");
  } else {
    aviso("Congelado. Leia o compromisso em voz alta antes da extração das 20h.");
  }
}

/**
 * Reabrir é livre enquanto a aleatoriedade não foi colhida: até aí o
 * compromisso não serviu para nada e refazê-lo não tira prova de ninguém.
 * Depois de colhida, reabrir deixa de ser reabrir e vira anular, com motivo.
 */
async function descongelar() {
  if (apurado()) { aviso("Depois de apurado o ciclo só pode ser anulado, com motivo."); return; }
  if (!confirm(
    "Reabrir o cadastro descarta o compromisso gerado agora e volta tudo a ser editável.\n\n" +
    "Como a fonte de aleatoriedade ainda não foi colhida, isso não prejudica a prova: " +
    "basta congelar de novo quando a assembleia terminar de deliberar. A reabertura fica " +
    "registrada na cadeia de eventos.\n\nConfirma?"
  )) return;
  await registrar("CADASTRO_REABERTO", "commit descartado=" + P.ciclo.commit);
  P.ciclo = null;
  salvarLocal();
  renderTudo();
  trocarAba("conferencia");
}

/**
 * Anulação depois da apuração. O ciclo anulado não some: fica na cadeia de
 * eventos com commit, beacon e hash do resultado, justamente para que ninguém
 * possa sortear em silêncio até sair um resultado conveniente.
 */
async function anularCiclo() {
  var motivo = prompt(
    "Anular um ciclo já apurado é ato grave e fica registrado para sempre na cadeia " +
    "de eventos, com o resultado que está sendo descartado.\n\n" +
    "O novo ciclo precisará de outra fonte de aleatoriedade: outra extração, ou outra " +
    "rodada do drand.\n\nDescreva o motivo, como vai constar da ata:"
  );
  if (motivo === null) return;
  motivo = limpo(motivo);
  if (!motivo) { aviso("A anulação exige motivo."); return; }

  await registrar("CICLO_ANULADO",
    "commit=" + P.ciclo.commit + "; beacon=" + P.ciclo.beacon +
    "; resultado=" + P.ciclo.resultado.resultadoHash + "; motivo=" + motivo);
  P.ciclo = null;
  salvarLocal();
  renderTudo();
  trocarAba("conferencia");
  aviso("Ciclo anulado e registrado. Escolha outra fonte antes de congelar de novo.");
}

async function buscarDrand() {
  if (!(congelado() && P.ciclo.fonte === "DRAND_QUICKNET")) return;
  var agora = Date.now();
  var quando = GJ.instanteDaRodada(P.ciclo.rodada);
  if (agora < quando) {
    aviso("A rodada " + P.ciclo.rodada + " ainda não nasceu. Faltam " +
      Math.ceil((quando - agora) / 1000) + " segundos.");
    return;
  }
  $("dr-buscar").disabled = true;
  try {
    var resp = await fetch(GJ.urlDaRodada(P.ciclo.rodada), { cache: "no-store" });
    if (!resp.ok) throw new Error("resposta " + resp.status);
    var j = await resp.json();
    if (Number(j.round) !== Number(P.ciclo.rodada)) throw new Error("a resposta é de outra rodada");
    $("dr-valor").value = String(j.randomness || "").toLowerCase();
    aviso("Rodada " + P.ciclo.rodada + " obtida. Confira na tela projetada antes de apurar.");
  } catch (e) {
    aviso("Não consegui buscar: " + e.message + ". Abra o endereço no celular e digite o número.");
  } finally {
    $("dr-buscar").disabled = false;
  }
}

async function rodarSorteio() {
  var beacon, premios = null, aleatorio = null;

  if (P.ciclo.fonte === "DRAND_QUICKNET") {
    aleatorio = $("dr-valor").value.trim().toLowerCase();
    if (!aleatorio) { aviso("Informe a aleatoriedade da rodada."); return; }
    // Relógio local pode estar adiantado ou atrasado, então isto avisa em vez de
    // bloquear. O que de fato garante a ordem é a conferência do motor, que
    // recusa rodada anterior ao congelamento.
    if (Date.now() < GJ.instanteDaRodada(P.ciclo.rodada) - 2000 &&
        !confirm("Pelo relógio deste computador a rodada " + P.ciclo.rodada +
                 " ainda não foi publicada.\n\nSó prossiga se o número veio mesmo do drand.")) {
      return;
    }
    try {
      beacon = GJ.normalizarDrand(P.ciclo.rodada, aleatorio);
    } catch (e) { aviso(e.message); return; }
  } else {
    premios = [1, 2, 3, 4, 5].map(function (i) { return $("p" + i).value.trim(); });
    if (premios.some(function (p) { return !p; })) { aviso("Preencha os cinco prêmios."); return; }
    try {
      beacon = GJ.normalizarLoteriaFederal(premios);
    } catch (e) { aviso(e.message); return; }
  }

  var r;
  try {
    r = await GJ.sortear(P.ciclo.payload, beacon);
  } catch (e) { aviso("Falha na apuração: " + e.message); return; }

  if (r.commit !== P.ciclo.commit) {
    aviso("O payload congelado não confere com o commit. Não prossiga.");
    return;
  }

  P.ciclo.beacon = beacon;
  P.ciclo.premios = premios;
  P.ciclo.aleatorio = aleatorio;
  P.ciclo.resultado = r;

  await registrar("BEACON_COLETADO", P.ciclo.beaconDecl + " => " + beacon);
  await registrar("RESULTADO_APURADO", "hash=" + r.resultadoHash);
  salvarLocal();
  renderTudo();
  aviso("Apurado. Confira o hash do resultado e registre na ata.");
}

/** "APTO 13" vira "APTO 13 (1 de 2)" quando a unidade concorre com mais de um
 *  pedido. Sem isso o telão mostra a mesma unidade duas vezes e parece defeito. */
function rotuloPedido(pedidoId, rotulo) {
  var partes = String(pedidoId).split("#");
  var codigo = partes[0];
  var k = Number(partes[1] || 1);
  var u = P.unidades.filter(function (x) { return limpo(x.codigo) === codigo; })[0];
  var total = u ? pedidosPorUnidade(u) : 1;
  return total > 1 ? rotulo + " (" + k + " de " + total + ")" : rotulo;
}

/* ---------- apresentação ---------- */
var apIdx = 0;
function abrirApresentacao() {
  if (!(P.ciclo && P.ciclo.resultado)) return;
  apIdx = 0;
  $("ap-sobre").textContent = "Assembleia de " + dataBR(P.meta.assembleia);
  $("ap-titulo").textContent = "Sorteio de vagas de garagem";
  $("ap-cond").textContent = limpo(P.meta.condominio);
  var meta = $("ap-meta");
  meta.textContent = "";
  var rotuloFonte = P.ciclo.fonte === "DRAND_QUICKNET" ? "drand" : "Federal";
  var valorFonte = P.ciclo.fonte === "DRAND_QUICKNET"
    ? "rodada " + P.ciclo.rodada + " · " + P.ciclo.aleatorio.slice(0, 12) + "…"
    : P.ciclo.beacon.replace(/\|/g, " ");
  [["compromisso", P.ciclo.commit.slice(0, 12) + "…" + P.ciclo.commit.slice(-6)],
   [rotuloFonte, valorFonte],
   ["resultado", P.ciclo.resultado.resultadoHash.slice(0, 10) + "…"]].forEach(function (par) {
    meta.appendChild(el("div", {}, [
      document.createTextNode(par[0] + " "),
      el("b", { text: par[1] }),
    ]));
  });
  $("ap-lista").textContent = "";
  $("apresentacao").classList.add("on");
  atualizarProgresso();
}
function itensApresentacao() {
  var r = P.ciclo.resultado;
  var varios = r.grupos && r.grupos.length > 1;
  return r.atribuicoes.map(function (a) {
    return { un: rotuloPedido(a.pedido, a.rotulo), vg: a.vagas.join(" + "),
             gr: varios ? a.grupo : "", sem: false };
  }).concat(r.semVaga.map(function (s) {
    return { un: rotuloPedido(s.pedido, s.rotulo), vg: "sem vaga",
             gr: varios ? s.grupo : "", sem: true };
  }));
}
function revelarProxima() {
  var itens = itensApresentacao();
  if (apIdx >= itens.length) return;
  var it = itens[apIdx++];
  $("ap-lista").appendChild(el("div", { class: "cartao-sorteio" + (it.sem ? " sem" : "") }, [
    el("span", { class: "un", text: it.un }),
    it.gr ? el("span", { class: "gr", text: it.gr }) : null,
    el("span", { class: "vg", text: it.vg }),
  ]));
  atualizarProgresso();
}
function atualizarProgresso() {
  var total = itensApresentacao().length;
  $("ap-progresso").textContent = apIdx + " de " + total;
  $("ap-proximo").disabled = apIdx >= total;
}

/* ---------- exportações ---------- */
function nomeBase() {
  return (limpo(P.meta.condominio) || "condominio").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function trechoAta() {
  if (!(P.ciclo && P.ciclo.resultado)) return "";
  var r = P.ciclo.resultado;
  var L = [];
  L.push("# Trecho de ata — sorteio de vagas de garagem");
  L.push("");
  L.push("Condomínio: " + limpo(P.meta.condominio) + ", CNPJ " + limpo(P.meta.cnpj) + ".");
  L.push("Assembleia de " + dataBR(P.meta.assembleia) + ".");
  L.push("");
  L.push("Encerrada a deliberação sobre a relação de unidades participantes e de vagas");
  L.push("sorteáveis, procedeu-se ao sorteio por processo publicamente verificável, na");
  L.push("forma anunciada na convocação. O conjunto de dados foi congelado na presença");
  L.push("dos condôminos e seu resumo criptográfico foi lido em voz alta antes de");
  L.push("colhida a fonte externa de aleatoriedade. Registram-se os elementos que");
  L.push("permitem a qualquer condômino refazer o cálculo:");
  L.push("");
  L.push("- Protocolo: " + r.protocolo);
  L.push("- Compromisso (SHA-256 do conjunto de dados congelado): " + r.commit);
  L.push("- Congelamento do cadastro: " + dataBRSeg(P.ciclo.congeladoEm) +
         ", antes de colhida a aleatoriedade");
  L.push("- Fonte de aleatoriedade: " + nomeFonte(r.fonte) + " — " + r.beaconDeclarado);
  if (r.fonte === "DRAND_QUICKNET") {
    L.push("- Rodada: " + P.ciclo.rodada + ", publicada em " +
           dataBRSeg(new Date(GJ.instanteDaRodada(P.ciclo.rodada)).toISOString()));
    L.push("- Aleatoriedade da rodada: " + P.ciclo.aleatorio);
    L.push("- Endereço de conferência: " + GJ.urlDaRodada(P.ciclo.rodada));
  } else {
    L.push("- Prêmios da extração: " + (P.ciclo.premios || []).join(", "));
  }
  L.push("- Beacon normalizado: " + r.beacon);
  L.push("- Semente derivada: " + r.semente);
  L.push("- Política de atribuição: " + r.politica);
  L.push("- Divisão do sorteio: " + (r.agrupamento && r.agrupamento !== "NENHUM"
    ? "por " + r.agrupamento + ", grupos " + (r.grupos || []).join(" e ")
    : "nenhuma, todas as unidades concorreram a todas as vagas"));
  L.push("- Hash do resultado: " + r.resultadoHash);
  L.push("- Hash final da cadeia de eventos: " + (P.log.length ? P.log[P.log.length - 1].hash : ""));
  L.push("- Verificador publicado em: __________ , SHA-256 __________");
  L.push("");
  if (r.preAtribuidas && r.preAtribuidas.length) {
    L.push("## Vagas já destinadas, que não foram sorteadas");
    L.push("");
    L.push("| Vaga | Unidade | Fundamento |");
    L.push("|---|---|---|");
    r.preAtribuidas.forEach(function (a) {
      L.push("| " + a.vaga + " | " + a.unidade + " | " + a.motivo + " |");
    });
    L.push("");
  }
  L.push("## Resultado do sorteio");
  L.push("");
  var temGrupo = r.grupos && r.grupos.length > 1;
  L.push(temGrupo ? "| Unidade | Grupo | Lote | Vaga |" : "| Unidade | Lote | Vaga |");
  L.push(temGrupo ? "|---|---|---|---|" : "|---|---|---|");
  r.atribuicoes.forEach(function (a) {
    L.push("| " + rotuloPedido(a.pedido, a.rotulo) + " | " +
      (temGrupo ? a.grupo + " | " : "") + a.lote + " | " + a.vagas.join(" + ") + " |");
  });
  if (r.semVaga.length) {
    L.push("");
    L.push("## Pedidos não contemplados");
    L.push("");
    r.semVaga.forEach(function (s) { L.push("- " + rotuloPedido(s.pedido, s.rotulo) + " — " + limpo(P.meta.sem_vaga)); });
  }
  L.push("");
  L.push("As vagas relacionadas como fora do sorteio, com o respectivo fundamento,");
  L.push("constaram da convocação e permanecem sob administração do condomínio.");
  return L.join("\n");
}

function resultadoCsv() {
  if (!(P.ciclo && P.ciclo.resultado)) return "";
  var r = P.ciclo.resultado;
  var L = ["pedido;unidade;grupo;lote;vaga;origem"];
  (r.preAtribuidas || []).forEach(function (a) {
    var u = P.unidades.filter(function (x) { return limpo(x.codigo) === a.unidade; })[0];
    L.push(["", u ? limpo(u.rotulo) : a.unidade, "", "", a.vaga, "atribuicao direta"]
      .map(csvEscape).join(";"));
  });
  r.atribuicoes.forEach(function (a) {
    L.push([a.pedido, a.rotulo, a.grupo, a.lote, a.vagas.join("+"), "sorteio"]
      .map(csvEscape).join(";"));
  });
  r.semVaga.forEach(function (s) {
    L.push([s.pedido, s.rotulo, s.grupo, "", "SEM_VAGA", limpo(P.meta.sem_vaga)]
      .map(csvEscape).join(";"));
  });
  return L.join("\n");
}

/* ---------- importação ---------- */
/**
 * Importação. O padrão é ACRESCENTAR: o condomínio cria vaga nova no meio do
 * ciclo, o síndico manda mais uma lista, e nada do que já está conferido se
 * perde. Substituir é ato separado e confirmado.
 */
function importarUnidades(texto, substituir) {
  var linhas = csvParse(texto);
  var novas = linhas.map(function (l) {
    return {
      codigo: l.codigo || l.unidade || l.apto || "",
      rotulo: l.rotulo || l.nome || l.descricao || (l.codigo ? "APTO " + l.codigo : ""),
      tickets: Number(l.pedidos || l.tickets || l.vagas || 1) || 1,
      porte: (l.porte || "M").toUpperCase().slice(0, 1),
      prioridade: /^(s|sim|1|true|x)$/i.test(l.prioridade || ""),
      docOk: /^(s|sim|1|true|x)$/i.test(l.documento || l.doc || ""),
      grupo: l.grupo || "",
    };
  }).filter(function (u) { return u.codigo; });
  if (!novas.length) { aviso("Nenhuma linha aproveitável no CSV."); return; }

  if (substituir) {
    P.unidades = novas;
    salvarLocal(); filtroU = ""; renderTudo();
    aviso(novas.length + " unidades importadas, substituindo o cadastro anterior.");
    return;
  }

  var existentes = {};
  P.unidades.forEach(function (u) { existentes[limpo(u.codigo)] = true; });
  var add = novas.filter(function (u) { return !existentes[limpo(u.codigo)]; });
  P.unidades = P.unidades.concat(add);
  salvarLocal(); filtroU = ""; renderTudo();
  aviso(add.length + " unidades acrescentadas" +
    (novas.length - add.length ? ", " + (novas.length - add.length) + " ignoradas por código já cadastrado" : "") + ".");
}

function importarVagas(texto, substituir) {
  var linhas = csvParse(texto);
  var novas = linhas.map(function (l) {
    var classif = (l.classificacao || l.dominio || "AREA_COMUM").toUpperCase().replace(/[^A-Z_]/g, "");
    if (CLASSIF.map(function (c) { return c[0]; }).indexOf(classif) === -1) classif = "AREA_COMUM";
    var fora = /^(s|sim|1|true|x)$/i.test(l.fora_do_pool || l.fora || "");
    // Uma coluna por família cadastrada, pelo nome dela sem acento e em
    // minúsculas: a família Cobertura lê a coluna "cobertura".
    var etq = {};
    familias().forEach(function (f) {
      var nome = limpo(f.nome);
      if (!nome) return;
      var chave = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      var bruto = limpo(l[chave] || "");
      if (!bruto) return;
      // aceita o valor escrito de qualquer jeito, casando sem acento e sem caixa
      var achado = valoresDa(nome).filter(function (v) {
        return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
               bruto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      })[0];
      etq[nome] = achado || bruto;
    });
    return {
      codigo: l.codigo || l.vaga || "",
      porte: (l.porte || "M").toUpperCase().slice(0, 1),
      classificacao: classif,
      lote: l.lote || "",
      etq: etq,
      grupo: l.grupo || l.concorre_em || "",
      foraPool: fora || CLASSIF_BLOQUEADA.indexOf(classif) !== -1,
      motivo: l.motivo || "",
    };
  }).filter(function (v) { return v.codigo; });
  if (!novas.length) { aviso("Nenhuma linha aproveitável no CSV."); return; }

  if (substituir) {
    P.vagas = novas;
    P.lotesCfg = {};
    salvarLocal(); filtroV = ""; renderTudo();
    aviso(novas.length + " vagas importadas, substituindo o cadastro anterior.");
    return;
  }

  var existentes = {};
  P.vagas.forEach(function (v) { existentes[limpo(v.codigo)] = true; });
  var add = novas.filter(function (v) { return !existentes[limpo(v.codigo)]; });
  P.vagas = P.vagas.concat(add);
  salvarLocal(); filtroV = ""; renderTudo();
  aviso(add.length + " vagas acrescentadas" +
    (novas.length - add.length ? ", " + (novas.length - add.length) + " ignoradas por código já cadastrado" : "") + ".");
}

/** O modelo de CSV acompanha as famílias cadastradas: uma coluna para cada. */
function modeloUnidades() {
  var temGrupo = !!agrupamento();
  var cab = ["codigo", "rotulo", "pedidos", "porte", "prioridade", "documento"];
  if (temGrupo) cab.push("grupo");
  var g1 = temGrupo ? valoresDa(agrupamento())[0] || "" : null;
  var g2 = temGrupo ? valoresDa(agrupamento())[1] || g1 : null;
  function linha(cols, grupo) { return temGrupo ? cols.concat([grupo]).join(";") : cols.join(";"); }
  return [
    cab.join(";"),
    linha(["11", "APTO 11", "1", "M", "", ""], g1),
    linha(["12", "APTO 12", "1", "P", "", ""], g1),
    linha(["13", "APTO 13", "2", "M", "", ""], g2),
    linha(["14", "APTO 14", "1", "G", "sim", "sim"], g2),
  ].join("\n");
}

function modeloVagas() {
  var nomes = familias().map(function (f) { return limpo(f.nome); }).filter(Boolean);
  var chaves = nomes.map(function (n) {
    return n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  });
  var temGrupo = !!agrupamento();
  var cab = ["codigo", "porte", "classificacao"].concat(chaves)
    .concat(temGrupo ? ["grupo"] : []).concat(["lote", "fora_do_pool", "motivo"]);
  function linha(codigo, porte, classif, lote, fora, motivo, i) {
    var meio = nomes.map(function (n) {
      var vs = valoresDa(n);
      return vs.length ? vs[i % vs.length] : "";
    });
    return [codigo, porte, classif].concat(meio).concat(temGrupo ? [""] : [])
      .concat([lote, fora, motivo]).join(";");
  }
  return [
    cab.join(";"),
    linha("G1-01", "M", "AREA_COMUM", "", "", "", 0),
    linha("G1-02", "P", "AREA_COMUM", "", "", "", 0),
    linha("G1-06", "G", "AREA_COMUM", "L06", "", "", 0),
    linha("G1-07", "G", "AREA_COMUM", "L06", "", "", 0),
    linha("G2-01", "M", "AREA_COMUM", "", "", "", 1),
    linha("G1-15", "M", "AREA_COMUM", "", "sim", "Vaga acessivel, Decreto 9.451/2018 art. 8 par. 3", 0),
    linha("G1-20", "M", "UNIDADE_AUTONOMA", "", "sim", "Matricula propria no RI", 0),
  ].join("\n");
}

/* ====================================================================== */
/* Exemplo                                                                 */
/* ====================================================================== */

function carregarExemplo() {
  if (P.unidades.length || P.vagas.length) {
    if (!confirm("Isso substitui o projeto atual. Continuar?")) return;
  }
  P = projetoNovo();
  filtroU = ""; filtroV = "";
  P.meta.condominio = "Condominio Residencial Unicco";
  P.meta.cnpj = "00.000.000/0001-00";
  P.meta.assembleia = "2026-10-14T19:30";
  P.meta.fonte = "LOTERIA_FEDERAL";
  P.meta.beacon = "LOTERIA_FEDERAL|concurso 6107|2026-10-14";
  P.meta.beacon_fallback = "LOTERIA_FEDERAL|concurso 6108|2026-10-17";
  P.meta.antecedencia = 10;
  P.meta.agrupamento = "Cobertura";
  P.meta.regras = "Sorteio de vagas de garagem em area comum, ciclo anual. Cada unidade concorre dentro do seu grupo de cobertura, na forma da convencao. Vagas acessiveis ficam sob administracao do condominio e fora do pool. Unidade com direito a duas vagas concorre com dois pedidos.";

  P.familias = [
    { nome: "Cobertura", valores: "Coberta, Descoberta" },
    { nome: "Nivel", valores: "Subsolo, Patio" },
  ];

  // codigo, rotulo, pedidos, porte, grupo
  [["11", 1, "M", "Coberta"], ["12", 1, "P", "Coberta"], ["13", 2, "M", "Coberta"],
   ["14", 1, "G", "Coberta"], ["21", 1, "M", "Coberta"], ["22", 1, "M", "Coberta"],
   ["23", 1, "P", "Coberta"], ["24", 2, "M", "Coberta"],
   ["31", 1, "G", "Descoberta"], ["32", 1, "M", "Descoberta"], ["33", 1, "M", "Descoberta"],
   ["34", 1, "P", "Descoberta"], ["41", 1, "M", "Descoberta"], ["42", 2, "G", "Descoberta"],
   ["43", 1, "M", "Descoberta"], ["44", 1, "M", "Descoberta"]
  ].forEach(function (u) {
    P.unidades.push({ codigo: u[0], rotulo: "APTO " + u[0], tickets: u[1], porte: u[2],
                      grupo: u[3], prioridade: false, docOk: false });
  });

  // codigo, porte, lote, cobertura
  [["G1-01", "M", ""], ["G1-02", "M", ""], ["G1-03", "G", ""], ["G1-04", "P", ""],
   ["G1-05", "M", ""], ["G1-06", "G", "L06"], ["G1-07", "G", "L06"], ["G1-08", "M", ""],
   ["G1-09", "M", ""], ["G1-10", "P", ""]
  ].forEach(function (v) {
    P.vagas.push({ codigo: v[0], porte: v[1], classificacao: "AREA_COMUM", lote: v[2],
                   etq: { Cobertura: "Coberta", Nivel: "Subsolo" }, foraPool: false, motivo: "" });
  });
  [["G2-01", "G", ""], ["G2-02", "G", ""], ["G2-03", "M", "L12"], ["G2-04", "M", "L12"],
   ["G2-05", "M", ""], ["G2-06", "P", ""], ["G2-07", "M", ""], ["G2-08", "M", ""],
   ["G2-09", "M", ""]
  ].forEach(function (v) {
    P.vagas.push({ codigo: v[0], porte: v[1], classificacao: "AREA_COMUM", lote: v[2],
                   etq: { Cobertura: "Descoberta", Nivel: "Patio" }, foraPool: false, motivo: "" });
  });
  // duas vagas acessiveis, sob administracao do condominio
  P.vagas.push({ codigo: "G1-11", porte: "M", classificacao: "AREA_COMUM", lote: "",
                 etq: { Cobertura: "Coberta", Nivel: "Subsolo" }, foraPool: true,
                 motivo: "Vaga acessivel, Decreto 9.451/2018 art. 8 par. 3, sob administracao do condominio" });
  P.vagas.push({ codigo: "G1-12", porte: "M", classificacao: "AREA_COMUM", lote: "",
                 etq: { Cobertura: "Coberta", Nivel: "Subsolo" }, foraPool: true,
                 motivo: "Vaga acessivel adicional aprovada em AGE, ata de 12/09/2026" });

  P.diretas = [{
    unidade: "42", vaga: "G2-09",
    motivo: "Vaga contigua a rampa destinada a unidade 42 por laudo medico apresentado, deliberado em AGE de 12/09/2026",
  }];

  salvarLocal();
  aviso("Exemplo carregado. Confira a aba 6 e abra o sorteio para testar o ciclo inteiro.");
}

/* ====================================================================== */
/* Ligação da interface                                                    */
/* ====================================================================== */

function ligar() {
  document.querySelectorAll("nav.abas button").forEach(function (b) {
    b.addEventListener("click", function () { trocarAba(b.getAttribute("data-aba")); });
  });

  document.querySelectorAll("[data-meta]").forEach(function (n) {
    n.addEventListener("input", function () {
      P.meta[n.getAttribute("data-meta")] = n.value;
      salvarLocal();
      atualizarSelos();
    });
  });

  $("btn-novo").addEventListener("click", function () {
    if (!confirm("Começar um projeto novo e descartar o atual?")) return;
    P = projetoNovo(); salvarLocal(); renderTudo(); trocarAba("condominio");
  });

  $("btn-exemplo").addEventListener("click", function () { carregarExemplo(); renderTudo(); });

  $("btn-salvar").addEventListener("click", function () {
    baixar(nomeBase() + "-garagem-justa.json", JSON.stringify(P, null, 2), "application/json");
  });

  $("btn-abrir").addEventListener("click", function () { $("arquivo-projeto").click(); });
  $("arquivo-projeto").addEventListener("change", function (e) {
    var f = e.target.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var p = JSON.parse(fr.result);
        if (!p.meta) throw new Error("arquivo não é um projeto do Garagem Justa");
        var tinhaCiclo = !!p.ciclo;
        P = normalizarProjeto(p); salvarLocal(); renderTudo();
        aviso(tinhaCiclo && !P.ciclo
          ? "Projeto carregado. O ciclo congelado era de versão anterior do protocolo e foi descartado."
          : "Projeto carregado.");
      } catch (err) { aviso("Não consegui abrir: " + err.message); }
    };
    fr.readAsText(f, "utf-8");
    e.target.value = "";
  });

  // Linha nova entra no fim da lista, então o filtro sai para ela aparecer.
  $("u-add").addEventListener("click", function () {
    P.unidades.push({ codigo: "", rotulo: "", tickets: 1, porte: "M",
                      grupo: "", prioridade: false, docOk: false });
    filtroU = ""; $("u-filtro").value = "";
    salvarLocal(); renderUnidades(); atualizarSelos();
  });
  $("v-add").addEventListener("click", function () {
    P.vagas.push({ codigo: "", porte: "M", classificacao: "AREA_COMUM",
                   lote: "", etq: {}, grupo: "", foraPool: false, motivo: "" });
    filtroV = ""; $("v-filtro").value = "";
    salvarLocal(); renderVagas(); renderLotes(); atualizarSelos();
  });

  // Qual arquivo alimenta qual função vem do próprio input; o clique só diz se
  // aquela importação substitui ou acrescenta. Acrescentar é o padrão.
  var DESTINO = { "u-arquivo": importarUnidades, "v-arquivo": importarVagas };
  var substituirCsv = false;
  function pedirCsv(input, substituir) {
    substituirCsv = !!substituir;
    $(input).click();
  }
  $("u-importar").addEventListener("click", function () { pedirCsv("u-arquivo", false); });
  $("v-importar").addEventListener("click", function () { pedirCsv("v-arquivo", false); });
  $("u-substituir").addEventListener("click", function () {
    if (P.unidades.length && !confirm("Substituir apaga as " + P.unidades.length +
      " unidades já cadastradas e põe o arquivo no lugar.\n\nPara só acrescentar as que faltam, " +
      "use “importar CSV”.\n\nConfirma a substituição?")) return;
    pedirCsv("u-arquivo", true);
  });
  $("v-substituir").addEventListener("click", function () {
    if (P.vagas.length && !confirm("Substituir apaga as " + P.vagas.length +
      " vagas já cadastradas e põe o arquivo no lugar.\n\nPara só acrescentar as que faltam, " +
      "use “importar CSV”.\n\nConfirma a substituição?")) return;
    pedirCsv("v-arquivo", true);
  });
  $("u-arquivo").addEventListener("change", lerCsv);
  $("v-arquivo").addEventListener("change", lerCsv);
  function lerCsv(e) {
    var f = e.target.files[0];
    var fn = DESTINO[e.target.id];
    var substituir = substituirCsv;
    substituirCsv = false;
    e.target.value = "";
    if (!f || !fn) return;
    var fr = new FileReader();
    fr.onload = function () { fn(fr.result, substituir); };
    fr.readAsText(f, "utf-8");
  }

  $("u-filtro").addEventListener("input", function () {
    filtroU = this.value; renderUnidades();
  });
  $("v-filtro").addEventListener("input", function () {
    filtroV = this.value; renderVagas();
  });

  $("u-modelo").addEventListener("click", function () { baixar("modelo-unidades.csv", modeloUnidades(), "text/csv"); });
  $("v-modelo").addEventListener("click", function () { baixar("modelo-vagas.csv", modeloVagas(), "text/csv"); });

  $("f-add").addEventListener("click", function () {
    familias().push({ nome: "", valores: "" });
    salvarLocal(); renderFamilias(); renderVagas(); renderMeta();
  });
  $("f-sugerir").addEventListener("click", function () {
    [["Cobertura", "Coberta, Descoberta"], ["Nivel", "Subsolo, Terreo"]].forEach(function (f) {
      if (!familias().some(function (x) { return limpo(x.nome) === f[0]; })) {
        familias().push({ nome: f[0], valores: f[1] });
      }
    });
    salvarLocal(); renderTudo();
    aviso("Famílias sugeridas cadastradas. Ajuste os valores como o condomínio usa.");
  });
  $("a-add").addEventListener("click", function () {
    diretas().push({ unidade: "", vaga: "", motivo: "" });
    salvarLocal(); renderDiretas(); atualizarSelos();
  });

  $("c-congelar").addEventListener("click", congelar);
  $("c-descongelar").addEventListener("click", descongelar);
  $("c-anular").addEventListener("click", anularCiclo);
  $("m-fonte").addEventListener("change", function () { renderMeta(); renderConferencia(); });
  $("dr-buscar").addEventListener("click", buscarDrand);
  function copiarDe(id) {
    return function () {
      var t = $(id);
      t.select();
      navigator.clipboard.writeText(t.value).then(
        function () { aviso("Bloco copiado."); },
        function () { document.execCommand("copy"); aviso("Bloco copiado."); }
      );
    };
  }
  $("c-copiar-edital").addEventListener("click", copiarDe("c-edital"));
  $("c-copiar-abertura").addEventListener("click", copiarDe("c-abertura"));
  $("c-baixar-payload").addEventListener("click", function () {
    baixar(nomeBase() + "-payload.txt", P.ciclo.payload);
  });

  $("s-rodar").addEventListener("click", rodarSorteio);
  $("s-apresentar").addEventListener("click", abrirApresentacao);

  $("ap-proximo").addEventListener("click", revelarProxima);
  $("ap-todas").addEventListener("click", function () {
    var total = itensApresentacao().length;
    while (apIdx < total) revelarProxima();
  });
  $("ap-fechar").addEventListener("click", function () { $("apresentacao").classList.remove("on"); });
  document.addEventListener("keydown", function (e) {
    if (!$("apresentacao").classList.contains("on")) return;
    if (e.key === "Escape") $("apresentacao").classList.remove("on");
    if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); revelarProxima(); }
  });

  $("d-payload").addEventListener("click", function () {
    if (!congelado()) return aviso("Congele o ciclo primeiro.");
    baixar(nomeBase() + "-payload.txt", P.ciclo.payload);
  });
  $("d-resultado").addEventListener("click", function () {
    if (!(P.ciclo && P.ciclo.resultado)) return aviso("Faça a apuração primeiro.");
    baixar(nomeBase() + "-resultado.txt", P.ciclo.resultado.resultadoTexto);
  });
  $("d-ata").addEventListener("click", function () {
    if (!(P.ciclo && P.ciclo.resultado)) return aviso("Faça a apuração primeiro.");
    baixar(nomeBase() + "-trecho-da-ata.md", trechoAta(), "text/markdown");
  });
  $("d-planilha").addEventListener("click", function () {
    if (!(P.ciclo && P.ciclo.resultado)) return aviso("Faça a apuração primeiro.");
    baixar(nomeBase() + "-resultado.csv", resultadoCsv(), "text/csv");
  });
  $("d-cadeia").addEventListener("click", function () {
    baixar(nomeBase() + "-cadeia-de-eventos.txt", cadeiaTexto());
  });
  $("d-tudo").addEventListener("click", function () {
    baixar(nomeBase() + "-garagem-justa.json", JSON.stringify(P, null, 2), "application/json");
  });
}

/* ====================================================================== */
/* Início                                                                  */
/* ====================================================================== */

if (typeof GJ === "undefined") {
  document.body.innerHTML =
    '<div style="padding:40px;font:15px system-ui"><h2>Motor não carregado</h2>' +
    '<p>O arquivo <code>core/sorteio.browser.js</code> não foi encontrado. ' +
    'Mantenha a estrutura de pastas do projeto: a aplicação está em <code>app/</code> ' +
    'e o motor em <code>core/</code>, lado a lado.</p></div>';
} else {
  ligar();
  carregarLocal();
  renderTudo();
}

})();
