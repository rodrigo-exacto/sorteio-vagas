"""
Garagem Justa - motor de sorteio determinístico e verificável
Versão do protocolo: garagem-justa/v1

Sem dependências além da biblioteca padrão.
Produz resultados byte a byte idênticos aos da implementação em JavaScript
(sorteio.mjs). Os vetores em vetores.json travam esse acordo.

Duas implementações independentes que concordam convencem muito mais que uma.
"""

import datetime
import hashlib
import hmac
import json
import math
import re
import unicodedata

PROTO = "garagem-justa/v1"
CABECALHO = "GARAGEM-JUSTA/COMMIT/v1"

CAMPOS_ORDEM = [
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
]

PORTES = {"P": 1, "M": 2, "G": 3}

GRUPO_UNICO = "GERAL"


def _grupo_de(x) -> str:
    g = str(x.get("grupo") or "").strip()
    return GRUPO_UNICO if g == "" else g


# ---------------------------------------------------------------------------
# 1. Primitivas
# ---------------------------------------------------------------------------

def sha256(b: bytes) -> bytes:
    return hashlib.sha256(b).digest()


def hmac_sha256(key: bytes, msg: bytes) -> bytes:
    return hmac.new(key, msg, hashlib.sha256).digest()


def _chave_bytes(s: str) -> bytes:
    """Ordenação por bytes UTF-8. Nunca por locale."""
    return s.encode("utf-8")


# ---------------------------------------------------------------------------
# 2. Payload canônico
# ---------------------------------------------------------------------------

def serialize_payload(spec) -> str:
    linhas = [CABECALHO]

    for campo in CAMPOS_ORDEM:
        v = spec["meta"].get(campo)
        if v is None or v == "":
            raise ValueError(f"campo obrigatório ausente no payload: {campo}")
        v = str(v).strip()
        if "\n" in v:
            raise ValueError(f"campo {campo} não pode conter quebra de linha")
        linhas.append(f"{campo}={v}")

    linhas.append("[DEMANDANTES]")
    for d in sorted(spec["demandantes"], key=lambda x: _chave_bytes(x["codigo"])):
        linhas.append(
            f"{d['codigo']};{d['rotulo']};tickets={d['tickets']}"
            f";porte={d['porte']};grupo={_grupo_de(d)}"
        )

    linhas.append("[LOTES]")
    for l in sorted(spec["lotes"], key=lambda x: _chave_bytes(x["codigo"])):
        vagas = "+".join(l["vagas"])
        linhas.append(
            f"{l['codigo']};{vagas};porte={l['porte']}"
            f";capacidade={l['capacidade']};grupo={_grupo_de(l)}"
        )

    linhas.append("[ETIQUETAS]")
    for e in sorted(spec.get("etiquetas", []), key=lambda x: _chave_bytes(x["vaga"])):
        pares = [f"{f}={e['valores'][f]}" for f in sorted(e["valores"], key=_chave_bytes)]
        if pares:
            linhas.append(e["vaga"] + ";" + ";".join(pares))

    linhas.append("[PRE_ATRIBUIDAS]")
    for a in sorted(spec.get("pre_atribuidas", []), key=lambda x: _chave_bytes(x["vaga"])):
        linhas.append(f"{a['vaga']};{a['unidade']};{a['motivo']}")

    linhas.append("[FORA_DO_POOL]")
    for f in sorted(spec.get("fora_do_pool", []), key=lambda x: _chave_bytes(x["vaga"])):
        linhas.append(f"{f['vaga']};{f['motivo']}")

    return unicodedata.normalize("NFC", "\n".join(linhas))


def normalizar_entrada(texto: str) -> str:
    """NFC, CRLF vira LF, quebras finais descartadas. Idêntico ao JS."""
    t = unicodedata.normalize("NFC", texto).replace("\r\n", "\n").replace("\r", "\n")
    return t.rstrip("\n")


def parse_payload(texto: str):
    t = normalizar_entrada(texto)
    linhas = t.split("\n")

    if linhas[0] != CABECALHO:
        raise ValueError(f"payload não começa com {CABECALHO}")

    meta = {}
    demandantes = []
    lotes = []
    etiquetas = []
    pre_atribuidas = []
    fora_do_pool = []
    secao = "META"

    for i, linha in enumerate(linhas[1:], start=2):
        if linha == "":
            raise ValueError(f"linha {i}: payload canônico não tem linha em branco")
        if linha != linha.strip():
            raise ValueError(f"linha {i}: espaço no início ou no fim não é permitido")

        if linha == "[DEMANDANTES]":
            secao = "DEMANDANTES"
            continue
        if linha == "[LOTES]":
            secao = "LOTES"
            continue
        if linha == "[ETIQUETAS]":
            secao = "ETIQUETAS"
            continue
        if linha == "[PRE_ATRIBUIDAS]":
            secao = "PRE_ATRIBUIDAS"
            continue
        if linha == "[FORA_DO_POOL]":
            secao = "FORA_DO_POOL"
            continue

        if secao == "META":
            if "=" not in linha or linha.index("=") < 1:
                raise ValueError(f"linha {i}: esperado campo=valor")
            k, _, v = linha.partition("=")
            meta[k] = v
        elif secao == "DEMANDANTES":
            partes = linha.split(";")
            codigo, rotulo, resto = partes[0], partes[1], partes[2:]
            kv = _kv(resto, i)
            demandantes.append({
                "codigo": codigo,
                "rotulo": rotulo,
                "tickets": _inteiro_positivo(kv.get("tickets"), "tickets", i),
                "porte": _porte(kv.get("porte"), i),
                "grupo": _nome_simples(kv.get("grupo"), "grupo", i),
            })
        elif secao == "LOTES":
            partes = linha.split(";")
            codigo, vagas, resto = partes[0], partes[1], partes[2:]
            kv = _kv(resto, i)
            lotes.append({
                "codigo": codigo,
                "vagas": vagas.split("+"),
                "porte": _porte(kv.get("porte"), i),
                "capacidade": _inteiro_positivo(kv.get("capacidade"), "capacidade", i),
                "grupo": _nome_simples(kv.get("grupo"), "grupo", i),
            })
        elif secao == "ETIQUETAS":
            partes = linha.split(";")
            if len(partes) < 2 or not partes[0]:
                raise ValueError(f"linha {i}: esperado vaga;familia=valor")
            etiquetas.append({"vaga": partes[0], "valores": _kv(partes[1:], i)})
        elif secao == "PRE_ATRIBUIDAS":
            partes = linha.split(";")
            if len(partes) < 3:
                raise ValueError(f"linha {i}: esperado vaga;unidade;motivo")
            pre_atribuidas.append({
                "vaga": partes[0],
                "unidade": partes[1],
                "motivo": ";".join(partes[2:]),
            })
        elif secao == "FORA_DO_POOL":
            if ";" not in linha or linha.index(";") < 1:
                raise ValueError(f"linha {i}: esperado vaga;motivo")
            vaga, _, motivo = linha.partition(";")
            fora_do_pool.append({"vaga": vaga, "motivo": motivo})

    for campo in CAMPOS_ORDEM:
        if campo not in meta:
            raise ValueError(f"campo obrigatório ausente: {campo}")

    return {
        "meta": meta,
        "demandantes": demandantes,
        "lotes": lotes,
        "etiquetas": etiquetas,
        "pre_atribuidas": pre_atribuidas,
        "fora_do_pool": fora_do_pool,
    }


def _kv(partes, linha_num):
    kv = {}
    for p in partes:
        if "=" not in p or p.index("=") < 1:
            raise ValueError(f'linha {linha_num}: esperado chave=valor em "{p}"')
        k, _, v = p.partition("=")
        kv[k] = v
    return kv


def _inteiro_positivo(v, nome, linha_num):
    if v is None or not re.fullmatch(r"[1-9][0-9]*", v):
        raise ValueError(f"linha {linha_num}: {nome} deve ser inteiro positivo")
    return int(v)


def _nome_simples(v, campo, linha_num):
    s = (v or "").strip()
    if s == "":
        raise ValueError(f"linha {linha_num}: {campo} não pode ser vazio")
    if re.search(r"[;=+\[\]]", s):
        raise ValueError(f"linha {linha_num}: {campo} não pode conter ; = + [ ]")
    return s


def _porte(v, linha_num):
    if v not in PORTES:
        raise ValueError(f"linha {linha_num}: porte deve ser P, M ou G")
    return v


def assert_canonico(texto: str):
    spec = parse_payload(texto)
    re_ser = serialize_payload(spec)
    if re_ser != normalizar_entrada(texto):
        raise ValueError(
            "payload não está na forma canônica (ordem, espaços ou normalização divergem)"
        )
    return spec


# ---------------------------------------------------------------------------
# 3. Compromisso e semente
# ---------------------------------------------------------------------------

def commit(payload_texto: str) -> bytes:
    return sha256(normalizar_entrada(payload_texto).encode("utf-8"))


def derivar_semente(commit_bytes: bytes, beacon_valor: str) -> bytes:
    return hmac_sha256(commit_bytes, f"{PROTO}/seed|{beacon_valor}".encode("utf-8"))


def normalizar_loteria_federal(premios) -> str:
    if len(premios) != 5:
        raise ValueError("a Loteria Federal tem 5 prêmios")
    saida = []
    for p in premios:
        s = re.sub(r"\D", "", str(p))
        if len(s) < 5:
            raise ValueError(f"prêmio inválido: {p}")
        saida.append(s[-5:])
    return "|".join(saida)


# ---------------------------------------------------------------------------
# 3b. Fontes de aleatoriedade. Ver sorteio.mjs para a descrição do formato.
# ---------------------------------------------------------------------------

DRAND_CADEIA = "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971"
DRAND_GENESIS = 1692803367
DRAND_PERIODO = 3

FONTES = ["LOTERIA_FEDERAL", "DRAND_QUICKNET"]


def rodada_drand_em(instante_s: float) -> int:
    t = int(instante_s)
    if t <= DRAND_GENESIS:
        return 1
    return (t - DRAND_GENESIS) // DRAND_PERIODO + 1


def instante_da_rodada(rodada: int) -> int:
    return DRAND_GENESIS + (int(rodada) - 1) * DRAND_PERIODO


def url_da_rodada(rodada: int) -> str:
    return f"https://api.drand.sh/v2/chains/{DRAND_CADEIA}/rounds/{int(rodada)}"


def normalizar_drand(rodada, aleatorio: str) -> str:
    r = str(rodada).strip()
    if not re.fullmatch(r"[1-9][0-9]*", r):
        raise ValueError(f"rodada inválida: {rodada}")
    h = str(aleatorio).strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", h):
        raise ValueError("a aleatoriedade do drand tem 64 caracteres hexadecimais")
    return f"{r}|{h}"


def fonte_do_beacon(declaracao: str) -> str:
    fonte = str(declaracao).split("|")[0]
    if fonte not in FONTES:
        raise ValueError(f"fonte de aleatoriedade desconhecida: {fonte}")
    return fonte


def rodada_declarada(declaracao: str) -> int:
    partes = str(declaracao).split("|")
    if len(partes) < 3 or partes[1] != DRAND_CADEIA:
        raise ValueError("a cadeia citada no beacon não é a quicknet do drand")
    if not re.fullmatch(r"[1-9][0-9]*", partes[2]):
        raise ValueError("o beacon do drand deve terminar com o número da rodada")
    return int(partes[2])


def validar_beacon(declaracao: str, valor: str, congelado_em: str) -> str:
    fonte = fonte_do_beacon(declaracao)

    if fonte == "LOTERIA_FEDERAL":
        if not re.fullmatch(r"[0-9]{5}(\|[0-9]{5}){4}", valor):
            raise ValueError(
                "valor da Loteria Federal fora do formato: cinco prêmios de cinco dígitos"
            )
        return fonte

    rodada = rodada_declarada(declaracao)
    if not re.fullmatch(r"[1-9][0-9]*\|[0-9a-f]{64}", valor):
        raise ValueError("valor do drand fora do formato: rodada|aleatoriedade")
    apurada = int(valor.split("|")[0])
    if apurada != rodada:
        raise ValueError(
            f"a rodada apurada ({apurada}) não é a rodada do compromisso ({rodada})"
        )
    try:
        t = datetime.datetime.fromisoformat(congelado_em).timestamp()
    except ValueError:
        raise ValueError(f"congelado_em não é uma data válida: {congelado_em}")
    if instante_da_rodada(rodada) <= t:
        raise ValueError(
            "a rodada citada já existia quando o ciclo foi congelado: "
            "o compromisso não antecede a aleatoriedade"
        )
    return fonte


# ---------------------------------------------------------------------------
# 4. PRNG determinístico
# ---------------------------------------------------------------------------

class Prng:
    def __init__(self, semente: bytes):
        self.semente = semente
        self.buffer = b""
        self.contador = 0

    def proximos(self, n: int) -> bytes:
        while len(self.buffer) < n:
            msg = f"{PROTO}/prng".encode("utf-8") + self.contador.to_bytes(4, "big")
            self.buffer += hmac_sha256(self.semente, msg)
            self.contador += 1
        saida, self.buffer = self.buffer[:n], self.buffer[n:]
        return saida


def uniforme(prng: Prng, n: int) -> int:
    if n < 1:
        raise ValueError("n deve ser >= 1")
    if n == 1:
        return 0
    bits = math.ceil(math.log2(n))
    nbytes = math.ceil(bits / 8)
    espaco = 1 << (8 * nbytes)
    limite = (espaco // n) * n
    while True:
        x = int.from_bytes(prng.proximos(nbytes), "big")
        if x < limite:
            return x % n


def embaralhar(lista, prng: Prng):
    a = list(lista)
    for i in range(len(a) - 1, 0, -1):
        j = uniforme(prng, i + 1)
        a[i], a[j] = a[j], a[i]
    return a


# ---------------------------------------------------------------------------
# 5. Sorteio
# ---------------------------------------------------------------------------

def serializar_resultado(atribuicoes, sem_vaga) -> str:
    linhas = ["GARAGEM-JUSTA/RESULTADO/v1"]
    for a in atribuicoes:
        linhas.append(f"{a['pedido']};{a['grupo']};{a['lote']};{'+'.join(a['vagas'])}")
    for s in sem_vaga:
        linhas.append(f"{s['pedido']};{s['grupo']};SEM_VAGA")
    return "\n".join(linhas)


def sortear(payload_texto: str, beacon_valor: str):
    spec = assert_canonico(payload_texto)
    fonte = validar_beacon(
        spec["meta"]["beacon"], beacon_valor, spec["meta"]["congelado_em"]
    )
    c = commit(payload_texto)
    semente = derivar_semente(c, beacon_valor)
    prng = Prng(semente)

    pedidos = []
    for d in spec["demandantes"]:
        for k in range(1, d["tickets"] + 1):
            pedidos.append({
                "id": f"{d['codigo']}#{k}",
                "codigo": d["codigo"],
                "rotulo": d["rotulo"],
                "porte": d["porte"],
                "grupo": _grupo_de(d),
            })
    pedidos.sort(key=lambda p: _chave_bytes(p["id"]))

    politica = spec["meta"]["politica_casamento"]
    if politica not in ("PRIMEIRO_ELEGIVEL", "MENOR_ADEQUADO"):
        raise ValueError(f"politica_casamento desconhecida: {politica}")

    # Cada grupo é um sorteio independente dentro do mesmo compromisso e da
    # mesma semente. Ordem dos grupos por bytes do nome. Ver sorteio.mjs.
    nomes = {p["grupo"] for p in pedidos} | {_grupo_de(l) for l in spec["lotes"]}
    grupos = sorted(nomes, key=_chave_bytes)

    atribuicoes = []
    sem_vaga = []
    ordem_sorteada = []

    for grupo in grupos:
        pedidos_g = [p for p in pedidos if p["grupo"] == grupo]
        lotes_g = [l for l in spec["lotes"] if _grupo_de(l) == grupo]

        perm_pedidos = embaralhar(pedidos_g, prng)
        perm_lotes = embaralhar(lotes_g, prng)
        ordem_sorteada.extend(p["id"] for p in perm_pedidos)

        restante = {l["codigo"]: l["capacidade"] for l in perm_lotes}

        for pedido in perm_pedidos:
            livres = [
                l for l in perm_lotes
                if restante[l["codigo"]] > 0
                and PORTES[l["porte"]] >= PORTES[pedido["porte"]]
            ]

            escolhido = None
            if livres:
                if politica == "PRIMEIRO_ELEGIVEL":
                    escolhido = livres[0]
                else:
                    escolhido = livres[0]
                    for l in livres[1:]:
                        if PORTES[l["porte"]] < PORTES[escolhido["porte"]]:
                            escolhido = l

            if escolhido is None:
                sem_vaga.append({
                    "pedido": pedido["id"],
                    "rotulo": pedido["rotulo"],
                    "porte": pedido["porte"],
                    "grupo": grupo,
                })
                continue

            # Qual vaga concreta o ocupante recebe dentro do lote. Ver sorteio.mjs.
            indice = escolhido["capacidade"] - restante[escolhido["codigo"]]
            if escolhido["capacidade"] == len(escolhido["vagas"]):
                vagas_do_ocupante = [escolhido["vagas"][indice]]
            else:
                vagas_do_ocupante = escolhido["vagas"]

            restante[escolhido["codigo"]] -= 1
            atribuicoes.append({
                "pedido": pedido["id"],
                "codigo": pedido["codigo"],
                "rotulo": pedido["rotulo"],
                "grupo": grupo,
                "lote": escolhido["codigo"],
                "vagas": vagas_do_ocupante,
            })

    apresentacao = sorted(atribuicoes, key=lambda a: _chave_bytes(a["pedido"]))
    resultado_texto = serializar_resultado(apresentacao, sem_vaga)

    return {
        "protocolo": PROTO,
        "commit": c.hex(),
        "fonte": fonte,
        "beacon_declarado": spec["meta"]["beacon"],
        "beacon": beacon_valor,
        "semente": semente.hex(),
        "modalidade": spec["meta"]["modalidade"],
        "agrupamento": spec["meta"]["agrupamento"],
        "grupos": grupos,
        "politica": politica,
        "ordem_sorteada": ordem_sorteada,
        "atribuicoes": apresentacao,
        "sem_vaga": sem_vaga,
        "pre_atribuidas": spec.get("pre_atribuidas", []),
        "resultado_texto": resultado_texto,
        "resultado_hash": sha256(resultado_texto.encode("utf-8")).hex(),
    }


if __name__ == "__main__":
    import sys
    payload = open(sys.argv[1], encoding="utf-8").read()
    beacon = sys.argv[2]
    print(json.dumps(sortear(payload, beacon), ensure_ascii=False, indent=2))
