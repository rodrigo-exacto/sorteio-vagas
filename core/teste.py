"""
Confere a implementação Python contra os vetores gerados pela implementação
JavaScript. Se as duas discordam em um único byte, o teste falha.

    python3 teste.py
"""

import hashlib
import json
import pathlib
import sys

import sorteio as S

BASE = pathlib.Path(__file__).parent
vet = json.loads((BASE / "vetores.json").read_text(encoding="utf-8"))

falhas = []


def confere(nome, obtido, esperado):
    if obtido == esperado:
        print(f"  ok    {nome}")
    else:
        print(f"  FALHA {nome}\n        obtido:   {obtido!r}\n        esperado: {esperado!r}")
        falhas.append(nome)


print("\n1. Normalização da Loteria Federal")
confere(
    "cinco premios, zero a esquerda removido",
    S.normalizar_loteria_federal(vet["loteria_federal"]["entrada_api_caixa"]),
    vet["loteria_federal"]["saida"],
)

print("\n2. Fluxo do PRNG")
semente = bytes.fromhex(vet["prng"]["semente"])
prng = S.Prng(semente)
confere("primeiros 16 bytes", prng.proximos(16).hex(), vet["prng"]["primeiros_16_bytes"])
confere("proximos 48 bytes", prng.proximos(48).hex(), vet["prng"]["proximos_48_bytes"])

print("\n3. Inteiro uniforme sem viés")
prng = S.Prng(bytes.fromhex(vet["uniforme"]["semente"]))
for item in vet["uniforme"]["sequencia"]:
    confere(f"uniforme(n={item['n']})", S.uniforme(prng, item["n"]), item["valor"])

print("\n4. Fisher-Yates")
prng = S.Prng(bytes.fromhex(vet["embaralhar"]["semente"]))
confere(
    "permutacao de 8 elementos",
    S.embaralhar(vet["embaralhar"]["entrada"], prng),
    vet["embaralhar"]["saida"],
)

print("\n5. Sorteio completo do exemplo Unicco")
payload = (BASE / vet["exemplo_unicco"]["arquivo"]).read_text(encoding="utf-8")
beacon = vet["exemplo_unicco"]["beacon"]

confere("commit", S.commit(payload).hex(), vet["exemplo_unicco"]["commit"])
confere(
    "semente derivada",
    S.derivar_semente(S.commit(payload), beacon).hex(),
    vet["exemplo_unicco"]["semente"],
)

r = S.sortear(payload, beacon)
confere("hash do resultado", r["resultado_hash"], vet["exemplo_unicco"]["resultado_hash"])
confere("ordem sorteada", r["ordem_sorteada"], vet["exemplo_unicco"]["ordem_sorteada"])
confere(
    "atribuicoes",
    [f"{a['pedido']} -> {a['grupo']}/{a['lote']} ({'+'.join(a['vagas'])})" for a in r["atribuicoes"]],
    vet["exemplo_unicco"]["atribuicoes"],
)
confere("sem vaga", [s["pedido"] for s in r["sem_vaga"]], vet["exemplo_unicco"]["sem_vaga"])

print("\n5b. Sorteio por grupo")
confere("grupos apurados", r["grupos"], vet["exemplo_unicco"]["grupos"])
confere("agrupamento declarado", r["agrupamento"], vet["exemplo_unicco"]["agrupamento"])
confere("vagas ja destinadas fora do sorteio",
        [f"{a['vaga']} -> {a['unidade']}" for a in r["pre_atribuidas"]],
        vet["exemplo_unicco"]["pre_atribuidas"])
por_grupo = {}
for a in r["atribuicoes"]:
    por_grupo.setdefault(a["grupo"], []).extend(a["vagas"])
confere("nenhuma unidade recebeu vaga de outro grupo",
        {g: sorted(v) for g, v in sorted(por_grupo.items())},
        {g: sorted(v) for g, v in vet["grupos"]["vagas_por_grupo"].items()})
spec_g = S.parse_payload(payload)
lote_do_grupo = {}
for l in spec_g["lotes"]:
    for v in l["vagas"]:
        lote_do_grupo[v] = l["grupo"]
confere("toda vaga atribuida pertence ao grupo do contemplado",
        all(lote_do_grupo[v] == a["grupo"] for a in r["atribuicoes"] for v in a["vagas"]),
        True)
pre_vagas = {a["vaga"] for a in r["pre_atribuidas"]}
confere("vaga ja destinada nao foi sorteada",
        bool(pre_vagas & {v for a in r["atribuicoes"] for v in a["vagas"]}), False)

u = S.sortear(
    payload.replace("grupo=Coberta", "grupo=" + S.GRUPO_UNICO)
           .replace("grupo=Descoberta", "grupo=" + S.GRUPO_UNICO)
           .replace("agrupamento=Cobertura", "agrupamento=NENHUM"),
    beacon,
)
confere("grupo unico: grupos", u["grupos"], vet["grupos"]["grupo_unico"]["grupos"])
confere("grupo unico: commit", u["commit"], vet["grupos"]["grupo_unico"]["commit"])
confere("grupo unico: hash", u["resultado_hash"], vet["grupos"]["grupo_unico"]["resultado_hash"])
confere("grupo unico produz resultado diferente",
        u["resultado_hash"] != r["resultado_hash"], True)

print("\n6. Política alternativa de casamento")
pe = S.sortear(payload.replace("politica_casamento=MENOR_ADEQUADO",
                               "politica_casamento=PRIMEIRO_ELEGIVEL"), beacon)
confere("PRIMEIRO_ELEGIVEL: hash", pe["resultado_hash"],
        vet["politica_primeiro_elegivel"]["resultado_hash"])
confere("PRIMEIRO_ELEGIVEL: sem vaga", [s["pedido"] for s in pe["sem_vaga"]],
        vet["politica_primeiro_elegivel"]["sem_vaga"])

print("\n7. Sensibilidade ao beacon")
alt = S.sortear(payload, vet["sensibilidade"]["beacon_alterado"])
confere("commit permanece igual", alt["commit"] == r["commit"], True)
confere("semente muda", alt["semente"] != r["semente"], True)
confere(
    "resultado muda",
    alt["resultado_hash"],
    vet["sensibilidade"]["resultado_hash_alterado"],
)

print("\n7b. Drand quicknet: aritmética de rodadas e forma canônica")
import datetime as _dt
for item in vet["drand"]["rodada_em"]:
    confere(
        f"rodada em {item['iso']}",
        S.rodada_drand_em(_dt.datetime.fromisoformat(item["iso"]).timestamp()),
        item["rodada"],
    )
for item in vet["drand"]["instante_da_rodada"]:
    confere(f"instante da rodada {item['rodada']}",
            S.instante_da_rodada(item["rodada"]), item["epoch_s"])
confere("url da rodada", S.url_da_rodada(33071752), vet["drand"]["url"])
confere("valor normalizado", S.normalizar_drand("33071752",
        "8D3C2B1A0F9E8D7C6B5A49382716059483726150AF9E8D7C6B5A493827160594"),
        vet["drand"]["normalizado"])

print("\n7c. Sorteio completo pela fonte drand")
payload_drand = (BASE / vet["exemplo_drand"]["arquivo"]).read_text(encoding="utf-8")
d = S.sortear(payload_drand, vet["exemplo_drand"]["beacon"])
confere("fonte reconhecida", d["fonte"], vet["exemplo_drand"]["fonte"])
confere("commit", d["commit"], vet["exemplo_drand"]["commit"])
confere("semente derivada", d["semente"], vet["exemplo_drand"]["semente"])
confere("hash do resultado", d["resultado_hash"], vet["exemplo_drand"]["resultado_hash"])
confere("ordem sorteada", d["ordem_sorteada"], vet["exemplo_drand"]["ordem_sorteada"])
confere(
    "atribuicoes",
    [f"{a['pedido']} -> {a['grupo']}/{a['lote']} ({'+'.join(a['vagas'])})" for a in d["atribuicoes"]],
    vet["exemplo_drand"]["atribuicoes"],
)
confere("resultado difere do apurado pela Federal",
        d["resultado_hash"] != r["resultado_hash"], True)

print("\n7d. Recusa de beacon que não corresponde ao compromisso")
confere("fonte do beacon federal", S.fonte_do_beacon("LOTERIA_FEDERAL|concurso 6107|2026-10-14"),
        vet["beacon_aceito"]["fonte_federal"])
for caso in vet["beacon_recusado"]:
    try:
        S.validar_beacon(caso["declaracao"], caso["valor"], caso["congelado_em"])
        print(f"  FALHA {caso['nome']}: deveria ter sido recusado")
        falhas.append(caso["nome"])
    except ValueError:
        print(f"  ok    recusa: {caso['nome']}")

print("\n8. Recusa de payload não canônico")
for nome, mutacao in [
    ("linha em branco", lambda t: t.replace("[LOTES]", "\n[LOTES]")),
    ("espaco no fim da linha", lambda t: t.replace("[LOTES]", "[LOTES] ")),
    ("ordem trocada", lambda t: t.replace(
        "11;APTO 11;tickets=1;porte=M;grupo=Coberta\n12;APTO 12;tickets=1;porte=P;grupo=Coberta",
        "12;APTO 12;tickets=1;porte=P;grupo=Coberta\n11;APTO 11;tickets=1;porte=M;grupo=Coberta")),
    ("porte invalido", lambda t: t.replace("porte=M;capacidade=1", "porte=X;capacidade=1", 1)),
    ("grupo vazio", lambda t: t.replace("grupo=Coberta", "grupo=", 1)),
    ("grupo com separador", lambda t: t.replace("grupo=Coberta", "grupo=Cob+erta", 1)),
    ("etiqueta sem valor", lambda t: t.replace("G1-01;Cobertura=Coberta", "G1-01;Cobertura", 1)),
    ("pre-atribuida sem motivo", lambda t: t.replace(
        "G2-09;42;Vaga contigua", "G2-09;42", 1)),
]:
    try:
        S.assert_canonico(mutacao(payload))
        print(f"  FALHA {nome}: deveria ter sido recusado")
        falhas.append(nome)
    except ValueError:
        print(f"  ok    recusa: {nome}")

print("\n9. Conservação: nenhuma vaga atribuída duas vezes")
todas = [v for a in r["atribuicoes"] for v in a["vagas"]]
confere("sem vaga duplicada", len(todas), len(set(todas)))
spec = S.parse_payload(payload)
pool = {v for l in spec["lotes"] for v in l["vagas"]}
fora = {f["vaga"] for f in spec["fora_do_pool"]}
confere("nenhuma vaga fora do pool foi sorteada", bool(set(todas) & fora), False)
confere("toda vaga atribuida pertence ao pool", set(todas) <= pool, True)
confere(
    "total de pedidos bate",
    len(r["atribuicoes"]) + len(r["sem_vaga"]),
    sum(d["tickets"] for d in spec["demandantes"]),
)
confere(
    "vaga destinada fora do sorteio nao esta em nenhum lote",
    bool({a["vaga"] for a in spec["pre_atribuidas"]} & pool),
    False,
)

print()
if falhas:
    print(f"{len(falhas)} FALHA(S): {falhas}")
    sys.exit(1)
print("Todos os vetores conferem. JavaScript e Python produzem o mesmo resultado.")
