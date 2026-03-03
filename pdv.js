document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // 0. SISTEMA DE LOGIN (Início Obrigatório)
    // ==========================================
    
    const overlay = document.getElementById('overlay-login');
    const inputPin = document.getElementById('input-pin');
    const nomeTela = document.getElementById('nome-operador-tela');
    
    // --- NOVO: Verifica as Preferências (Se existirem) ---
    // Se PREFERENCIAS não existir (erro de carga), assume que exige login (true) por segurança
    const exigirLogin = (typeof PREFERENCIAS !== 'undefined') ? PREFERENCIAS.exigirLogin : true;

    // LÓGICA DE DECISÃO
    if (exigirLogin === false) {
        
        // --- MODO: LOGIN DESATIVADO (Entra Direto) ---
        console.log("Login desativado pelas preferências.");
        
        // Pega o usuário padrão do arquivo de config ou cria um fallback
        const usuarioPadrao = (typeof PREFERENCIAS !== 'undefined' && PREFERENCIAS.usuarioPadrao) 
                              ? PREFERENCIAS.usuarioPadrao 
                              : { id: 1, nome: "Admin Padrão", permissao: "admin" };

        // Salva na sessão para o sistema de vendas não quebrar
        sessionStorage.setItem('usuario_atual', JSON.stringify(usuarioPadrao));

        // Garante que a tela esteja liberada visualmente
        if (overlay) overlay.style.display = 'none';
        if (nomeTela) nomeTela.textContent = usuarioPadrao.nome.split(' ')[0];

    } else {
        
        // --- MODO: LOGIN ATIVADO (Padrão Antigo) ---
        const usuarioSalvo = sessionStorage.getItem('usuario_atual');

        if (usuarioSalvo) {
            // Já estava logado? Libera.
            if (overlay) overlay.style.display = 'none';
            if (nomeTela) {
                const u = JSON.parse(usuarioSalvo);
                nomeTela.textContent = u.nome.split(' ')[0];
            }
        } else {
            // Não logado? Bloqueia.
            if (overlay) overlay.style.display = 'flex';
            if (inputPin) setTimeout(() => inputPin.focus(), 100);
        }
    }

    // 2. CONFIGURAÇÃO DA TECLA ENTER (Mantém igual, para caso o login seja reativado)
    if (inputPin) {
        // Clona para garantir que não haja eventos duplicados travando
        const novoInput = inputPin.cloneNode(true);
        inputPin.parentNode.replaceChild(novoInput, inputPin);

        novoInput.addEventListener('keydown', function(e) {
            // Limpa erro visual ao digitar
            this.classList.remove('input-erro');
            const msg = document.getElementById('msg-erro');
            if (msg) msg.classList.remove('visivel');

            // SE APERTAR ENTER
            if (e.key === 'Enter') {
                e.preventDefault(); // Impede recarregar a página
                fazerLogin();       // Chama a função
            }
        });

        // Foca no input ao clicar no fundo preto
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) novoInput.focus();
            });
        }
    }


    // ==========================================
    // 1. VARIÁVEIS GLOBAIS E ELEMENTOS
    // ==========================================
    
    // Elementos da Interface
    const btnMenos = document.getElementById('btnQtdMenos');
    const btnMais = document.getElementById('btnQtdMais');
    const inputQtd = document.getElementById('txtQuantidade');
    const chkVenderAlem = document.getElementById('chkVenderAlemEstoque');
    const spanEstoque = document.getElementById('spanEstoqueAtual');
    const inputBusca = document.getElementById('search-pdv');
    const divResultados = document.getElementById('lista-produtos-pdv');
    const divCarrinho = document.getElementById('itens-carrinho');
    const spanTotal = document.getElementById('total-carrinho');
    const btnAdicionar = document.getElementById('btn-buscar-manual'); // Botão Lupa/Add
    const btnConsultar = document.getElementById('btn-consultar');



    // Estado do Sistema
    let carrinho = [];

    try {
        const dadosSalvos = localStorage.getItem('pdv_carrinho');
        if (dadosSalvos) {
            carrinho = JSON.parse(dadosSalvos);
        }
    } catch (e) {
        console.error("Error loading cart, resetting:", e);
        carrinho = []; // Reset if data is corrupted
    }
    
    let produtoSelecionado = null; 
    let timeoutBusca = null;      // ESSENTIAL
    let ultimosResultados = [];   // ESSENTIAL
    let currentFocus = -1; // Controle da navegação via teclado
    let ultimoValorBusca = ''; // Controle para evitar busca repetida



    // ==========================================
    // 2. LÓGICA DE INTERFACE (Botões +/- e Estoque)
    // ==========================================
    
    function atualizarBotoesUI() {
        let qtd = parseInt(inputQtd.value) || 1;
        let permiteVendaAlem = chkVenderAlem.checked;
        let estoque = produtoSelecionado ? (produtoSelecionado.estoque_atual || 0) : 0;

        // Regra do Botão Menos
        btnMenos.disabled = (qtd <= 1);

        // Regra do Botão Mais e Checkbox
        if (!permiteVendaAlem) {
            // Se NÃO pode vender além, trava no limite do estoque
            if (produtoSelecionado && qtd >= estoque) {
                btnMais.disabled = true;
                if (qtd > estoque) inputQtd.value = estoque;
            } else {
                btnMais.disabled = false;
            }
            // Se não tem produto selecionado ou estoque é 0
            if (!produtoSelecionado || estoque === 0) btnMais.disabled = true;
        } else {
            // Se permite vender além, libera geral
            btnMais.disabled = false;
        }
    }

    // Eventos dos botões de quantidade
    btnMenos.addEventListener('click', () => {
        let qtd = parseInt(inputQtd.value) || 1;
        if (qtd > 1) {
            inputQtd.value = qtd - 1;
            atualizarBotoesUI();
        }
    });

    btnMais.addEventListener('click', () => {
        if (!btnMais.disabled) {
            let qtd = parseInt(inputQtd.value) || 1;
            inputQtd.value = qtd + 1;
            atualizarBotoesUI();
        }
    });

    inputQtd.addEventListener('input', atualizarBotoesUI);

    // ==========================================
    // LÓGICA DA TRAVA DE ESTOQUE (TEXTOS CORRIGIDOS)
    // ==========================================
    const btnToggleEstoque = document.getElementById('btnToggleEstoque');
    let timeoutEstoque = null; 

    // Garante que chkVenderAlem está definido
    // const chkVenderAlem = document.getElementById('chkVenderAlemEstoque'); 

    if (btnToggleEstoque && chkVenderAlem) {
        
        btnToggleEstoque.addEventListener('click', () => {
            
            // CASO 1: Se já está ATIVO -> Desliga e volta ao inicial
            if (btnToggleEstoque.classList.contains('unlocked')) {
                chkVenderAlem.checked = false; 
                
                btnToggleEstoque.classList.remove('unlocked');
                btnToggleEstoque.innerHTML = '<i class="fas fa-lock"></i> ATIVAR OVERSELL';
                
                atualizarBotoesUI(); 
            }
            
            // CASO 2: Se está CONFIRMANDO -> Ativa
            else if (btnToggleEstoque.classList.contains('confirm-lock')) {
                clearTimeout(timeoutEstoque); 
                
                chkVenderAlem.checked = true; 
                
                btnToggleEstoque.classList.remove('confirm-lock');
                btnToggleEstoque.classList.add('unlocked');
                btnToggleEstoque.innerHTML = '<i class="fas fa-lock-open"></i> OVERSELL ATIVO';
                
                atualizarBotoesUI();
            }
            
            // CASO 3: Se está NEUTRO -> Pede confirmação
            else {
                btnToggleEstoque.classList.add('confirm-lock');
                btnToggleEstoque.innerHTML = '<i class="fas fa-exclamation-circle"></i> CONFIRMAR?';
                
                // Timer: Se não clicar em 3s, volta ao texto inicial correto
                timeoutEstoque = setTimeout(() => {
                    if (btnToggleEstoque.classList.contains('confirm-lock')) {
                        btnToggleEstoque.classList.remove('confirm-lock');
                        btnToggleEstoque.innerHTML = '<i class="fas fa-lock"></i> ATIVAR OVERSELL';
                    }
                }, 3000);
            }
        });
    }

    // ==========================================
    // 3. LÓGICA DE BUSCA NO SUPABASE
    // ==========================================

    // Função exposta globalmente para o onkeyup do HTML
    window.buscarProdutosPDV = async function() {
        const termo = inputBusca.value.trim();
        
        if (termo === ultimoValorBusca) return;
        ultimoValorBusca = termo

        clearTimeout(timeoutBusca);
        
        // Se limpar o campo, esconde resultados e reseta seleção
        if (!termo) {
            currenteFocus = -1
            divResultados.style.display = 'none';
            divResultados.innerHTML = '';
            resetarSelecao();
            return;
        }

        timeoutBusca = setTimeout(async () => {
            // Busca no Supabase (Nome ou EAN)
            const { data, error } = await supabase
                .from("produtos")
                .select("*")
                .or(`nome_prod.ilike.%${termo}%,ean.ilike.%${termo}%`)
                .eq('ativo', true) // Só busca produtos ativos
                .limit(10); // Limita a 10 resultados para não poluir a tela

            if (error) {
                console.error("Erro busca:", error);
                return;
            }

            renderizarResultadosBusca(data);
        }, 300); // Delay de 300ms
    };

    function renderizarResultadosBusca(lista) {
        divResultados.innerHTML = '';
        
        if (lista && lista.length > 0) {
            divResultados.style.display = 'block';

            lista.forEach(prod => {
                const div = document.createElement('div');
                
                // --- ESTILOS GERAIS ---
                div.style.padding = '10px';
                div.style.borderBottom = '1px solid #eee';
                div.style.cursor = 'pointer';
                div.style.backgroundColor = '#fff'; 
                div.style.display = 'flex';
                div.style.flexDirection = 'column'; // Coloca um item embaixo do outro
                div.style.color = '#000'; // Força cor preta

                // --- DADOS ---
                const nome = prod.nome_prod || "Produto sem nome";
                const ean = prod.ean || "S/ EAN";
                const estoque = prod.estoque_atual || 0;
                const preco = prod.v_venda ? parseFloat(prod.v_venda).toFixed(2) : '0.00';

                // --- LAYOUT CORRIGIDO: Nome em cima, detalhes embaixo separados por | ---
                div.innerHTML = `
                    <div style="font-weight:bold; font-size: 1rem; color:#000; margin-bottom: 4px;">
                        ${nome}
                    </div>
                    
                    <div style="font-size: 0.9em; color:#333;">
                        <span style="color:var(--primary-blue); font-weight:bold;">R$ ${preco}</span>
                        <span style="margin: 0 5px; font-weight:600; color: #888888;">|</span>
                        <span style="font-weight:600;">Estoque: ${estoque}</span>
                        <span style="margin: 0 5px; font-weight:600; color: #888888;">|</span>
                        <span style="font-weight:600;">Cód. barras: ${ean}</span>
                    </div>
                `;
                
                // Eventos
                div.onclick = () => selecionarProduto(prod);
                div.onmouseover = () => div.style.backgroundColor = '#e3f2fd';
                div.onmouseout = () => div.style.backgroundColor = '#fff';

                divResultados.appendChild(div);
            });
        } else {
            divResultados.style.display = 'none';
        }
    }

    // ==========================================
    // 4. LÓGICA DE SELEÇÃO E ADIÇÃO AO CARRINHO
    // ==========================================

    function resetarSelecao() {
        produtoSelecionado = null;
        inputQtd.value = 1;
        divResultados.style.display = 'none'; // Garante que a lista suma
        
        // Reseta checkbox se existir
        if (chkVenderAlem) chkVenderAlem.checked = false;

        // Reseta o visual do botão também
        if (btnToggleEstoque) {
            btnToggleEstoque.classList.remove('unlocked');
            btnToggleEstoque.classList.remove('confirm-lock'); // Remove o laranja se estiver pendente
            btnToggleEstoque.innerHTML = '<i class="fas fa-lock"></i> ATIVAR OVERSELL';
        }
        
        // CORREÇÃO: O botão volta a ser LUPA e perde a cor verde
        if (btnAdicionar) {
            btnAdicionar.innerHTML = '<i class="fas fa-search"></i>';
            btnAdicionar.style.backgroundColor = ''; 
        }

        atualizarBotoesUI();
    }

    function selecionarProduto(prod) {
        produtoSelecionado = prod;
        
        // Preenche visualmente
        inputBusca.value = prod.nome_prod; // Coloca o nome no input
        divResultados.style.display = 'none'; // Esconde a lista
        spanEstoque.innerText = prod.estoque_atual || 0; // Mostra estoque
        
        // Reseta quantidade para 1 e revalida botões
        inputQtd.value = 1;
        chkVenderAlem.checked = false; // Reseta checkbox de segurança
        atualizarBotoesUI();
        
        // Muda o ícone do botão de busca para "Adicionar" (Check) ou "Plus"
        btnAdicionar.innerHTML = '<i class="fas fa-plus"></i>';
        btnAdicionar.style.backgroundColor = 'var(--success-green)';
        
        // Foca no campo de quantidade para agilizar
        inputQtd.focus();
    }
    
    // --- EVENTOS DE TECLADO PARA SELEÇÃO RÁPIDA ---
    
    // Ao dar ENTER no campo de busca
    inputBusca.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Se houver resultados na lista, pega o primeiro
            if (ultimosResultados.length > 0) {
                selecionarProduto(ultimosResultados[0]);
            }
        }
    });

    // Ao dar ENTER no campo de quantidade -> Adiciona ao Carrinho
    inputQtd.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnAdicionar.click(); // Simula o clique no botão de adicionar
        }
    });

    // Função para Adicionar ao Carrinho
    btnAdicionar.onclick = function() {
        // Se não tem produto selecionado, age como botão de busca manual
        if (!produtoSelecionado) {
            window.buscarProdutosPDV();
            return;
        }

        const qtdSolicitada = parseInt(inputQtd.value);
        const estoqueDisp = produtoSelecionado.estoque_atual || 0;

        // Validação Final de Estoque antes de adicionar
        if (!chkVenderAlem.checked && qtdSolicitada > estoqueDisp) {
            alert("Quantidade indisponível em estoque!");
            return;
        }

        // Adicionar ao Array do Carrinho
        const itemCarrinho = {
            id: produtoSelecionado.id,
            ean: produtoSelecionado.ean || 'S/ EAN',
            nome: produtoSelecionado.nome_prod,
            
            // --- LINHA NOVA: Salva o estoque máximo para validar depois ---
            estoque_max: produtoSelecionado.estoque_atual || 0, 
            
            preco: parseFloat(produtoSelecionado.v_venda || 0),
            qtd: qtdSolicitada,
            total: parseFloat(produtoSelecionado.v_venda || 0) * qtdSolicitada
        };


        carrinho.push(itemCarrinho);
        salvarDados(); // <--- SALVA NO NAVEGADOR

        // Renderizar Carrinho
        renderizarCarrinho();

        // Limpar seleção para o próximo item
        inputBusca.value = '';

        resetarSelecao();
        inputBusca.focus(); // Volta foco para buscar próximo
    };

    // ======================================================
    // 5. RENDERIZAÇÃO DO CARRINHO (COM LIXEIRA INTELIGENTE) 
    // ======================================================

    function renderizarCarrinho() {
        divCarrinho.innerHTML = '';
        let totalGeral = 0;

        if (carrinho.length === 0) {
            divCarrinho.innerHTML = '<div style="padding: 20px; text-align: center; color: #aaa;">Nenhum item lançado.</div>';
            spanTotal.innerText = 'R$ 0,00';
            return;
        }

        carrinho.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'carrinho-item'; 
            
            // Variáveis de controle visual para os botões desta linha
            const chk = document.getElementById('chkVenderAlemEstoque');
            const permite = chk ? chk.checked : false;
            const estoqueMax = item.estoque_max || 0;

            // Define se os botões devem estar desativados
            const disableMenos = (item.qtd <= 1) ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : '';
            const disableMais = (!permite && item.qtd >= estoqueMax) ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : '';

            div.innerHTML = `
                <div>${index + 1}</div>
                <div>${item.ean}</div> 
                <div style="display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.1;">
                    ${item.nome}
                </div>
                
                <div class="cart-qtd-controls">
                    <button class="btn-qtd-mini" onclick="alterarQtdCarrinho(${index}, -1)" ${disableMenos}>-</button>
                    
                    <input type="number" 
                           class="qtd-input-cart" 
                           value="${item.qtd}" 
                           min="1"
                           onchange="definirQtdCarrinho(this, ${index})"
                           onkeydown="if(event.key==='Enter') this.blur()">
                           
                    <button class="btn-qtd-mini" onclick="alterarQtdCarrinho(${index}, 1)" ${disableMais}>+</button>
                </div>

                <div>R$ ${item.preco.toFixed(2)}</div>
                <div>R$ ${item.total.toFixed(2)}</div>
                
                <div style="text-align: center;">
                    <button class="btn-delete-item" onclick="tentarRemoverItem(this, ${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            divCarrinho.appendChild(div);
            totalGeral += item.total;
        });

        spanTotal.innerText = totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        divCarrinho.scrollTop = divCarrinho.scrollHeight;
    }

    // FUNÇÃO PARA ATUALIZAR QTD DIRETO NO CARRINHO
    window.atualizarQtdItem = function(input, index) {
        let novaQtd = parseInt(input.value);

        // Validação básica: não permite menor que 1
        if (isNaN(novaQtd) || novaQtd < 1) {
            novaQtd = 1;
        }

        // Atualiza os dados no array
        carrinho[index].qtd = novaQtd;
        carrinho[index].total = carrinho[index].preco * novaQtd;

        // Salva e Recalcula o Total Geral
        salvarDados();
        renderizarCarrinho();
        
        // (Opcional) Se quiser validar estoque aqui, teria que checar carrinho[index].id no array de produtos
    };


    // FUNÇÃO: Altera Qtd no Carrinho (+/-) (VERSÃO SEM ALERTA)
    window.alterarQtdCarrinho = function(index, delta) {
        const item = carrinho[index];
        const novaQtd = item.qtd + delta;
        const estoqueDisp = item.estoque_max || 0;
        
        // 1. Não permite quantidade menor que 1
        if (novaQtd < 1) return;

        // 2. Verifica Estoque e Checkbox
        const chk = document.getElementById('chkVenderAlemEstoque');
        const permiteVendaAlem = chk ? chk.checked : false;

        // Se NÃO pode vender além, e tenta passar do limite -> Para aqui (sem alert)
        if (!permiteVendaAlem && novaQtd > estoqueDisp) {
            return; 
        }

        // 3. Atualiza os dados
        item.qtd = novaQtd;
        item.total = item.preco * novaQtd;

        salvarDados();
        renderizarCarrinho();
    };

    // FUNÇÃO: Define Qtd via Digitação (Valida Estoque)
    window.definirQtdCarrinho = function(input, index) {
        const item = carrinho[index];
        let novoValor = parseInt(input.value);
        const estoqueMax = item.estoque_max || 0;
        
        // Verifica checkbox
        const chk = document.getElementById('chkVenderAlemEstoque');
        const permiteVendaAlem = chk ? chk.checked : false;

        // 1. Validação Mínima
        if (isNaN(novoValor) || novoValor < 1) {
            novoValor = 1;
        }

        // 2. Validação Máxima (Estoque)
        // Se tentar digitar 100 e só tem 10 (e não pode vender além), força para 10
        if (!permiteVendaAlem && novoValor > estoqueMax) {
            novoValor = estoqueMax;
        }

        // Atualiza visualmente o input (caso a validação tenha alterado o valor)
        input.value = novoValor;

        // 3. Salva os dados
        item.qtd = novoValor;
        item.total = item.preco * novoValor;

        salvarDados();
        renderizarCarrinho(); // Recarrega para atualizar o status dos botões +/-
    };

    // NOVA FUNÇÃO GLOBAL PARA REMOVER COM CONFIRMAÇÃO
    window.tentarRemoverItem = function(btn, index) {
        const linha = btn.closest('.carrinho-item');
        
        // Se já está no estado de confirmação (segundo clique)
        if (linha.classList.contains('confirm-delete')) {
            // Remove do array
            carrinho.splice(index, 1);
            salvarDados(); // <--- SALVA A REMOÇÃO
            
            // Re-renderiza
            renderizarCarrinho();
        } else {

            // Primeiro clique: Ativa modo confirmação
            linha.classList.add('confirm-delete');
            const icone = btn.querySelector('i');
            
            // Muda ícone visualmente (opcional) ou cor (já feito via CSS)
            // btn.innerHTML = '<i class="fas fa-check"></i>'; 
            
            // Timeout: Se não clicar em 3 segundos, cancela a exclusão
            setTimeout(() => {
                if(linha) linha.classList.remove('confirm-delete');
            }, 3000);
        }
    };

    // --- MANTER OUTRAS FUNÇÕES ---
    // (Botão Consultar, Seleção de Produto, Adicionar ao Carrinho, etc.)
    // Certifique-se de que a função btnAdicionar.onclick e selecionarProduto() 
    // chamem renderizarCarrinho() após modificar o array.
    
    // ... Código do botão Consultar ...
    if(btnConsultar) {
        btnConsultar.addEventListener('click', () => {
            if (window.opener && !window.opener.closed) {
                window.opener.focus();
            } else {
                window.open('estoque.html', 'JanelaEstoque');
            }
        });
    }

    // Inicialização
    atualizarBotoesUI();
    renderizarCarrinho(); // <--- FORÇA A EXIBIÇÃO DOS ITENS SALVOS

    // FUNÇÃO AUXILIAR PARA SALVAR NO NAVEGADOR
    function salvarDados() {
        localStorage.setItem('pdv_carrinho', JSON.stringify(carrinho));
    }

    // ==========================================
    // LÓGICA DO BOTÃO CANCELAR (VERSÃO CORRIGIDA E BLINDADA)
    // ==========================================
    const btnCancelarVenda = document.getElementById('btn-cancelar-venda');
    let timeoutCancelamento = null; // Variável de controle do tempo

    if (btnCancelarVenda) {
        // Remove clones de eventos anteriores para evitar bugs de "clique duplo"
        const novoBotao = btnCancelarVenda.cloneNode(true);
        btnCancelarVenda.parentNode.replaceChild(novoBotao, btnCancelarVenda);
        
        // Adiciona o evento no botão novo e limpo
        novoBotao.addEventListener('click', () => {
            
            // LÓGICA DO SEGUNDO CLIQUE (CONFIRMAR)
            if (novoBotao.classList.contains('confirm-active')) {
                // 1. Mata o timer imediatamente
                clearTimeout(timeoutCancelamento);
                
                try {
                    // Tenta limpar os dados
                    carrinho = [];
                    if (typeof salvarDados === "function") salvarDados();
                    if (typeof renderizarCarrinho === "function") renderizarCarrinho();
                    if (typeof resetarSelecao === "function") resetarSelecao();
                    if (inputBusca) inputBusca.value = '';
                } catch (erro) {
                    console.error("Erro ao limpar dados, mas resetando visual:", erro);
                }

                // 2. RESETA O VISUAL IMEDIATAMENTE (Sem travar)
                novoBotao.classList.remove('confirm-active');
                novoBotao.innerHTML = '<i class="fas fa-times"></i> Cancelar';

            } 
            // LÓGICA DO PRIMEIRO CLIQUE (ATIVAR)
            else {
                novoBotao.classList.add('confirm-active');
                novoBotao.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Confirmar?';
                
                // Inicia contagem de 3 segundos
                timeoutCancelamento = setTimeout(() => {
                    // Se passar 3s e a classe ainda estiver lá, reseta
                    if (novoBotao.classList.contains('confirm-active')) {
                        novoBotao.classList.remove('confirm-active');
                        novoBotao.innerHTML = '<i class="fas fa-times"></i> Cancelar';
                    }
                }, 3000);
            }
        });
    }

    // ==========================================
    // NAVEGAÇÃO TECLADO (SETAS E ENTER)
    // ==========================================
    if (inputBusca && divResultados) {
        inputBusca.addEventListener('keydown', function(e) {
            // Pega apenas os filhos diretos (as caixas dos produtos)
            let boxes = divResultados.children;

            if (e.key === 'ArrowDown') { // BAIXO
                currentFocus++;
                addActive(boxes);
            } 
            else if (e.key === 'ArrowUp') { // CIMA
                currentFocus--;
                addActive(boxes);
            } 
            else if (e.key === 'Enter') { // ENTER
                e.preventDefault();
                if (currentFocus > -1 && boxes[currentFocus]) {
                    boxes[currentFocus].click(); // Clica na caixa selecionada
                }
            }
        });
    }

    function addActive(boxes) {
        if (!boxes) return false;
        
        // Remove a classe de todos
        for (let i = 0; i < boxes.length; i++) {
            boxes[i].classList.remove('result-active');
        }

        // Lógica de Loop (Fim volta pro começo)
        if (currentFocus >= boxes.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (boxes.length - 1);

        // Adiciona a classe na CAIXA (Box) correta
        boxes[currentFocus].classList.add('result-active');
        
        // Garante que a caixa esteja visível na rolagem
        boxes[currentFocus].scrollIntoView({block: 'nearest', inline: 'start'});
    }

// ==========================================
// FUNÇÕES GLOBAIS DE ACESSO (Janela)
// ==========================================

window.fazerLogin = async function() {
    const input = document.getElementById('input-pin');
    const btn = document.getElementById('btn-entrar');
    const msgErro = document.getElementById('msg-erro');

    if (!input || input.value.trim() === "") return;

    // --- MUDANÇA AQUI: Salva o ícone (HTML) e põe a engrenagem ---
    const htmlOriginal = btn ? btn.innerHTML : "";
    if (btn) { 
        btn.innerHTML = '<i class="fas fa-cog fa-spin"></i>'; 
        btn.disabled = true; 
    }

    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('pin', input.value)
            .eq('ativo', true)
            .single();

        if (error || !data) throw new Error("Senha inválida");

        sessionStorage.setItem('usuario_atual', JSON.stringify(data));
        
        if (document.getElementById('overlay-login')) 
            document.getElementById('overlay-login').style.display = 'none';
        
        if (document.getElementById('nome-operador-tela')) 
            document.getElementById('nome-operador-tela').textContent = data.nome.split(' ')[0];
        
        input.value = ""; 

    } catch (err) {
        input.classList.add('input-erro');
        if (msgErro) msgErro.classList.add('visivel');
        input.value = "";
        setTimeout(() => input.focus(), 100);
    } finally {
        // --- MUDANÇA AQUI: Restaura o ícone original (HTML) ---
        if (btn) { 
            btn.innerHTML = htmlOriginal; 
            btn.disabled = false; 
        }
    }
};

window.fazerLogout = function() {
    sessionStorage.removeItem('usuario_atual');
    location.reload(); // Recarrega para bloquear tudo limpo
};


});

