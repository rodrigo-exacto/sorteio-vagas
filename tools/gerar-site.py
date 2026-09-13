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
    (SITE / "core").mkdir(parents=True)

    # arquivos que vão como estão
    shutil.copy(RAIZ / "app" / "verificador.html", SITE / "verificador.html")
    # A aplicação de condução NÃO vai para o site público: ela é o sistema
    # online, em app.garagemjusta.com.br, atrás de login. A versão estática
    # continua em app/ no repositório, para uso local por duplo clique no
    # ABRIR-GARAGEM-JUSTA.html, mas publicá-la deixaria qualquer pessoa conduzir
    # um sorteio e apresentar o resultado como se fosse da administradora.
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
        "User-agent: *\nDisallow: /core/\n", encoding="utf-8"
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
    # ---- index.html, montada a partir de tools/inicio/ ----
    base = pathlib.Path(__file__).resolve().parent / "inicio"
    css = (base / "estilo.css").read_text(encoding="utf-8")
    corpo = (base / "corpo.html").read_text(encoding="utf-8").replace("{{SHA}}", sha)
    js = (base / "script.js").read_text(encoding="utf-8")

    cabeca = (
        '<!doctype html>\n<html lang="pt-BR">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        "<title>Garagem Justa — sorteio de vagas de garagem verificável</title>\n"
        '<meta name="description" content="A lista é lacrada antes do sorteio, a '
        'aleatoriedade vem de fora e o resultado pode ser reproduzido por qualquer '
        'condômino.">\n'
        '<meta name="color-scheme" content="light dark">\n'
        "<style>" + css + "</style>\n</head>\n<body>\n"
        '<div class="faixa-marca"></div>\n'
    )
    (SITE / "index.html").write_text(
        cabeca + corpo + "\n<script>" + js + "</script>\n</body>\n</html>\n",
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
