#!/usr/bin/env python3
"""
Monta a pasta site/, pronta para subir no servidor de garagemjusta.com.br.

    python3 tools/gerar-site.py

O conteúdo de site/ é derivado: nada ali se edita à mão. A fonte é o app,
o verificador e os documentos em docs/.
"""
import hashlib
import pathlib
import re
import shutil

import markdown

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SITE = RAIZ / "site"

PALETA = """
:root{
  --ground:#edeee9; --panel:#fff; --ink:#16191c; --ink2:#3b4046; --muted:#636b71;
  --rule:#d7d9d2; --marca:#a8802f; --marca-ink:#7a5c1e; --ok:#2f6b4f;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){
  :root:not([data-tema="claro"]){
    --ground:#14161a; --panel:#1b1e23; --ink:#f0ede4; --ink2:#cfcbc0; --muted:#9aa0a6;
    --rule:#2c3036; --marca:#d8b45e; --marca-ink:#e6c87f; --ok:#7fbf9b;
  }
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.65 var(--sans);
  -webkit-font-smoothing:antialiased}
.faixa{height:6px;background:repeating-linear-gradient(115deg,var(--marca) 0 10px,transparent 10px 22px)}
.wrap{max-width:860px;margin:0 auto;padding:0 20px}
header.topo{background:var(--panel);border-bottom:1px solid var(--rule)}
header.topo .wrap{padding-block:16px;display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.marca{font-weight:700;font-size:19px;letter-spacing:-.01em}
.marca span{color:var(--muted);font-weight:400;font-size:12px;margin-left:9px;letter-spacing:.04em;
  font-family:var(--mono)}
nav.topo-links{margin-left:auto;display:flex;gap:16px;font-size:14px}
nav.topo-links a{color:var(--ink2);text-decoration:none;border-bottom:1px solid transparent}
nav.topo-links a:hover{color:var(--marca-ink);border-bottom-color:var(--marca)}
h1{font-size:clamp(28px,4.2vw,40px);line-height:1.15;letter-spacing:-.02em;margin:40px 0 14px}
h2{font-size:22px;letter-spacing:-.01em;margin:38px 0 10px}
h3{font-size:17px;margin:26px 0 8px}
p{margin:0 0 14px;color:var(--ink2)}
a{color:var(--marca-ink)}
.chamada{font-size:19px;line-height:1.55;color:var(--ink)}
.botoes{display:flex;gap:12px;flex-wrap:wrap;margin:26px 0 8px}
.b{display:inline-block;background:var(--ink);color:var(--ground);border-radius:5px;
  padding:12px 22px;font-weight:600;font-size:15px;text-decoration:none}
.b.sec{background:var(--panel);color:var(--ink);border:1px solid var(--rule)}
.cartao{background:var(--panel);border:1px solid var(--rule);border-radius:7px;padding:20px 22px;margin:18px 0}
.passos{counter-reset:p;list-style:none;padding:0;margin:18px 0}
.passos li{counter-increment:p;position:relative;padding:0 0 0 44px;margin:0 0 18px;color:var(--ink2)}
.passos li::before{content:counter(p);position:absolute;left:0;top:1px;width:28px;height:28px;
  border-radius:50%;border:1px solid var(--marca);color:var(--marca-ink);
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
.passos b{color:var(--ink)}
code,.mono{font-family:var(--mono);font-size:.9em}
.hash{font-family:var(--mono);font-size:12.5px;word-break:break-all;color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:14.5px;margin:14px 0}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--rule);vertical-align:top}
th{font:600 12px var(--sans);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
blockquote{margin:16px 0;padding:2px 0 2px 16px;border-left:3px solid var(--marca);color:var(--ink2)}
pre{background:var(--panel);border:1px solid var(--rule);border-radius:6px;padding:14px 16px;
  overflow-x:auto;font-family:var(--mono);font-size:13px;line-height:1.55}
pre code{font-size:inherit}
hr{border:0;border-top:1px solid var(--rule);margin:34px 0}
footer.rodape{border-top:1px solid var(--rule);margin-top:54px;background:var(--panel)}
footer.rodape .wrap{padding-block:22px;font-size:13.5px;color:var(--muted)}
@media (max-width:560px){ .botoes .b{width:100%;text-align:center} }

/* ---- cartões, grades e figuras da página inicial ---- */
.heroi{padding:52px 0 10px}
.heroi h1{margin:0 0 16px}
.grade{display:grid;gap:16px;margin:22px 0}
@media (min-width:720px){ .grade-3{grid-template-columns:repeat(3,1fr)} .grade-2{grid-template-columns:repeat(2,1fr)} }
.passo{background:var(--panel);border:1px solid var(--rule);border-radius:7px;padding:20px 20px 22px;
  display:flex;flex-direction:column;gap:10px}
.passo .n{width:30px;height:30px;border-radius:50%;border:1px solid var(--marca);color:var(--marca-ink);
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex:none}
.passo h3{margin:0;font-size:16.5px;letter-spacing:-.005em}
.passo p{margin:0;font-size:14.5px}
.precisa{background:var(--panel);border:1px solid var(--rule);border-radius:7px;padding:18px 20px}
.precisa h3{margin:0 0 6px;font-size:15.5px}
.precisa p{margin:0;font-size:14px;color:var(--muted)}
.precisa .tag{display:inline-block;font-family:var(--mono);font-size:11px;letter-spacing:.06em;
  text-transform:uppercase;color:var(--marca-ink);border:1px solid var(--rule);border-radius:3px;
  padding:2px 7px;margin-bottom:9px}
.figura{background:var(--panel);border:1px solid var(--rule);border-radius:7px;padding:18px 16px 10px;margin:26px 0}
.figura .rolagem{overflow-x:auto}
.figura svg{display:block;width:100%;min-width:620px;height:auto}
.figura figcaption{font-size:13.5px;color:var(--muted);padding:6px 6px 8px;margin:0}
.linha-tempo .trilho{stroke:var(--rule);stroke-width:2}
.linha-tempo .vao{fill:var(--marca);opacity:.07}
.linha-tempo .marco{fill:var(--panel);stroke:var(--marca);stroke-width:2}
.linha-tempo .rot{fill:var(--ink);font:600 14px var(--sans)}
.linha-tempo .sub{fill:var(--muted);font:12px var(--mono)}
.linha-tempo .chip{fill:var(--ground);stroke:var(--rule)}
.linha-tempo .glifo{fill:var(--marca-ink)}
.linha-tempo .pulso{fill:var(--marca);animation:correr 7s cubic-bezier(.65,0,.35,1) infinite}
.linha-tempo .pulsa{animation:pulsar 7s ease-in-out infinite}
@keyframes correr{
  0%,8%    {transform:translateX(0);opacity:0}
  14%      {transform:translateX(0);opacity:1}
  52%      {transform:translateX(380px);opacity:1}
  62%      {transform:translateX(380px);opacity:1}
  86%,100% {transform:translateX(590px);opacity:0}
}
@keyframes pulsar{0%,30%{opacity:.07} 48%{opacity:.17} 66%,100%{opacity:.07}}
@media (prefers-reduced-motion:reduce){
  .linha-tempo .pulso,.linha-tempo .pulsa{animation:none}
  .linha-tempo .pulso{opacity:0}
}
.aviso{background:var(--panel);border:1px solid var(--rule);border-left:3px solid var(--marca);
  border-radius:0 7px 7px 0;padding:16px 18px;margin:22px 0}
.aviso h3{margin:0 0 6px;font-size:15.5px}
.aviso p{margin:0;font-size:14.5px}

"""


def pagina(titulo, descricao, corpo, ativo=""):
    def link(href, texto, chave):
        marca = ' style="color:var(--marca-ink)"' if chave == ativo else ""
        return f'<a href="{href}"{marca}>{texto}</a>'

    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo}</title>
<meta name="description" content="{descricao}">
<style>{PALETA}</style>
</head>
<body>
<div class="faixa"></div>
<header class="topo"><div class="wrap">
  <div class="marca"><a href="/" style="color:inherit;text-decoration:none">Garagem Justa</a><span>protocolo garagem-justa/v1</span></div>
  <nav class="topo-links">
    {link("/", "Início", "inicio")}
    {link("/verificador.html", "Conferir um sorteio", "verificador")}
    {link("/protocolo.html", "Protocolo", "protocolo")}
  </nav>
</div></header>
<main class="wrap">
{corpo}
</main>
<footer class="rodape"><div class="wrap">
  Garagem Justa é operado por Exacto Gestão de Condomínios. O verificador e o
  motor de sorteio funcionam sem servidor: rodam no navegador de quem confere, e
  o que você colar aqui para conferir não é enviado a lugar nenhum. O cadastro de
  cada condomínio fica em sistema da administradora, de acesso restrito.
</div></footer>
</body>
</html>
"""


def main():
    # O acervo de versoes antigas do verificador sobrevive a regeracao. Sem isso
    # o rmtree abaixo apagaria os arquivos que atas ja assinadas citam pelo hash.
    acervo = {}
    sha_anterior = None
    if SITE.exists():
        atual = SITE / "verificador.html"
        if atual.exists():
            bytes_anterior = atual.read_bytes()
            sha_anterior = hashlib.sha256(bytes_anterior).hexdigest()
        for p in (SITE / "v").rglob("*"):
            rel = p.relative_to(SITE / "v").as_posix() if p.is_file() else ""
            if rel and rel != "index.html":   # o indice e regerado, nao preservado
                acervo[rel] = p.read_bytes()
        shutil.rmtree(SITE)
    (SITE / "app").mkdir(parents=True)
    (SITE / "core").mkdir(parents=True)

    # arquivos que vão como estão
    shutil.copy(RAIZ / "app" / "verificador.html", SITE / "verificador.html")
    for nome in ("index.html", "app.css", "app.js"):
        shutil.copy(RAIZ / "app" / nome, SITE / "app" / nome)
    for nome in ("sorteio.browser.js", "sorteio.py", "vetores.json",
                 "exemplo-unicco.txt", "exemplo-unicco-drand.txt", "teste.py"):
        shutil.copy(RAIZ / "core" / nome, SITE / "core" / nome)

    sha = hashlib.sha256((SITE / "verificador.html").read_bytes()).hexdigest()

    # A versao que sai de cartaz vai para /v/<sha>/, endereco que a ata ja cita
    # pelo proprio hash. Quem conferir em 2035 um sorteio de 2026 acha o arquivo
    # de 2026, com o hash que a ata dele registra.
    if sha_anterior and sha_anterior != sha:
        acervo[f"{sha_anterior}/verificador.html"] = bytes_anterior
    for rel, dados in acervo.items():
        destino = SITE / "v" / rel
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(dados)
    if acervo:
        linhas = "\n".join(
            f'  <tr><td><a href="/v/{r}">{r.split("/")[0]}</a></td></tr>'
            for r in sorted(acervo)
        )
        (SITE / "v" / "index.html").write_text(
            pagina(
                "Versoes anteriores do verificador",
                "Acervo das versoes do verificador citadas em atas ja lavradas.",
                "<h1>Versoes anteriores do verificador</h1>"
                "<p>Cada ata registra o SHA-256 do verificador vigente na data da "
                "assembleia. Quando o verificador muda, a versao anterior fica aqui, "
                "em endereco formado pelo proprio hash, e continua valendo para as "
                "atas que a citam.</p>"
                f"<table><tr><th>SHA-256</th></tr>\n{linhas}\n</table>",
            ),
            encoding="utf-8",
        )

    # a aplicação não precisa aparecer em buscador
    (SITE / "robots.txt").write_text(
        "User-agent: *\nDisallow: /app/\nDisallow: /core/\n", encoding="utf-8"
    )

    # ---- protocolo.html, gerado do markdown normativo ----
    md = (RAIZ / "docs" / "PROTOCOLO.md").read_text(encoding="utf-8")
    corpo_md = markdown.markdown(md, extensions=["tables", "fenced_code"])
    corpo_md = corpo_md.replace("<h1>", '<h1 style="margin-top:34px">', 1)
    (SITE / "protocolo.html").write_text(
        pagina(
            "Protocolo Garagem Justa",
            "Especificação normativa do sorteio de vagas publicamente verificável.",
            corpo_md
            + '<hr><p><a href="/core/sorteio.py">sorteio.py</a>, '
            '<a href="/core/vetores.json">vetores.json</a> e '
            '<a href="/core/teste.py">teste.py</a> ficam publicados para quem quiser '
            "reimplementar o protocolo e conferir contra os mesmos vetores.</p>",
            "protocolo",
        ),
        encoding="utf-8",
    )

    # ---- index.html ----
    diagrama = """
<figure class="figura">
<div class="rolagem">
<svg class="linha-tempo" viewBox="0 0 880 210" role="img"
     aria-label="Linha do tempo: a lista é congelada e o compromisso vai para a ata; só depois chega o número da fonte externa; o resultado é a conta dos dois.">

  <text class="rot" x="180" y="40" text-anchor="middle">Lista congelada</text>
  <rect class="chip" x="88" y="54" width="184" height="26" rx="4"/>
  <text class="sub" x="180" y="71" text-anchor="middle">compromisso 9f3a2b7c...</text>

  <g>
    <text class="rot" x="560" y="40" text-anchor="middle">Número de fora</text>
    <rect class="chip" x="452" y="54" width="216" height="26" rx="4"/>
    <text class="sub" x="560" y="71" text-anchor="middle">Loteria Federal ou drand</text>
    <circle class="marco" cx="560" cy="134" r="16"/>
    <circle class="glifo" cx="554" cy="129" r="2.2"/>
    <circle class="glifo" cx="566" cy="129" r="2.2"/>
    <circle class="glifo" cx="554" cy="140" r="2.2"/>
    <circle class="glifo" cx="566" cy="140" r="2.2"/>
  </g>

  <text class="rot" x="770" y="40" text-anchor="middle">Resultado</text>
  <rect class="chip" x="690" y="54" width="160" height="26" rx="4"/>
  <text class="sub" x="770" y="71" text-anchor="middle">um só possível</text>

  <rect class="vao pulsa" x="180" y="126" width="380" height="16" rx="8"/>
  <line class="trilho" x1="40" y1="134" x2="826" y2="134"/>
  <path class="trilho" d="M826 128 L840 134 L826 140" fill="none"/>
  <circle class="pulso" cx="180" cy="134" r="4"/>

  <circle class="marco" cx="180" cy="134" r="16"/>
  <rect class="glifo" x="173" y="133" width="14" height="10" rx="2"/>
  <path d="M176 133 v-4 a4 4 0 0 1 8 0 v4" fill="none" stroke="var(--marca-ink)" stroke-width="2"/>

  <circle class="marco" cx="770" cy="134" r="16"/>
  <rect class="glifo" x="762" y="130" width="16" height="2.4" rx="1.2"/>
  <rect class="glifo" x="762" y="136" width="16" height="2.4" rx="1.2"/>

  <text class="sub" x="180" y="164" text-anchor="middle">assembleia abre</text>
  <text class="sub" x="560" y="164" text-anchor="middle">minutos depois</text>
  <text class="sub" x="770" y="164" text-anchor="middle">na hora</text>
  <text class="sub" x="370" y="194" text-anchor="middle">neste intervalo o número ainda não existe, para ninguém</text>
</svg>
</div>
<figcaption>A ordem é o que prova. O compromisso da lista é lavrado em ata antes de
existir o número que vai embaralhá-la, então não há como escolher a lista sabendo o
sorteio, nem o sorteio sabendo a lista.</figcaption>
</figure>
"""

    inicio = f"""
<div class="heroi">
<h1>O sorteio da sua vaga pode ser conferido por você</h1>

<p class="chamada">Garagem Justa é o processo que a administração usa para sortear
vagas de garagem em assembleia. Ele foi feito para que ninguém precise confiar em
quem organizou: com os dados que constam da ata, qualquer condômino refaz o
cálculo no próprio computador e chega ao mesmo resultado, ou descobre que não
chega.</p>

<div class="botoes">
  <a class="b" href="/verificador.html">Conferir um sorteio</a>
  <a class="b sec" href="/protocolo.html">Como funciona por dentro</a>
</div>
</div>

{diagrama}

<h2>Como funciona</h2>

<div class="grade grade-3">
  <div class="passo">
    <div class="n">1</div>
    <h3>A lista é fechada na frente de todos</h3>
    <p>Encerrada a discussão sobre quem participa e quais vagas são sorteáveis, a
    relação é congelada na assembleia e dela se extrai um resumo criptográfico, o
    compromisso. Ele é lido em voz alta e lançado em ata. Qualquer alteração
    posterior, mesmo de um único caractere, faz esse resumo deixar de bater.</p>
  </div>
  <div class="passo">
    <div class="n">2</div>
    <h3>A aleatoriedade vem de fora e chega depois</h3>
    <p>Só então se colhe o número que vai embaralhar a lista: os prêmios da Loteria
    Federal daquela noite, ou uma rodada do sorteio distribuído drand, publicada
    minutos depois do congelamento. Nos dois casos ninguém, nem a administração,
    pode conhecer esse número no momento em que a lista foi fechada.</p>
  </div>
  <div class="passo">
    <div class="n">3</div>
    <h3>O resultado é uma conta, não uma decisão</h3>
    <p>Compromisso mais aleatoriedade produzem um único resultado possível. Quem
    repetir a conta com os mesmos dados chega necessariamente ao mesmo lugar, hoje
    ou daqui a dez anos.</p>
  </div>
</div>

<h2>O que você precisa para conferir</h2>

<p>Tudo o que segue consta da ata da assembleia, e o síndico deve fornecer a
qualquer condômino que pedir, no dever de informação que acompanha a
administração de coisa alheia:</p>

<div class="grade grade-2">
  <div class="precisa">
    <span class="tag">insumo</span>
    <h3>O texto integral da lista congelada</h3>
    <p>É o que entra no cálculo, exatamente como foi fechado.</p>
  </div>
  <div class="precisa">
    <span class="tag">prova de anterioridade</span>
    <h3>O compromisso lançado em ata</h3>
    <p>Prova que a lista não mudou depois que o sorteio aconteceu.</p>
  </div>
  <div class="precisa">
    <span class="tag">fonte externa</span>
    <h3>O resultado da fonte de aleatoriedade</h3>
    <p>Você confere na origem: no portal da Caixa ou em api.drand.sh, não conosco.</p>
  </div>
  <div class="precisa">
    <span class="tag">fecho</span>
    <h3>O hash do resultado</h3>
    <p>Prova que o resultado anunciado é o mesmo que a conta produz.</p>
  </div>
</div>

<p>Com isso em mãos, abra o <a href="/verificador.html">verificador</a>, cole e
compare. A página funciona offline: salve o arquivo e ele continua valendo daqui
a anos, mesmo que este site saia do ar.</p>

<div class="cartao">
  <h3 style="margin-top:0">Confira também o próprio verificador</h3>
  <p style="margin-bottom:8px">A ata registra o resumo criptográfico do arquivo
  do verificador. Confira que o arquivo que você baixou é o mesmo, antes de
  confiar no que ele diz. No Windows:
  <code>certutil -hashfile verificador.html SHA256</code>. No Linux ou no Mac:
  <code>sha256sum verificador.html</code>.</p>
  <p class="hash" style="margin:0 0 10px">SHA-256 da versão publicada agora:<br>{sha}</p>
  <p style="margin:0;font-size:14px">Se a sua ata cita outro hash, ela é de uma
  versão anterior do verificador, que continua publicada em
  <code>/v/&lt;hash da ata&gt;/verificador.html</code>.</p>
</div>

<h2>Não quer confiar em JavaScript</h2>

<p>O mesmo cálculo está implementado em Python, de forma independente, e as duas
implementações são conferidas uma contra a outra por vetores de teste. Baixe
<a href="/core/sorteio.py">sorteio.py</a> e rode
<code>python3 sorteio.py payload.txt "&lt;valor da fonte&gt;"</code>. Duas
implementações independentes que concordam valem muito mais que uma.</p>

<div class="aviso">
  <h3>O que este site sabe sobre você</h3>
  <p>Nada. O verificador e o motor rodam inteiramente no seu navegador: os dados
  que você cola para conferir não são enviados a servidor nenhum, nem ao nosso. O
  cadastro de unidades e vagas de cada condomínio, esse sim, fica em sistema da
  administradora, com acesso restrito à equipe que conduz a assembleia.</p>
</div>

<h2>Para quem conduz a assembleia</h2>

<p>A aplicação de condução é de uso da administração: <a href="/app/">abrir a
aplicação</a>.</p>
"""

    (SITE / "index.html").write_text(
        pagina(
            "Garagem Justa — sorteio de vagas verificável",
            "Confira por conta própria o sorteio de vagas de garagem do seu condomínio.",
            inicio,
            "inicio",
        ),
        encoding="utf-8",
    )

    arquivos = sorted(p.relative_to(SITE).as_posix() for p in SITE.rglob("*") if p.is_file())
    print(f"site/ gerado com {len(arquivos)} arquivos:")
    for a in arquivos:
        print("  " + a)
    print("\nSHA-256 do verificador publicado:")
    print("  " + sha)


if __name__ == "__main__":
    main()
