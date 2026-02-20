/**
 * ==========================
 * CARREGA TODOS OS PRODUTOS
 * ==========================
 */
async function carregarEstoque() {
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .order('nome_prod', { ascending: true }); // Ordena por nome

  if (error) {
    console.error("Erro ao carregar:", error);
    alert("Erro ao carregar dados do estoque.");
    return;
  }

  renderTabela(data);
}

/**
 * ============================
 * FORMATA VALOR EM MOEDA (R$)
 * ============================
 */
function formatarMoeda(valor) {
  if (valor == null || valor === "") return "R$ 0,00";
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

/**
 * ===============================
 * RENDERIZA A TABELA DE PRODUTOS
 * ===============================
 */
function renderTabela(lista) {
  const tbody = document.getElementById("tabela-estoque");
  tbody.innerHTML = "";

  if (lista.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6'>Nenhum produto encontrado.</td></tr>";
    return;
  }

  lista.forEach(item => {
    // Tratamento seguro para valores
    const venda = item.v_venda ? Number(item.v_venda) : 0;
    const estoque = item.quantidade_estoque ?? item.estoque_atual ?? 0; // Tenta pegar quantidade_estoque (do PDV) ou estoque_atual

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.ean || "-"}</td>
      <td style="text-align: left; padding-left: 15px;">${item.nome_prod || "Sem Nome"}</td>
      <td>${item.unid || "UN"}</td>
      <td>${estoque}</td>
      <td>${formatarMoeda(venda)}</td>
      <td>
        <span class="status ${item.ativo ? "verde" : "vermelho"}"></span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * =============================
 * BUSCA DE PRODUTOS (OTIMIZADA)
 * =============================
 */
let timeoutBusca = null; // Para evitar buscar a cada letra digitada

async function buscarProdutos() {
  const termo = document.getElementById("search").value.trim();
  
  // Limpa o timeout anterior se o usuário continuar digitando
  clearTimeout(timeoutBusca);

  // Aguarda 500ms após parar de digitar para buscar
  timeoutBusca = setTimeout(async () => {
    
    // Se estiver vazio, recarrega tudo
    if (!termo) {
      carregarEstoque();
      return;
    }

    // Busca no Supabase (Case Insensitive)
    // Procura no nome OU no EAN
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .or(`nome_prod.ilike.%${termo}%,ean.ilike.%${termo}%`);

    if (error) {
      console.error("Erro na busca:", error);
      return;
    }

    renderTabela(data);
  }, 500);
}

/**
 * =====================
 * TROCA DE TELAS (MENU)
 * =====================
 */
function mostrarTela(idTela) {
  // Esconde todas as telas
  document.querySelectorAll('.tela').forEach(tela => {
    tela.classList.remove('ativa');
  });

  // Mostra a tela desejada
  const telaAlvo = document.getElementById(idTela);
  if (telaAlvo) {
    telaAlvo.classList.add('ativa');
  }
}

/**
 * =====================
 * INICIALIZAÇÃO
 * =====================
 */
document.addEventListener("DOMContentLoaded", () => {
  
  // Carrega dados iniciais
  carregarEstoque();

  // Configura botões do menu
  const botoesMenu = document.querySelectorAll(".menu-btn");
  botoesMenu.forEach((btn) => {
    
    // Se o botão for link externo (como o PDV), ignora a lógica de abas
    if(btn.hasAttribute('onclick')) return;

    btn.addEventListener("click", () => {
      // Remove ativo dos outros
      botoesMenu.forEach(b => b.classList.remove("ativo"));
      // Adiciona ativo neste
      btn.classList.add("ativo");

      const idTela = btn.getAttribute("data-tela");
      mostrarTela(idTela);
    });
  });
});

// Atalho Alt + C para abrir o PDV
document.addEventListener("keydown", (e) => {
  if (e.altKey && e.code === "KeyC") {
    e.preventDefault();
    // Certifique-se que o nome do arquivo aqui bate com o arquivo do PDV
    window.open("pdv.html", "pdvWindow", "width=1200,height=800"); 
  }
});
