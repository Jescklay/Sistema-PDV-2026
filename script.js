/* ========================================================
   CONFIGURAÇÃO DO FIREBASE (SUBSTITUA PELAS SUAS CHAVES)
   ======================================================== */
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "seu-projeto.firebaseapp.com",
    databaseURL: "https://seu-projeto-default-rtdb.firebaseio.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:00000:web:00000"
};

// Inicializa o Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const cartRef = db.ref('isabelvariedades/cart');

const DEFAULT_PRODUCTS = [
    { id: "1", barcode: "7891000100101", name: "Arroz Tipo 1 5kg", category: "Mercearia", priceRetail: 28.90, priceWholesale: 26.50, stock: 45 },
    { id: "2", barcode: "7891000200202", name: "Feijão Preto 1kg", category: "Mercearia", priceRetail: 8.50, priceWholesale: 7.90, stock: 60 },
    { id: "3", barcode: "7891000300303", name: "Óleo de Soja 900ml", category: "Mercearia", priceRetail: 6.80, priceWholesale: 6.20, stock: 80 },
    { id: "4", barcode: "7891000400404", name: "Leite Integral 1L", category: "Laticínios", priceRetail: 4.99, priceWholesale: 4.50, stock: 120 },
    { id: "5", barcode: "7891000500505", name: "Café Torrado e Moído 500g", category: "Mercearia", priceRetail: 16.90, priceWholesale: 15.20, stock: 35 },
    { id: "6", barcode: "7891000600606", name: "Açúcar Refinado 1kg", category: "Mercearia", priceRetail: 4.20, priceWholesale: 3.80, stock: 90 },
    { id: "7", barcode: "7891000700707", name: "Detergente Líquido 500ml", category: "Limpeza", priceRetail: 2.49, priceWholesale: 2.10, stock: 150 },
    { id: "8", barcode: "7891000800808", name: "Refrigerante Cola 2L", category: "Bebidas", priceRetail: 9.90, priceWholesale: 8.90, stock: 8 },
    { id: "9", barcode: "7891000900909", name: "Pão de Forma Tradicional", category: "Padaria", priceRetail: 7.49, priceWholesale: 6.80, stock: 25 },
    { id: "10", barcode: "7891001001010", name: "Sabonete Suave 90g", category: "Higiene", priceRetail: 2.19, priceWholesale: 1.89, stock: 4 }
];

let products = [];
let salesHistory = [];
let currentCart = [];
let cashMovements = [];

let activeDiscount = { type: 'fixed', value: 0 };
let selectedPaymentMethod = 'dinheiro';
let lastSaleRecord = null;
let html5QrCodeScanner = null;
let audioCtx = null;

window.onload = function() {
    loadInitialData();
    setupEventListeners();
    checkMobileDevice();
    setupCloudCartListener();
    renderCartUI();
    renderInventoryTable();
    renderHistoryTable();
    renderCashierView();
    
    // Libera a política de autoplay de áudio no primeiro toque/clique
    document.addEventListener('touchstart', initAudioContext, { once: true });
    document.addEventListener('click', initAudioContext, { once: true });

    const searchInput = document.getElementById('pdv-search-input');
    if(searchInput) searchInput.focus();
};

/* ========================================================
   VERIFICAÇÃO DE DISPOSITIVO MÓVEL PARA BOTÃO DE CÂMERA
   ======================================================== */
function checkMobileDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const cameraBtn = document.getElementById('btn-camera-scanner');
    if (cameraBtn) {
        if (isMobile) {
            cameraBtn.classList.remove('hidden');
            cameraBtn.classList.add('flex');
        } else {
            cameraBtn.classList.add('hidden');
            cameraBtn.classList.remove('flex');
        }
    }
}

function loadInitialData() {
    const savedProducts = localStorage.getItem('isabel_products');
    products = savedProducts ? JSON.parse(savedProducts) : DEFAULT_PRODUCTS;

    const savedSales = localStorage.getItem('isabel_sales');
    salesHistory = savedSales ? JSON.parse(savedSales) : [];

    const savedCash = localStorage.getItem('isabel_cash');
    cashMovements = savedCash ? JSON.parse(savedCash) : [
        { id: Date.now(), time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}), type: 'suprimento', amount: 150.00, note: 'Abertura de caixa (Fundo de Troco)' }
    ];

    const savedDiscount = localStorage.getItem('isabel_discount');
    activeDiscount = savedDiscount ? JSON.parse(savedDiscount) : { type: 'fixed', value: 0 };
}

function saveStateToStorage() {
    localStorage.setItem('isabel_products', JSON.stringify(products));
    localStorage.setItem('isabel_sales', JSON.stringify(salesHistory));
    localStorage.setItem('isabel_cash', JSON.stringify(cashMovements));
    localStorage.setItem('isabel_discount', JSON.stringify(activeDiscount));
}

/* ========================================================
   SINCRONIZAÇÃO EM TEMPO REAL COM FIREBASE (CORRIGIDA)
   ======================================================== */
function setupCloudCartListener() {
    const syncPill = document.getElementById('cloud-sync-pill');
    
    // Escuta alterações na nuvem em tempo real (disparado para PC e Celular)
    cartRef.on('value', (snapshot) => {
        const cloudCart = snapshot.val();
        currentCart = Array.isArray(cloudCart) ? cloudCart : [];
        renderCartUI();
        
        if(syncPill) {
            syncPill.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
            syncPill.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span class="hidden sm:inline">Nuvem Sincronizada</span>`;
        }
    }, (error) => {
        console.error("Erro na sincronização Firebase:", error);
        if(syncPill) {
            syncPill.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20";
            syncPill.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="hidden sm:inline">Erro Conexão Nuvem</span>`;
        }
    });
}

function updateCloudCart() {
    // Garante gravação imediata no banco em tempo real do Firebase
    cartRef.set(currentCart).catch(err => {
        console.error("Erro ao atualizar carrinho na nuvem:", err);
        showNotification("Erro ao sincronizar carrinho na nuvem.", "error");
    });
}

/* ========================================================
   SINTETIZADOR DE BIP SONORO (WEB AUDIO API CORRIGIDO MÓVEL)
   ======================================================== */
function initAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playBeepSound() {
    try {
        initAudioContext();
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime); // Frequência aguda de scanner de caixa
        
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        console.log("Falha ao sintetizar áudio no navegador:", e);
    }
}

/* ========================================================
   NAVEGAÇÃO DE ABAS CORRIGIDA PARA DESKTOP E MÓVEL
   ======================================================== */
function switchTab(tabKey) {
    // Oculta todas as telas
    document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));

    // Reseta estado ativo dos botões desktop
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-brand-600', 'text-white', 'shadow');
        btn.classList.add('text-slate-400');
    });

    // Reseta estado ativo dos botões mobile
    document.querySelectorAll('.mob-tab-btn').forEach(btn => {
        btn.classList.remove('bg-brand-600', 'text-white');
        btn.classList.add('text-slate-400');
    });

    // Exibe a tela selecionada
    const activeView = document.getElementById(`view-${tabKey}`);
    if(activeView) activeView.classList.remove('hidden');

    // Ativa botão desktop
    const activeDesktopBtn = document.getElementById(`tab-btn-${tabKey}`);
    if(activeDesktopBtn) {
        activeDesktopBtn.classList.add('bg-brand-600', 'text-white', 'shadow');
        activeDesktopBtn.classList.remove('text-slate-400');
    }

    // Ativa botão mobile
    const activeMobileBtn = document.getElementById(`mob-btn-${tabKey}`);
    if(activeMobileBtn) {
        activeMobileBtn.classList.add('bg-brand-600', 'text-white');
        activeMobileBtn.classList.remove('text-slate-400');
    }

    // Renderiza dados específicos da aba
    if(tabKey === 'pdv') {
        setTimeout(() => {
            const input = document.getElementById('pdv-search-input');
            if(input) input.focus();
        }, 100);
    } else if(tabKey === 'inventory') {
        renderInventoryTable();
    } else if(tabKey === 'history') {
        renderHistoryTable();
    } else if(tabKey === 'cashier') {
        renderCashierView();
    }
}

function setupEventListeners() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F5' || (e.key === 'r' && (e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            showNotification('Recarregamento da página bloqueado no PDV!', 'error');
            return;
        }

        if (e.key === 'F1') {
            e.preventDefault();
            switchTab('pdv');
        } else if (e.key === 'F2') {
            e.preventDefault();
            if(currentCart.length > 0) openPaymentModal();
        } else if (e.key === 'F4') {
            e.preventDefault();
            clearCartConfirm();
        } else if (e.key === 'F8') {
            e.preventDefault();
            openDiscountModal();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeAllModals();
        }
    });

    const pdvInput = document.getElementById('pdv-search-input');
    if(pdvInput) {
        pdvInput.addEventListener('input', handlePDVInputSearch);
        pdvInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleManualAddProduct();
            }
        });
    }

    const formInputs = document.querySelectorAll('#product-form input, #product-form select');
    formInputs.forEach((input, index) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const nextInput = formInputs[index + 1];
                if (nextInput) {
                    nextInput.focus();
                } else {
                    document.getElementById('product-form').requestSubmit();
                }
            }
        });
    });

    const whatsappInput = document.getElementById('whatsapp-phone-input');
    if (whatsappInput) {
        whatsappInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmSendWhatsApp();
            }
        });
    }

    window.addEventListener('resize', checkMobileDevice);
}

/* ========================================================
   SCANNER DE CÂMERA MOBILE COM BIPE SONORO
   ======================================================== */
function startCameraScanner() {
    initAudioContext();
    const modal = document.getElementById('modal-camera-scanner');
    modal.classList.remove('hidden');

    if (!html5QrCodeScanner) {
        html5QrCodeScanner = new Html5Qrcode("camera-reader-container");
    }

    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    html5QrCodeScanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess
    ).catch(err => {
        console.error("Erro ao iniciar câmera:", err);
        showNotification("Erro ao acessar a câmera do dispositivo.", "error");
        stopCameraScanner();
    });
}

let isProcessingScan = false;
function onScanSuccess(decodedText, decodedResult) {
    if (decodedText && !isProcessingScan) {
        isProcessingScan = true;

        playBeepSound();

        const product = products.find(p => p.barcode === decodedText || p.name.toLowerCase() === decodedText.toLowerCase());

        if(product) {
            addProductToCart(product, 1);
            showNotification(`Escaneado: ${product.name}`, "success");
        } else {
            showNotification(`Produto não cadastrado: ${decodedText}`, "error");
        }

        setTimeout(() => { isProcessingScan = false; }, 1200);
    }
}

function stopCameraScanner() {
    if (html5QrCodeScanner && html5QrCodeScanner.isScanning) {
        html5QrCodeScanner.stop().then(() => {
            document.getElementById('modal-camera-scanner').classList.add('hidden');
        }).catch(err => {
            console.error("Erro ao parar câmera:", err);
            document.getElementById('modal-camera-scanner').classList.add('hidden');
        });
    } else {
        document.getElementById('modal-camera-scanner').classList.add('hidden');
    }
}

/* ========================================================
   GERADOR DE ETIQUETAS FOLHA A4 (JSBARCODE)
   ======================================================== */
function openLabelsModal() {
    const container = document.getElementById('labels-a4-preview');
    const modal = document.getElementById('modal-labels-print');

    if (products.length === 0) {
        showNotification("Nenhum produto cadastrado para gerar etiquetas.", "error");
        return;
    }

    container.innerHTML = `
        <div class="a4-grid">
            ${products.map(p => `
                <div class="label-card">
                    <div class="font-bold text-xs truncate max-w-[180px] text-slate-800">${p.name}</div>
                    <svg id="barcode-svg-${p.id}" class="my-1"></svg>
                    <div class="text-xs font-bold text-brand-600 font-mono-num">R$ ${p.priceRetail.toFixed(2)}</div>
                </div>
            `).join('')}
        </div>
    `;

    modal.classList.remove('hidden');

    setTimeout(() => {
        products.forEach(p => {
            try {
                JsBarcode(`#barcode-svg-${p.id}`, p.barcode, {
                    format: "EAN13",
                    width: 1.5,
                    height: 40,
                    displayValue: true,
                    fontSize: 10,
                    margin: 2
                });
            } catch (err) {
                JsBarcode(`#barcode-svg-${p.id}`, p.barcode, {
                    format: "CODE128",
                    width: 1.5,
                    height: 40,
                    displayValue: true,
                    fontSize: 10,
                    margin: 2
                });
            }
        });
    }, 100);
}

/* ========================================================
   LÓGICA DO PDV E CARRINHO (NUVEM)
   ======================================================== */
function handlePDVInputSearch(e) {
    const query = e.target.value.trim().toLowerCase();
    const suggestionsContainer = document.getElementById('product-suggestions');

    if (query.length < 2) {
        suggestionsContainer.classList.add('hidden');
        return;
    }

    const matches = products.filter(p => 
        p.name.toLowerCase().includes(query) || p.barcode.includes(query)
    ).slice(0, 5);

    if (matches.length > 0) {
        suggestionsContainer.innerHTML = matches.map(p => `
            <div onclick="selectProductFromSuggestion('${p.id}')" class="p-2 hover:bg-slate-700/60 rounded cursor-pointer flex justify-between items-center text-xs">
                <div>
                    <span class="font-bold text-white">${p.name}</span>
                    <span class="text-slate-400 text-[10px] block font-mono-num">EAN: ${p.barcode} | Estq: ${p.stock}</span>
                </div>
                <span class="text-brand-400 font-bold font-mono-num">R$ ${p.priceRetail.toFixed(2)}</span>
            </div>
        `).join('');
        suggestionsContainer.classList.remove('hidden');
    } else {
        suggestionsContainer.classList.add('hidden');
    }
}

function selectProductFromSuggestion(productId) {
    const product = products.find(p => p.id === productId);
    if(product) {
        addProductToCart(product);
        clearPDVSearch();
    }
}

function handleManualAddProduct() {
    const input = document.getElementById('pdv-search-input');
    const qtyInput = document.getElementById('pdv-qty-input');
    const query = input.value.trim();
    const qty = parseFloat(qtyInput.value) || 1;

    if(!query) return;

    const product = products.find(p => p.barcode === query || p.name.toLowerCase() === query.toLowerCase());

    if(product) {
        addProductToCart(product, qty);
        clearPDVSearch();
    } else {
        showNotification('Produto não encontrado com este código ou nome!', 'error');
    }
}

function clearPDVSearch() {
    const input = document.getElementById('pdv-search-input');
    const qtyInput = document.getElementById('pdv-qty-input');
    const sug = document.getElementById('product-suggestions');
    
    if(input) input.value = '';
    if(qtyInput) qtyInput.value = '1';
    if(sug) sug.classList.add('hidden');
    if(input) input.focus();
}

function addProductToCart(product, qty = 1) {
    if(product.stock <= 0) {
        showNotification(`Atenção: O produto "${product.name}" está sem estoque!`, 'error');
    }

    const existingIndex = currentCart.findIndex(item => item.product.id === product.id);

    if(existingIndex > -1) {
        currentCart[existingIndex].qty += qty;
        currentCart[existingIndex].total = currentCart[existingIndex].qty * currentCart[existingIndex].price;
    } else {
        currentCart.push({
            product: product,
            qty: qty,
            price: product.priceRetail,
            total: qty * product.priceRetail
        });
    }

    updateCloudCart();
    renderCartUI();
}

function removeFromCart(index) {
    currentCart.splice(index, 1);
    updateCloudCart();
    renderCartUI();
}

function updateCartItemQty(index, newQty) {
    const qty = parseFloat(newQty);
    if(isNaN(qty) || qty <= 0) {
        removeFromCart(index);
        return;
    }

    currentCart[index].qty = qty;
    currentCart[index].total = currentCart[index].qty * currentCart[index].price;
    updateCloudCart();
    renderCartUI();
}

function clearCartConfirm() {
    if(currentCart.length === 0) return;
    document.getElementById('modal-clear-cart').classList.remove('hidden');
}

function executeClearCart() {
    currentCart = [];
    activeDiscount = { type: 'fixed', value: 0 };
    saveStateToStorage();
    updateCloudCart();
    renderCartUI();
    closeModal('modal-clear-cart');
}

function renderCartUI() {
    const tbody = document.getElementById('cart-items-tbody');
    const emptyState = document.getElementById('cart-empty-state');
    const itemCountEl = document.getElementById('cart-item-count');
    const finishBtn = document.getElementById('btn-finish-sale');

    if(!tbody) return;

    itemCountEl.textContent = `${currentCart.length} item(s)`;

    if(currentCart.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        finishBtn.disabled = true;
        updateTotalsSummary(0);
        return;
    }

    emptyState.classList.add('hidden');
    finishBtn.disabled = false;

    let subtotal = 0;

    tbody.innerHTML = currentCart.map((item, idx) => {
        subtotal += item.total;
        return `
            <tr class="hover:bg-slate-800/50 transition">
                <td class="py-2.5 px-2 font-mono-num text-slate-400">${idx + 1}</td>
                <td class="py-2.5 px-2 font-mono-num text-slate-400 text-xs">${item.product.barcode}</td>
                <td class="py-2.5 px-2 font-semibold text-slate-100">${item.product.name}</td>
                <td class="py-2.5 px-2 text-right">
                    <input type="number" step="any" min="0.1" value="${item.qty}" 
                        onchange="updateCartItemQty(${idx}, this.value)"
                        class="w-16 bg-slate-950 border border-slate-700 rounded text-center text-xs py-1 font-mono-num text-slate-200">
                </td>
                <td class="py-2.5 px-2 text-right font-mono-num text-slate-300">R$ ${item.price.toFixed(2)}</td>
                <td class="py-2.5 px-2 text-right font-mono-num font-bold text-brand-400">R$ ${item.total.toFixed(2)}</td>
                <td class="py-2.5 px-2 text-center">
                    <button onclick="removeFromCart(${idx})" class="text-slate-500 hover:text-rose-400 transition">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    updateTotalsSummary(subtotal);
}

function updateTotalsSummary(subtotal) {
    let discountValue = 0;
    if (activeDiscount.type === 'fixed') {
        discountValue = activeDiscount.value;
    } else {
        discountValue = subtotal * (activeDiscount.value / 100);
    }

    if(discountValue > subtotal) discountValue = subtotal;

    const grandTotal = Math.max(0, subtotal - discountValue);

    document.getElementById('summary-subtotal').textContent = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('summary-discount').textContent = `- R$ ${discountValue.toFixed(2)}`;
    document.getElementById('summary-total').textContent = `R$ ${grandTotal.toFixed(2)}`;
    document.getElementById('modal-pay-total').textContent = `R$ ${grandTotal.toFixed(2)}`;
}

function openDiscountModal() {
    document.getElementById('modal-discount').classList.remove('hidden');
    document.getElementById('discount-input-value').value = activeDiscount.value > 0 ? activeDiscount.value : '';
    setTimeout(() => document.getElementById('discount-input-value').focus(), 100);
}

function setDiscountType(type) {
    activeDiscount.type = type;
    const btnFixed = document.getElementById('disc-type-fixed');
    const btnPercent = document.getElementById('disc-type-percent');

    if(type === 'fixed') {
        btnFixed.className = "py-2 text-xs font-bold rounded-lg border border-brand-500 bg-brand-500/10 text-brand-400";
        btnPercent.className = "py-2 text-xs font-bold rounded-lg border border-slate-800 bg-slate-950 text-slate-400";
    } else {
        btnPercent.className = "py-2 text-xs font-bold rounded-lg border border-brand-500 bg-brand-500/10 text-brand-400";
        btnFixed.className = "py-2 text-xs font-bold rounded-lg border border-slate-800 bg-slate-950 text-slate-400";
    }
}

function applyDiscountAndClose() {
    const val = parseFloat(document.getElementById('discount-input-value').value) || 0;
    activeDiscount.value = val;
    saveStateToStorage();
    renderCartUI();
    closeModal('modal-discount');
}

function openPaymentModal() {
    if(currentCart.length === 0) return;
    document.getElementById('modal-payment').classList.remove('hidden');
    selectPaymentMethod('dinheiro');
    
    const subtotal = currentCart.reduce((acc, i) => acc + i.total, 0);
    let discountValue = activeDiscount.type === 'fixed' ? activeDiscount.value : subtotal * (activeDiscount.value / 100);
    const total = Math.max(0, subtotal - discountValue);

    document.getElementById('pay-amount-paid').value = total.toFixed(2);
    document.getElementById('pix-display-total').textContent = `R$ ${total.toFixed(2)}`;
    calculateChange();
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;

    document.querySelectorAll('.pay-method-btn').forEach(btn => {
        btn.classList.remove('border-2', 'border-brand-500', 'bg-brand-500/10', 'text-white');
        btn.classList.add('border-slate-800', 'bg-slate-950', 'text-slate-400');
    });

    const activeBtn = document.getElementById(`pay-method-${method}`);
    if(activeBtn) {
        activeBtn.classList.remove('border-slate-800', 'bg-slate-950', 'text-slate-400');
        activeBtn.classList.add('border-2', 'border-brand-500', 'bg-brand-500/10', 'text-white');
    }

    const cashSection = document.getElementById('pay-section-cash');
    const pixSection = document.getElementById('pay-section-pix');
    const confirmBtn = document.getElementById('btn-confirm-payment');

    if(method === 'dinheiro') {
        cashSection.classList.remove('hidden');
        pixSection.classList.add('hidden');
        confirmBtn.disabled = false;
    } else if(method === 'pix') {
        cashSection.classList.add('hidden');
        pixSection.classList.remove('hidden');
        confirmBtn.disabled = false;
        
        const subtotal = currentCart.reduce((acc, i) => acc + i.total, 0);
        let discountValue = activeDiscount.type === 'fixed' ? activeDiscount.value : subtotal * (activeDiscount.value / 100);
        const total = Math.max(0, subtotal - discountValue);
        document.getElementById('pix-display-total').textContent = `R$ ${total.toFixed(2)}`;
    }
}

function calculateChange() {
    const subtotal = currentCart.reduce((acc, i) => acc + i.total, 0);
    let discountValue = activeDiscount.type === 'fixed' ? activeDiscount.value : subtotal * (activeDiscount.value / 100);
    const grandTotal = Math.max(0, subtotal - discountValue);

    const paid = parseFloat(document.getElementById('pay-amount-paid').value) || 0;
    const change = Math.max(0, paid - grandTotal);

    document.getElementById('pay-change-amount').textContent = `R$ ${change.toFixed(2)}`;
}

function copyProductBarcode(barcode) {
    navigator.clipboard.writeText(barcode).then(() => {
        showNotification(`Código ${barcode} copiado com sucesso!`, 'success');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        showNotification('Erro ao copiar código.', 'error');
    });
}

function executeSaleFinalization() {
    const subtotal = currentCart.reduce((acc, i) => acc + i.total, 0);
    let discountValue = activeDiscount.type === 'fixed' ? activeDiscount.value : subtotal * (activeDiscount.value / 100);
    const grandTotal = Math.max(0, subtotal - discountValue);
    const customerCpf = document.getElementById('pdv-customer-cpf').value.trim();

    let amountPaid = grandTotal;
    let changeAmount = 0;

    if(selectedPaymentMethod === 'dinheiro') {
        amountPaid = parseFloat(document.getElementById('pay-amount-paid').value) || 0;
        if(amountPaid < grandTotal) {
            showNotification('Valor recebido é menor que o total da compra!', 'error');
            return;
        }
        changeAmount = Math.max(0, amountPaid - grandTotal);
    }

    let formattedPayment = selectedPaymentMethod === 'dinheiro' ? 'DINHEIRO' : 'PIX QR CODE';

    const saleRecord = {
        id: 'VND-' + Math.floor(100000 + Math.random() * 900000),
        timestamp: new Date().toISOString(),
        dateStr: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        items: currentCart.map(item => ({
            productId: item.product.id,
            name: item.product.name,
            qty: item.qty,
            price: item.price,
            total: item.total
        })),
        subtotal: subtotal,
        discount: discountValue,
        total: grandTotal,
        paymentMethod: formattedPayment,
        amountPaid: amountPaid,
        changeAmount: changeAmount,
        customerCpf: customerCpf || null
    };

    lastSaleRecord = saleRecord;

    currentCart.forEach(cartItem => {
        const prod = products.find(p => p.id === cartItem.product.id);
        if(prod) {
            prod.stock = Math.max(0, prod.stock - cartItem.qty);
        }
    });

    cashMovements.unshift({
        id: Date.now(),
        time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
        type: 'venda',
        amount: grandTotal,
        note: `Venda via ${saleRecord.paymentMethod} ${saleRecord.id}`
    });

    salesHistory.unshift(saleRecord);

    currentCart = [];
    activeDiscount = { type: 'fixed', value: 0 };
    saveStateToStorage();
    updateCloudCart();

    setupReceiptModal(saleRecord);
    const cpfInput = document.getElementById('pdv-customer-cpf');
    if(cpfInput) cpfInput.value = '';
    
    closeModal('modal-payment');
    renderCartUI();
    renderInventoryTable();
    renderHistoryTable();
    renderCashierView();

    document.getElementById('modal-receipt').classList.remove('hidden');
}

function setupReceiptModal(sale) {
    lastSaleRecord = sale;
    document.getElementById('rec-date-time').textContent = sale.dateStr;
    document.getElementById('rec-id').textContent = `DOC: #${sale.id}`;
    document.getElementById('rec-subtotal').textContent = `R$ ${sale.subtotal.toFixed(2)}`;
    document.getElementById('rec-discount').textContent = `R$ ${sale.discount.toFixed(2)}`;
    document.getElementById('rec-total').textContent = `R$ ${sale.total.toFixed(2)}`;
    document.getElementById('rec-payment-method').textContent = sale.paymentMethod;

    const cashDetailsEl = document.getElementById('rec-cash-payment-details');
    if (sale.paymentMethod === 'DINHEIRO' && sale.amountPaid !== undefined) {
        document.getElementById('rec-amount-paid').textContent = `R$ ${sale.amountPaid.toFixed(2)}`;
        document.getElementById('rec-amount-change').textContent = `R$ ${sale.changeAmount.toFixed(2)}`;
        cashDetailsEl.classList.remove('hidden');
    } else {
        cashDetailsEl.classList.add('hidden');
    }

    if(sale.customerCpf) {
        document.getElementById('rec-cpf-row').classList.remove('hidden');
        document.getElementById('rec-cpf').textContent = sale.customerCpf;
    } else {
        document.getElementById('rec-cpf-row').classList.add('hidden');
    }

    const itemsContainer = document.getElementById('rec-items-list');
    itemsContainer.innerHTML = sale.items.map(item => `
        <div class="flex justify-between text-[11px]">
            <span class="truncate max-w-[180px]">${item.name}</span>
            <span>${item.qty}x R$ ${item.price.toFixed(2)} = R$ ${item.total.toFixed(2)}</span>
        </div>
    `).join('');
}

function openWhatsAppModal() {
    if (!lastSaleRecord) {
        showNotification('Nenhum recibo ativo para envio.', 'error');
        return;
    }
    const phoneInput = document.getElementById('whatsapp-phone-input');
    phoneInput.value = '';
    document.getElementById('modal-whatsapp').classList.remove('hidden');
    setTimeout(() => phoneInput.focus(), 100);
}

function confirmSendWhatsApp() {
    const phoneInput = document.getElementById('whatsapp-phone-input').value.trim();
    if (!phoneInput) {
        showNotification('Por favor, informe o número do WhatsApp.', 'error');
        return;
    }

    let cleanPhone = phoneInput.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone;
    }

    let itemsText = lastSaleRecord.items.map(i => `▪ ${i.qty}x ${i.name} - R$ ${i.total.toFixed(2)}`).join('\n');

    let cashInfoText = '';
    if (lastSaleRecord.paymentMethod === 'DINHEIRO' && lastSaleRecord.amountPaid !== undefined) {
        cashInfoText = `Valor Recebido: R$ ${lastSaleRecord.amountPaid.toFixed(2)}\n` +
                       `Troco: R$ ${lastSaleRecord.changeAmount.toFixed(2)}\n`;
    }

    let message = `🛒 *ISABEL VARIEDADES*\n` +
                  `📄 *Cupom:* #${lastSaleRecord.id}\n` +
                  `📅 *Data:* ${lastSaleRecord.dateStr}\n\n` +
                  `*Itens da Compra:*\n${itemsText}\n\n` +
                  `---------------------------\n` +
                  `Subtotal: R$ ${lastSaleRecord.subtotal.toFixed(2)}\n` +
                  `Desconto: R$ ${lastSaleRecord.discount.toFixed(2)}\n` +
                  `*TOTAL: R$ ${lastSaleRecord.total.toFixed(2)}*\n` +
                  `💳 *Forma de Pagto:* ${lastSaleRecord.paymentMethod}\n` +
                  cashInfoText +
                  (lastSaleRecord.customerCpf ? `👤 *CPF:* ${lastSaleRecord.customerCpf}\n` : '') +
                  `---------------------------\n` +
                  `Obrigado pela preferência! Volte sempre! ✨`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    
    closeModal('modal-whatsapp');
}

/* ========================================================
   ESTOQUE & CONTADOR DINÂMICO DE PRODUTOS (CORRIGIDO)
   ======================================================== */
function renderInventoryTable() {
    const tbody = document.getElementById('inventory-tbody');
    const searchEl = document.getElementById('inventory-search');
    const categoryFilterEl = document.getElementById('inventory-category-filter');
    const totalCounterEl = document.getElementById('inventory-total-counter');
    
    // Atualiza o contador com o total real de produtos carregados
    if(totalCounterEl) {
        totalCounterEl.textContent = `Total de produtos cadastrados: ${products.length}`;
    }

    if(!tbody || !searchEl || !categoryFilterEl) return;

    const search = searchEl.value.toLowerCase();
    const categoryFilter = categoryFilterEl.value;

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search) || p.barcode.includes(search);
        const matchesCategory = !categoryFilter || p.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    if(filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-500 text-xs">Nenhum produto encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        let statusBadge = '';
        if(p.stock <= 0) {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Sem Estoque</span>`;
        } else if(p.stock <= 10) {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Estoque Baixo</span>`;
        } else {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Normal</span>`;
        }

        return `
            <tr class="hover:bg-slate-800/40 transition">
                <td class="py-3 px-4 font-mono-num text-xs text-slate-300">
                    <div class="flex items-center gap-2">
                        <span>${p.barcode}</span>
                        <button onclick="copyProductBarcode('${p.barcode}')" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition" title="Copiar código">
                            <i class="fa-regular fa-copy text-xs"></i>
                        </button>
                    </div>
                </td>
                <td class="py-3 px-4 font-semibold text-slate-200">${p.name}</td>
                <td class="py-3 px-4 text-xs text-slate-400">${p.category}</td>
                <td class="py-3 px-4 text-right font-mono-num font-bold text-slate-200">R$ ${p.priceRetail.toFixed(2)}</td>
                <td class="py-3 px-4 text-right font-mono-num text-slate-400">R$ ${(p.priceWholesale || p.priceRetail).toFixed(2)}</td>
                <td class="py-3 px-4 text-center font-mono-num font-bold text-white">${p.stock}</td>
                <td class="py-3 px-4 text-center">${statusBadge}</td>
                <td class="py-3 px-4 text-center space-x-2">
                    <button onclick="openProductModal('${p.id}')" class="text-slate-400 hover:text-brand-400 text-xs transition" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="deleteProduct('${p.id}')" class="text-slate-400 hover:text-rose-400 text-xs transition" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function openProductModal(productId = null) {
    const modal = document.getElementById('modal-product');
    const title = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');
    
    form.reset();
    document.getElementById('prod-id').value = '';

    if(productId) {
        const prod = products.find(p => p.id === productId);
        if(!prod) return;
        title.textContent = 'Editar Produto';
        document.getElementById('prod-id').value = prod.id;
        document.getElementById('prod-barcode').value = prod.barcode;
        document.getElementById('prod-name').value = prod.name;
        document.getElementById('prod-category').value = prod.category;
        document.getElementById('prod-stock').value = prod.stock;
        document.getElementById('prod-price-retail').value = prod.priceRetail.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('prod-price-wholesale').value = prod.priceWholesale ? prod.priceWholesale.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
    } else {
        title.textContent = 'Cadastrar Novo Produto';
    }

    modal.classList.remove('hidden');
}

function formatCurrencyInput(input) {
    let value = input.value.replace(/\D/g, '');
    if (!value) {
        input.value = '';
        return;
    }
    let number = parseFloat(value) / 100;
    input.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrencyToFloat(currencyString) {
    if (!currencyString) return 0;
    let clean = currencyString.replace(/[^\d]/g, '');
    return parseFloat(clean) / 100;
}

function saveProductForm(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const barcode = document.getElementById('prod-barcode').value.trim();
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value;
    const stock = parseFloat(document.getElementById('prod-stock').value) || 0;
    
    const retailStr = document.getElementById('prod-price-retail').value;
    const wholesaleStr = document.getElementById('prod-price-wholesale').value;
    
    const priceRetail = parseCurrencyToFloat(retailStr);
    const priceWholesale = wholesaleStr ? parseCurrencyToFloat(wholesaleStr) : priceRetail;

    if (!barcode || !name || priceRetail <= 0) {
        showNotification('Por favor, preencha todos os campos obrigatórios corretamente.', 'error');
        return;
    }

    if(id) {
        const prod = products.find(p => p.id === id);
        if(prod) {
            prod.barcode = barcode;
            prod.name = name;
            prod.category = category;
            prod.stock = stock;
            prod.priceRetail = priceRetail;
            prod.priceWholesale = priceWholesale;
        }
    } else {
        products.unshift({
            id: String(Date.now()),
            barcode,
            name,
            category,
            stock,
            priceRetail,
            priceWholesale
        });
    }

    saveStateToStorage();
    renderInventoryTable();
    
    document.getElementById('product-form').reset();
    closeModal('modal-product');
    showNotification('Produto salvo com sucesso!', 'success');
}

function showNotification(message, type = 'success') {
    const existingToast = document.getElementById('system-toast');
    if(existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'system-toast';
    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold text-white flex items-center gap-2 transition-all duration-300 transform translate-y-2 opacity-0 ${
        type === 'success' ? 'bg-emerald-600 border border-emerald-500' : 'bg-rose-600 border border-rose-500'
    }`;
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-sm"></i> <span>${message}</span>`;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function deleteProduct(productId) {
    if(confirm('Tem certeza que deseja excluir este produto do estoque?')) {
        products = products.filter(p => p.id !== productId);
        saveStateToStorage();
        renderInventoryTable();
    }
}

function renderHistoryTable() {
    const tbody = document.getElementById('history-tbody');
    const filterDateEl = document.getElementById('history-date-filter');
    
    if(!tbody || !filterDateEl) return;
    const filterDate = filterDateEl.value;

    let filtered = salesHistory;
    if(filterDate) {
        const formattedDate = filterDate.split('-').reverse().join('/');
        filtered = salesHistory.filter(s => s.dateStr.includes(formattedDate));
    }

    updateDashboardCards(filtered);

    if(filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500 text-xs">Nenhuma venda registrada até o momento.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(sale => `
        <tr class="hover:bg-slate-800/40 transition">
            <td class="py-3 px-4 font-mono-num font-bold text-brand-400 text-xs">${sale.id}</td>
            <td class="py-3 px-4 text-xs text-slate-300">${sale.dateStr}</td>
            <td class="py-3 px-4 font-mono-num text-xs text-slate-400">${sale.customerCpf || '-'}</td>
            <td class="py-3 px-4 text-xs font-semibold text-slate-200">${sale.paymentMethod}</td>
            <td class="py-3 px-4 text-right font-mono-num text-xs text-slate-300">${sale.items.length}</td>
            <td class="py-3 px-4 text-right font-mono-num font-bold text-white">R$ ${sale.total.toFixed(2)}</td>
            <td class="py-3 px-4 text-center">
                <button onclick='reprintReceipt(${JSON.stringify(sale).replace(/'/g, "&apos;")})' class="text-slate-400 hover:text-white text-xs transition" title="Ver / Imprimir Cupom">
                    <i class="fa-solid fa-receipt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function clearHistoryFilter() {
    document.getElementById('history-date-filter').value = '';
    renderHistoryTable();
}

function updateDashboardCards(sales) {
    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    const salesCount = sales.length;
    const avgTicket = salesCount > 0 ? totalRevenue / salesCount : 0;

    const productQtyMap = {};
    sales.forEach(sale => {
        sale.items.forEach(item => {
            productQtyMap[item.name] = (productQtyMap[item.name] || 0) + item.qty;
        });
    });

    let topProduct = '-';
    let maxQty = 0;
    for(const [name, qty] of Object.entries(productQtyMap)) {
        if(qty > maxQty) {
            maxQty = qty;
            topProduct = name;
        }
    }

    const revEl = document.getElementById('dash-total-revenue');
    const cntEl = document.getElementById('dash-sales-count');
    const tckEl = document.getElementById('dash-avg-ticket');
    const topEl = document.getElementById('dash-top-product');

    if(revEl) revEl.textContent = `R$ ${totalRevenue.toFixed(2)}`;
    if(cntEl) cntEl.textContent = salesCount;
    if(tckEl) tckEl.textContent = `R$ ${avgTicket.toFixed(2)}`;
    if(topEl) topEl.textContent = topProduct;
}

function reprintReceipt(sale) {
    setupReceiptModal(sale);
    document.getElementById('modal-receipt').classList.remove('hidden');
}

function renderCashierView() {
    const initialFund = cashMovements.filter(m => m.type === 'suprimento' && m.note && m.note.includes('Abertura')).reduce((a,b) => a + b.amount, 0);
    const cashSalesTotal = cashMovements.filter(m => m.type === 'venda').reduce((a,b) => a + b.amount, 0);
    const otherSupplements = cashMovements.filter(m => m.type === 'suprimento' && m.note && !m.note.includes('Abertura')).reduce((a,b) => a + b.amount, 0);
    const bleedsTotal = cashMovements.filter(m => m.type === 'sangria').reduce((a,b) => a + b.amount, 0);

    const estimatedBalance = (initialFund + cashSalesTotal + otherSupplements) - bleedsTotal;

    const el1 = document.getElementById('cashier-initial-fund');
    const el2 = document.getElementById('cashier-cash-sales');
    const el3 = document.getElementById('cashier-total-supplements');
    const el4 = document.getElementById('cashier-total-bleed');
    const el5 = document.getElementById('cashier-estimated-balance');

    if(el1) el1.textContent = `R$ ${initialFund.toFixed(2)}`;
    if(el2) el2.textContent = `+ R$ ${cashSalesTotal.toFixed(2)}`;
    if(el3) el3.textContent = `+ R$ ${otherSupplements.toFixed(2)}`;
    if(el4) el4.textContent = `- R$ ${bleedsTotal.toFixed(2)}`;
    if(el5) el5.textContent = `R$ ${estimatedBalance.toFixed(2)}`;

    const tbody = document.getElementById('cashier-movements-tbody');
    if(!tbody) return;

    if(cashMovements.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-slate-500">Sem registros de caixa.</td></tr>`;
        return;
    }

    tbody.innerHTML = cashMovements.map(m => {
        let badgeClass = 'text-emerald-400';
        let sign = '+';
        if(m.type === 'sangria') {
            badgeClass = 'text-rose-400';
            sign = '-';
        }

        return `
            <tr class="hover:bg-slate-800/40">
                <td class="py-2.5 px-3 font-mono-num text-slate-400">${m.time}</td>
                <td class="py-2.5 px-3 uppercase font-bold text-[10px] ${badgeClass}">${m.type}</td>
                <td class="py-2.5 px-3 text-slate-300">${m.note || 'Sem descrição'}</td>
                <td class="py-2.5 px-3 text-right font-mono-num font-bold ${badgeClass}">${sign} R$ ${m.amount.toFixed(2)}</td>
            </tr>
        `;
    }).join('');
}

function openCashMovementModal(type) {
    document.getElementById('cash-movement-type').value = type;
    document.getElementById('cash-movement-amount').value = '';
    document.getElementById('cash-movement-note').value = '';
    
    const title = document.getElementById('cash-movement-title');
    title.textContent = type === 'sangria' ? 'Registrar Sangria (Retirada)' : 'Registrar Suprimento (Entrada)';
    
    document.getElementById('modal-cash-movement').classList.remove('hidden');
}

function saveCashMovement() {
    const type = document.getElementById('cash-movement-type').value;
    const amount = parseFloat(document.getElementById('cash-movement-amount').value) || 0;
    const note = document.getElementById('cash-movement-note').value.trim() || (type === 'sangria' ? 'Sangria de caixa' : 'Suprimento de caixa');

    if(amount <= 0) {
        showNotification('Informe um valor válido!', 'error');
        return;
    }

    cashMovements.unshift({
        id: Date.now(),
        time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
        type: type,
        amount: amount,
        note: note
    });

    saveStateToStorage();
    renderCashierView();
    closeModal('modal-cash-movement');
}

function closeCashierShift() {
    if(confirm('Deseja fechar o caixa e zerar os registros da sessão atual para iniciar um novo turno?')) {
        const initialFundInput = prompt('Informe o valor do Fundo de Troco (Suprimento) para o próximo turno:', '150.00');
        const initialFund = parseFloat(initialFundInput) || 0;

        cashMovements = [
            { 
                id: Date.now(), 
                time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}), 
                type: 'suprimento', 
                amount: initialFund, 
                note: 'Abertura de caixa (Fundo de Troco)' 
            }
        ];

        saveStateToStorage();
        renderCashierView();
        showNotification('Caixa fechado e reiniciado para o novo turno!', 'success');
    }
}

function openSettingsModal() {
    document.getElementById('modal-settings').classList.remove('hidden');
}

function exportSystemData() {
    const dump = {
        products,
        salesHistory,
        cashMovements,
        exportedAt: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dump, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `isabelvariedades_backup_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

function importSystemData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            if (data.products && Array.isArray(data.products)) {
                products = data.products;
            }
            if (data.salesHistory && Array.isArray(data.salesHistory)) {
                salesHistory = data.salesHistory;
            }
            if (data.cashMovements && Array.isArray(data.cashMovements)) {
                cashMovements = data.cashMovements;
            }

            saveStateToStorage();
            renderCartUI();
            renderInventoryTable();
            renderHistoryTable();
            renderCashierView();
            closeModal('modal-settings');

            showNotification('Dados importados e restaurados com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao ler arquivo JSON:', error);
            showNotification('Arquivo de backup inválido ou corrompido.', 'error');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function openResetConfirmModal() {
    document.getElementById('modal-reset-confirm').classList.remove('hidden');
}

function executeResetSystemData() {
    localStorage.removeItem('isabel_sales');
    localStorage.removeItem('isabel_cash');
    localStorage.removeItem('isabel_discount');

    salesHistory = [];
    activeDiscount = { type: 'fixed', value: 0 };
    cashMovements = [
        { 
            id: Date.now(), 
            time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}), 
            type: 'suprimento', 
            amount: 150.00, 
            note: 'Abertura de caixa (Fundo de Troco)' 
        }
    ];

    saveStateToStorage();
    renderInventoryTable();
    renderHistoryTable();
    renderCashierView();

    closeModal('modal-reset-confirm');
    closeModal('modal-settings');
    showNotification('Caixa e histórico zerados! Estoque preservado.', 'success');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    if (modalId === 'modal-camera-scanner') {
        stopCameraScanner();
    }
}

function closeAllModals() {
    document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
    stopCameraScanner();

    const pdvSearch = document.getElementById('pdv-search-input');
    if (pdvSearch && !document.getElementById('view-pdv').classList.contains('hidden')) {
        pdvSearch.focus();
    }
}