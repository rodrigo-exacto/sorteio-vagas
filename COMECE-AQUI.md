# Comece aqui

Roteiro do primeiro uso, na ordem. Cada etapa leva poucos minutos.

---

## 1. Abrir

Duplo clique em **ABRIR-GARAGEM-JUSTA.html**, nesta pasta. Não instala nada,
não pede senha, não precisa de internet. Use Chrome ou Edge.

Se abrir uma tela com oito abas numeradas no topo, está funcionando.

---

## 2. Fazer um ensaio antes de mexer em dado real

Antes de cadastrar o Unicco, rode o ciclo inteiro com o exemplo. São cinco
minutos e é o que faz o resto do roteiro fazer sentido.

1. Clique em **Carregar exemplo**, no canto superior direito.
2. Passe pelas abas 1 a 5 só olhando. A aba 3 já vem com a família de
   etiquetas "Cobertura" cadastrada, e a aba 1 já vem dividida por ela.
3. Vá para a aba **6. Conferência**. O semáforo separa o que impede de abrir
   do que é ponto de atenção. Leia o bloco da convocação.
4. Clique em **Abrir o sorteio e congelar**. Aparece o compromisso, que é o
   resumo criptográfico do cadastro naquele instante.
5. Aba **7. Sorteio**: digite cinco números quaisquer de cinco dígitos nos
   campos de prêmio e clique em **Apurar**.
6. Clique em **Modo apresentação**. É essa tela que vai no projetor. Barra de
   espaço revela uma unidade por vez; Esc fecha.
7. Aba **8. Dossiê**: baixe o `trecho-da-ata.md` e olhe o que sai pronto.

Depois clique em **Novo** para limpar. Nada do ensaio fica.

---

## 3. Montar o Unicco

1. **Novo**, para começar do zero.
2. Aba **3. Vagas**, no cartão de cima: **Adicionar família**, nome
   `Cobertura`, valores `Coberta, Descoberta`.
3. Aba **1. Condomínio**: nome, CNPJ, data e hora da assembleia. Em *divisão do
   sorteio* escolha **Por Cobertura**. Em *fonte de aleatoriedade*, Loteria
   Federal se a assembleia cair em quarta ou sábado antes das 20h, drand em
   qualquer outro dia. Escreva as regras como devem sair no edital.
4. Aba **2. Unidades**: **Importar CSV** e escolha
   `dados\unicco-unidades.csv`. Entram 182 unidades já com o grupo de cada uma.
5. Aba **3. Vagas**: **Importar CSV** e escolha `dados\unicco-vagas.csv`.
   Entram 182 vagas, com as três acessíveis já fora do pool.
6. Aba **5. Diretas**: três linhas, uma para cada vaga acessível, com a unidade
   e o motivo. Sem isso a conferência vai acusar 3 pedidos a mais que posições,
   porque as acessíveis saíram do sorteio.
7. Aba **6. Conferência**: o dimensionamento tem que fechar 76/76 no grupo
   Coberta e 103/103 no Descoberta.

Clique em **Salvar projeto** e guarde o `.json`. É ele o projeto; o navegador
guarda só uma cópia de conveniência.

---

## 4. Tudo continua editável até a abertura

Enquanto o ciclo não for congelado, **tudo** muda: unidades, vagas, etiquetas,
grupos, atribuições diretas, regras, fonte de aleatoriedade.

- **Vaga nova que o condomínio criou:** aba 3, *adicionar vaga*, ou *importar
  CSV* com só as novas. Importar acrescenta e pula código já cadastrado;
  *substituir por CSV* é que apaga tudo e põe o arquivo no lugar.
- **Achar uma linha entre 182:** o campo de filtro no topo da tabela. Aceita
  pedaço de código, rótulo, etiqueta, lote ou motivo, e vários termos juntos.
  Ele não muda nada do cadastro, só esconde linha da tela.
- **Unidade que apresentou laudo na véspera:** aba 5, mais uma atribuição
  direta, ou aba 3 marcando a vaga como fora do pool com o motivo.

Depois de congelado, o cadastro trava. Enquanto a aleatoriedade não tiver sido
colhida, **Reabrir o cadastro** destrava sem custo nenhum e fica registrado.
Depois de apurado, só resta **Anular o ciclo**, que exige motivo e guarda para
sempre o resultado descartado.

---

## 5. Publicar o site

Só é preciso uma vez. Ver **docs/PUBLICAR.md**. O que vai ao ar é a página de
entrada, o verificador público, o protocolo e a própria aplicação.

Anote o SHA-256 do verificador que o comando imprime: é ele que vai na ata.

Atualizar depois é subir por cima, pelo mesmo caminho, e a URL não muda. Só uma
regra: corrija sempre aqui na pasta, nunca direto no painel da Hostinger, ou a
correção some no envio seguinte. E `verificador.html` nunca se corrige no
servidor, porque o hash dele está lavrado em ata. O procedimento de troca de
versão está no PUBLICAR.md.

---

## 6. No dia da assembleia

1. Abra a aplicação e carregue o `.json` do projeto.
2. Deixe a tela do telão pronta e o endereço do verificador projetado.
3. Encerrada a deliberação sobre quem participa e o que é sorteável, aba 6,
   **Abrir o sorteio e congelar**.
4. Copie o bloco da abertura, **leia o compromisso em voz alta** e mande lançar
   em ata. Esta ordem é a prova: compromisso antes da aleatoriedade.
5. Colha a fonte: os cinco prêmios das 20h, ou a rodada do drand.
6. **Apurar**, depois **Modo apresentação**.
7. Aba 8, baixe tudo e guarde junto com a ata.

---

## O que ainda precisa de decisão, no Unicco

- O que são as vagas 1, 2, 3 e 108, que não aparecem no resultado anterior.
- Quais unidades ficam com as três vagas acessíveis, e por qual critério.
- Quais duas vagas cobertas entram como excedentes no grupo das descobertas.
- Se a divisão entre cobertas e descobertas tem base na convenção. O sistema
  executa a divisão declarada, mas não a legitima.
