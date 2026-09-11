/* Garagem Justa — microinterações da página inicial.
   Só apresentação: nada aqui calcula, altera ou simula sorteio. */
(function () {
  "use strict";

  var paradoQuemPede = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- entrada dos elementos ao aparecerem na tela, uma vez só ---- */
  var alvos = document.querySelectorAll(".sobe, .tl, .vitrine");
  if (paradoQuemPede.matches || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(alvos, function (el) { el.classList.add("reveal"); });
  } else {
    var olho = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("reveal");
        olho.unobserve(e.target);
      });
    }, { threshold: 0.22, rootMargin: "0px 0px -8% 0px" });
    Array.prototype.forEach.call(alvos, function (el) { olho.observe(el); });
  }

  /* ---- navegação: marca a seção em que se está ---- */
  var secoes = document.querySelectorAll("section[id]");
  var elos = {};
  Array.prototype.forEach.call(document.querySelectorAll('.topo nav a[href^="#"]'), function (a) {
    elos[a.getAttribute("href").slice(1)] = a;
  });
  if ("IntersectionObserver" in window && secoes.length) {
    var olhoNav = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        var a = elos[e.target.id];
        if (!a) return;
        if (e.isIntersecting) {
          Object.keys(elos).forEach(function (k) { elos[k].removeAttribute("aria-current"); });
          a.setAttribute("aria-current", "page");
        }
      });
    }, { threshold: 0.5 });
    Array.prototype.forEach.call(secoes, function (s) { olhoNav.observe(s); });
  }

  /* ---- Modo Assembleia em tela cheia ---- */
  var palco = document.getElementById("palco");
  var abrir = document.querySelector("[data-abrir-palco]");
  var fechar = palco && palco.querySelector("[data-fechar-palco]");
  var voltarFoco = null;

  function abrirPalco() {
    if (!palco) return;
    voltarFoco = document.activeElement;
    palco.hidden = false;
    palco.setAttribute("data-aberto", "");
    document.body.setAttribute("data-travado", "");
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () { /* sem tela cheia, segue */ });
    }
    if (fechar) fechar.focus();
  }

  function fecharPalco() {
    if (!palco) return;
    palco.removeAttribute("data-aberto");
    palco.hidden = true;
    document.body.removeAttribute("data-travado");
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () { /* já saiu */ });
    }
    if (voltarFoco && voltarFoco.focus) voltarFoco.focus();
  }

  if (abrir) abrir.addEventListener("click", abrirPalco);
  if (fechar) fechar.addEventListener("click", fecharPalco);

  document.addEventListener("keydown", function (e) {
    if (!palco || palco.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); fecharPalco(); return; }
    if (e.key !== "Tab") return;
    // mantém o foco dentro do painel enquanto ele estiver aberto
    var focaveis = palco.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    if (!focaveis.length) return;
    var primeiro = focaveis[0];
    var ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  });

  // sair da tela cheia pelo navegador fecha o painel junto
  document.addEventListener("fullscreenchange", function () {
    if (!document.fullscreenElement && palco && !palco.hidden) fecharPalco();
  });
})();
