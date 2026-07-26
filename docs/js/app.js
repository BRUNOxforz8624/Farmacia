// ============================================
// FarmApp - Comparador de Precios (Frontend Only)
// Todo el backend en Python portado a JavaScript
// ============================================

const CONFIG = {
    MIN_QUANTITY: 5,
    MIN_MONTHS_SHELF_LIFE: 6
};

// ----- COLUMN MAPPING (portado de excel_parser.py / pdf_parser.py) -----

const COLUMN_CONFIG = {
    barcode: {
        exact: ['cod. barra', 'cod barra', 'codigo de barras', 'cod barras', 'código de barras'],
        contains: ['barras', 'barcode', 'ean', 'cod barra']
    },
    name: {
        exact: ['descripción', 'descripcion', 'description', 'detalle'],
        contains: ['descripcion', 'descripción', 'description', 'detalle', 'producto']
    },
    expiration: {
        exact: ['fecha venc.', 'fecha vencimiento', 'fec lote', 'fecha lote', 'vencimiento', 'fec. venc.', 'fec venc'],
        contains: ['vencimiento']
    },
    quantity: {
        exact: ['existencia', 'inventario', 'cantidad solicitada', 'pedido', 'stock', 'disponible'],
        contains: ['existencia', 'inventario', 'stock']
    },
    promo_price: {
        exact: ['precio promo (referencial)', 'precio promo', 'precio promocional', 'promo'],
        contains: ['precio promo']
    },
    price: {
        exact: ['precio (referencial)', 'precio uni', 'precio unit', 'precio unitario', 'precio externo ($) referencial', 'precio'],
        contains: ['precio']
    },
    supplier: {
        exact: ['proveedor', 'laboratorio', 'lab', 'fabricante'],
        contains: ['proveedor', 'laboratorio', 'fabricante']
    },
    conditions: {
        exact: ['condición', 'condicion', 'acuerdo comercial', 'dcto. nena', 'dcto. ct', 'dcto. en factura', 'oferta', 'descuento', 'dcto nena'],
        contains: ['condicion', 'condición', 'acuerdo', 'dcto', 'descuento', 'oferta']
    }
};

function normalize(text) {
    return text.toLowerCase().trim()
        .replace(/[\s]+/g, ' ')
        .replace(/[()$]/g, '')
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
        .replace(/\./g, '').trim();
}

function mapColumns(headers) {
    const colMap = {};
    const headersNorm = headers.map(h => normalize(h));

    for (const [field, config] of Object.entries(COLUMN_CONFIG)) {
        for (const keyword of config.exact) {
            const kwNorm = normalize(keyword);
            for (let i = 0; i < headersNorm.length; i++) {
                if (headersNorm[i] === kwNorm) {
                    colMap[field] = i;
                    break;
                }
            }
            if (field in colMap) break;
        }
    }

    for (const [field, config] of Object.entries(COLUMN_CONFIG)) {
        if (field in colMap) continue;
        for (const keyword of config.contains) {
            const kwNorm = normalize(keyword);
            for (let i = 0; i < headersNorm.length; i++) {
                if (!headersNorm[i] || headersNorm[i].length < 3) continue;
                if (headersNorm[i].includes(kwNorm)) {
                    colMap[field] = i;
                    break;
                }
            }
            if (field in colMap) break;
        }
    }

    return colMap;
}

// ----- UTILITY FUNCTIONS -----

function cleanText(text) {
    if (text === null || text === undefined) return '';
    if (typeof text === 'number') return String(text);
    return String(text).trim().replace(/\s+/g, ' ');
}

function parsePrice(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    try {
        let text = String(value).trim().replace(/\$/g, '').replace(/\s/g, '');
        if (text.includes(',') && text.includes('.')) {
            text = text.replace(/\./g, '').replace(',', '.');
        } else if (text.includes(',')) {
            text = text.replace(',', '.');
        }
        text = text.replace(/[^\d.]/g, '');
        if (text) return parseFloat(text);
    } catch (e) { }
    return null;
}

function parseInteger(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Math.floor(value);
    try {
        let text = String(value).trim().replace(/[^\d-]/g, '');
        if (text) return parseInt(text, 10);
    } catch (e) { }
    return null;
}

function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
        const d = new Date((value - 25569) * 86400 * 1000);
        return isNaN(d.getTime()) ? null : d;
    }
    const dateFormats = [
        /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/,
        /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/,
        /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/,
        /^(\d{1,2})[\/\-.](\d{4})$/,
        /^(\d{1,2})[\/\-.](\d{2})$/
    ];
    const text = String(value).trim();
    let match;

    match = text.match(dateFormats[0]);
    if (match) {
        const d = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
        if (!isNaN(d.getTime())) return d;
        const d2 = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        if (!isNaN(d2.getTime())) return d2;
    }

    match = text.match(dateFormats[1]);
    if (match) {
        const year = parseInt(match[3]) + 2000;
        const d = new Date(year, parseInt(match[2]) - 1, parseInt(match[1]));
        if (!isNaN(d.getTime())) return d;
    }

    match = text.match(dateFormats[2]);
    if (match) {
        const d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        if (!isNaN(d.getTime())) return d;
    }

    const d = new Date(text);
    if (!isNaN(d.getTime())) return d;

    return null;
}

// ----- DATA STORE (localStorage) -----

const Store = {
    _get(key) {
        try { return JSON.parse(localStorage.getItem('farmapp_' + key) || '[]'); }
        catch (e) { return []; }
    },
    _set(key, data) {
        localStorage.setItem('farmapp_' + key, JSON.stringify(data));
    },
    getProducts() { return this._get('products'); },
    setProducts(d) { this._set('products', d); },
    getSuppliers() { return this._get('suppliers'); },
    setSuppliers(d) { this._set('suppliers', d); },
    getPrices() { return this._get('prices'); },
    setPrices(d) { this._set('prices', d); },
    getUploads() { return this._get('uploads'); },
    setUploads(d) { this._set('uploads', d); },
    getNextId(type) {
        const key = 'farmapp_counters';
        let counters;
        try { counters = JSON.parse(localStorage.getItem(key) || '{}'); }
        catch (e) { counters = {}; }
        counters[type] = (counters[type] || 0) + 1;
        localStorage.setItem(key, JSON.stringify(counters));
        return counters[type];
    },
    clearAll() {
        ['products', 'suppliers', 'prices', 'uploads', 'counters'].forEach(k => {
            localStorage.removeItem('farmapp_' + k);
        });
    }
};

// ----- EXCEL PARSER (usa SheetJS) -----

async function parseExcelFile(file) {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS no esta cargado. Verifica tu conexion a internet.');

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const products = [];

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        let colMap = null;
        let dataStart = 0;

        for (let i = 0; i < Math.min(50, data.length); i++) {
            const row = data[i];
            if (!row || row.filter(c => c != null && c !== '').length < 3) continue;

            const headers = row.map(h => String(h || '').trim());
            const candidateMap = mapColumns(headers);

            if (candidateMap && Object.keys(candidateMap).length >= 3) {
                const uniqueCols = new Set(Object.values(candidateMap));
                if (uniqueCols.size >= 3) {
                    colMap = candidateMap;
                    dataStart = i + 1;
                    break;
                }
            }
        }

        if (!colMap) continue;

        for (let i = dataStart; i < data.length; i++) {
            const row = data[i];
            if (!row || row.every(c => c == null || c === '')) continue;
            const product = extractProductData(row, colMap);
            if (product) products.push(product);
        }
    }

    return products;
}

// ----- PDF PARSER (usa pdf.js) -----

async function parsePdfFile(file) {
    if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js no esta cargado. Verifica tu conexion a internet.');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const products = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items;

        if (items.length === 0) continue;

        const rows = {};
        const tolerance = 5;

        items.forEach(item => {
            const y = item.transform[5];
            let foundKey = null;

            for (const key of Object.keys(rows)) {
                if (Math.abs(parseFloat(key) - y) < tolerance) {
                    foundKey = key;
                    break;
                }
            }

            if (foundKey) {
                rows[foundKey].push({ str: item.str, x: item.transform[4] });
            } else {
                rows[y.toString()] = [{ str: item.str, x: item.transform[4] }];
            }
        });

        const sortedY = Object.keys(rows).map(Number).sort((a, b) => a - b);

        const table = sortedY.map(y => {
            return rows[y.toString()]
                .sort((a, b) => a.x - b.x)
                .map(item => item.str.trim())
                .filter(s => s.length > 0);
        });

        if (table.length < 2) continue;

        let colMap = null;
        let dataStart = 0;

        for (let j = 0; j < Math.min(5, table.length); j++) {
            const headers = table[j];
            if (headers.length < 3) continue;
            const candidateMap = mapColumns(headers);
            if (candidateMap && Object.keys(candidateMap).length >= 3) {
                const uniqueCols = new Set(Object.values(candidateMap));
                if (uniqueCols.size >= 3) {
                    colMap = candidateMap;
                    dataStart = j + 1;
                    break;
                }
            }
        }

        if (!colMap) continue;

        for (let j = dataStart; j < table.length; j++) {
            const row = table[j];
            if (!row || row.length === 0) continue;
            const product = extractProductData(row, colMap);
            if (product) products.push(product);
        }
    }

    return products;
}

function extractProductData(row, colMap) {
    try {
        const barcode = getCell(row, colMap, 'barcode');
        const name = getCell(row, colMap, 'name');
        const expiration = parseDate(getCell(row, colMap, 'expiration'));
        const quantity = parseInteger(getCell(row, colMap, 'quantity'));
        const promoPrice = parsePrice(getCell(row, colMap, 'promo_price'));
        const regularPrice = parsePrice(getCell(row, colMap, 'price'));
        const price = promoPrice !== null ? promoPrice : regularPrice;
        const supplier = getCell(row, colMap, 'supplier');
        const conditions = getCell(row, colMap, 'conditions');

        if (!name || price === null) return null;

        return {
            barcode: barcode || null,
            name: name,
            expiration_date: expiration ? expiration.toISOString().split('T')[0] : null,
            quantity: quantity || 0,
            price: price,
            supplier: supplier || null,
            special_conditions: conditions || null
        };
    } catch (e) {
        return null;
    }
}

function getCell(row, colMap, field) {
    if (field in colMap && colMap[field] < row.length) {
        return cleanText(row[colMap[field]]);
    }
    return null;
}

// ----- SAVE PRODUCTS -----

function saveProducts(products, uploadId) {
    const allProducts = Store.getProducts();
    const allSuppliers = Store.getSuppliers();
    const allPrices = Store.getPrices();

    let supplierIdCounter = allSuppliers.length > 0 ? Math.max(...allSuppliers.map(s => s.id)) : 0;
    let productIdCounter = allProducts.length > 0 ? Math.max(...allProducts.map(p => p.id)) : 0;
    let priceIdCounter = allPrices.length > 0 ? Math.max(...allPrices.map(p => p.id)) : 0;

    const supplierNameMap = {};
    allSuppliers.forEach(s => { supplierNameMap[s.name] = s; });

    const productNameMap = {};
    const productBarcodeMap = {};
    allProducts.forEach(p => {
        productNameMap[p.name] = p;
        if (p.barcode) productBarcodeMap[p.barcode] = p;
    });

    let count = 0;

    for (const prod of products) {
        if (!prod.name || prod.price === null) continue;

        let supplier = null;
        if (prod.supplier) {
            supplier = supplierNameMap[prod.supplier];
        }
        if (!supplier) {
            supplierIdCounter++;
            supplier = { id: supplierIdCounter, name: prod.supplier || 'Desconocido' };
            allSuppliers.push(supplier);
            supplierNameMap[supplier.name] = supplier;
        }

        let product = null;
        if (prod.barcode) {
            product = productBarcodeMap[prod.barcode];
        }
        if (!product) {
            product = productNameMap[prod.name];
        }
        if (!product) {
            productIdCounter++;
            product = { id: productIdCounter, barcode: prod.barcode, name: prod.name };
            allProducts.push(product);
            productNameMap[product.name] = product;
            if (product.barcode) productBarcodeMap[product.barcode] = product;
        }

        priceIdCounter++;
        allPrices.push({
            id: priceIdCounter,
            product_id: product.id,
            supplier_id: supplier.id,
            price: prod.price,
            quantity: prod.quantity || 0,
            expiration_date: prod.expiration_date,
            special_conditions: prod.special_conditions,
            upload_id: uploadId
        });
        count++;
    }

    Store.setProducts(allProducts);
    Store.setSuppliers(allSuppliers);
    Store.setPrices(allPrices);

    return count;
}

// ----- PRICE COMPARATOR (portado de price_comparator.py) -----

function is_valid_offer(priceRecord, minQty, minMonths) {
    if (minQty === undefined) minQty = CONFIG.MIN_QUANTITY;
    if (minMonths === undefined) minMonths = CONFIG.MIN_MONTHS_SHELF_LIFE;

    const hasEnoughStock = priceRecord.quantity > minQty;

    let hasEnoughShelfLife = true;
    if (priceRecord.expiration_date) {
        const today = new Date();
        const expDate = new Date(priceRecord.expiration_date);
        const monthsLeft = (expDate - today) / (30 * 24 * 60 * 60 * 1000);
        hasEnoughShelfLife = monthsLeft > minMonths;
    }

    return hasEnoughStock && hasEnoughShelfLife;
}

function get_best_prices(minQty, minMonths) {
    if (minQty === undefined) minQty = CONFIG.MIN_QUANTITY;
    if (minMonths === undefined) minMonths = CONFIG.MIN_MONTHS_SHELF_LIFE;

    const allProducts = Store.getProducts();
    const allSuppliers = Store.getSuppliers();
    const allPrices = Store.getPrices();

    const today = new Date();
    const cutoffDate = new Date(today.getTime() + minMonths * 30 * 24 * 60 * 60 * 1000);

    const filtered = allPrices.filter(p => {
        if (p.quantity <= minQty) return false;
        if (p.expiration_date) {
            const expDate = new Date(p.expiration_date);
            if (expDate <= cutoffDate) return false;
        }
        return true;
    });

    const groups = {};
    filtered.forEach(price => {
        const product = allProducts.find(p => p.id === price.product_id);
        if (!product) return;

        const groupKey = product.barcode || 'id_' + product.id;
        if (!groups[groupKey]) groups[groupKey] = [];

        const supplier = allSuppliers.find(s => s.id === price.supplier_id);
        const monthsLeft = price.expiration_date ?
            (new Date(price.expiration_date) - today) / (30 * 24 * 60 * 60 * 1000) : null;

        groups[groupKey].push({
            product_id: product.id,
            barcode: product.barcode,
            product_name: product.name,
            supplier_id: supplier ? supplier.id : null,
            supplier_name: supplier ? supplier.name : 'Desconocido',
            price: price.price,
            quantity: price.quantity,
            expiration_date: price.expiration_date,
            months_until_expiration: monthsLeft ? Math.round(monthsLeft * 10) / 10 : null,
            special_conditions: price.special_conditions,
            is_valid: is_valid_offer(price, minQty, minMonths)
        });
    });

    const bestPrices = [];
    Object.values(groups).forEach(offers => {
        offers.sort((a, b) => a.price - b.price);
        const best = offers[0];
        best.total_offers = offers.length;
        bestPrices.push(best);
    });

    bestPrices.sort((a, b) => a.price - b.price);
    return bestPrices;
}

function compare_product(searchTerm, minQty, minMonths) {
    if (minQty === undefined) minQty = CONFIG.MIN_QUANTITY;
    if (minMonths === undefined) minMonths = CONFIG.MIN_MONTHS_SHELF_LIFE;

    const allProducts = Store.getProducts();
    const allSuppliers = Store.getSuppliers();
    const allPrices = Store.getPrices();
    const today = new Date();
    const term = searchTerm.toLowerCase();

    const matchingProducts = allProducts.filter(p => {
        const nameMatch = p.name && p.name.toLowerCase().includes(term);
        const barcodeMatch = p.barcode && p.barcode.toLowerCase().includes(term);
        return nameMatch || barcodeMatch;
    });

    const barcodes = matchingProducts.map(p => p.barcode).filter(Boolean);
    const allProductIds = new Set(matchingProducts.map(p => p.id));

    allProducts.forEach(p => {
        if (p.barcode && barcodes.includes(p.barcode)) {
            allProductIds.add(p.id);
        }
    });

    const results = [];
    allProductIds.forEach(productId => {
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;

        const productPrices = allPrices.filter(p => p.product_id === productId);
        productPrices.forEach(price => {
            const supplier = allSuppliers.find(s => s.id === price.supplier_id);
            const monthsLeft = price.expiration_date ?
                (new Date(price.expiration_date) - today) / (30 * 24 * 60 * 60 * 1000) : null;

            results.push({
                product_id: product.id,
                barcode: product.barcode,
                product_name: product.name,
                supplier_id: supplier ? supplier.id : null,
                supplier_name: supplier ? supplier.name : 'Desconocido',
                price: price.price,
                quantity: price.quantity,
                expiration_date: price.expiration_date,
                months_until_expiration: monthsLeft ? Math.round(monthsLeft * 10) / 10 : null,
                special_conditions: price.special_conditions,
                is_valid: is_valid_offer(price, minQty, minMonths)
            });
        });
    });

    results.sort((a, b) => {
        if (a.is_valid !== b.is_valid) return a.is_valid ? -1 : 1;
        return a.price - b.price;
    });

    return results;
}

function get_statistics() {
    const products = Store.getProducts();
    const suppliers = Store.getSuppliers();
    const prices = Store.getPrices();

    let validCount = 0;
    prices.forEach(p => { if (is_valid_offer(p)) validCount++; });

    return {
        total_products: products.length,
        total_suppliers: suppliers.length,
        total_prices: prices.length,
        valid_offers: validCount,
        invalid_offers: prices.length - validCount
    };
}

// ----- UI / NAVIGATION -----

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const page = item.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(page).classList.add('active');
            loadPageData(page);
        });
    });
}

function loadPageData(page) {
    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'upload': loadUploadHistory(); break;
        case 'products': loadProducts(); break;
        case 'compare': applyFilters(); break;
    }
}

// ----- DASHBOARD -----

function loadDashboard() {
    const stats = get_statistics();
    document.getElementById('total-products').textContent = stats.total_products;
    document.getElementById('total-suppliers').textContent = stats.total_suppliers;
    document.getElementById('valid-offers').textContent = stats.valid_offers;
    document.getElementById('invalid-offers').textContent = stats.invalid_offers;

    const deals = get_best_prices();
    const tbody = document.querySelector('#best-deals-table tbody');
    tbody.innerHTML = '';

    deals.slice(0, 10).forEach(deal => {
        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(deal.barcode || '-')}</td>
                <td>${escapeHtml(deal.product_name)}</td>
                <td>${escapeHtml(deal.supplier_name)}</td>
                <td><strong>Bs ${deal.price.toFixed(2)}</strong></td>
                <td>${deal.quantity}</td>
                <td>${deal.months_until_expiration ? deal.months_until_expiration + ' meses' : 'N/A'}</td>
                <td>${escapeHtml(deal.special_conditions || '-')}</td>
            </tr>
        `;
    });
}

// ----- PRODUCTS PAGE -----

function loadProducts(search) {
    const products = Store.getProducts();
    const suppliers = Store.getSuppliers();
    const prices = Store.getPrices();

    let filtered = products;
    if (search) {
        const term = search.toLowerCase();
        filtered = products.filter(p =>
            (p.name && p.name.toLowerCase().includes(term)) ||
            (p.barcode && p.barcode.toLowerCase().includes(term))
        );
    }

    const tbody = document.querySelector('#products-table tbody');
    tbody.innerHTML = '';

    filtered.forEach(product => {
        const productPrices = prices.filter(p => p.product_id === product.id);
        let minPrice = '-';
        let supplier = '-';
        let qty = 0;
        let expiry = '-';

        if (productPrices.length > 0) {
            const cheapest = productPrices.reduce((min, p) => p.price < min.price ? p : min, productPrices[0]);
            minPrice = 'Bs ' + cheapest.price.toFixed(2);
            const sup = suppliers.find(s => s.id === cheapest.supplier_id);
            supplier = sup ? sup.name : '-';
            qty = cheapest.quantity;
            expiry = cheapest.expiration_date || '-';
        }

        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(product.barcode || '-')}</td>
                <td>${escapeHtml(product.name)}</td>
                <td><strong>${minPrice}</strong></td>
                <td>${escapeHtml(supplier)}</td>
                <td>${qty}</td>
                <td>${expiry}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">Eliminar</button></td>
            </tr>
        `;
    });
}

function deleteProduct(id) {
    if (!confirm('Eliminar este producto y todos sus precios?')) return;

    let products = Store.getProducts();
    let prices = Store.getPrices();

    products = products.filter(p => p.id !== id);
    prices = prices.filter(p => p.product_id !== id);

    Store.setProducts(products);
    Store.setPrices(prices);
    showToast('Producto eliminado', 'success');
    loadProducts(document.getElementById('product-search').value);
}

// ----- UPLOAD -----

function initUploadHandlers() {
    const pdfDropZone = document.getElementById('pdf-drop-zone');
    const pdfInput = document.getElementById('pdf-input');
    const excelDropZone = document.getElementById('excel-drop-zone');
    const excelInput = document.getElementById('excel-input');

    if (pdfDropZone) {
        pdfDropZone.addEventListener('click', () => pdfInput.click());
        pdfDropZone.addEventListener('dragover', (e) => { e.preventDefault(); pdfDropZone.classList.add('dragover'); });
        pdfDropZone.addEventListener('dragleave', () => pdfDropZone.classList.remove('dragover'));
        pdfDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            pdfDropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.name.toLowerCase().endsWith('.pdf')) uploadFile(file, 'pdf');
        });
        pdfInput.addEventListener('change', (e) => { if (e.target.files[0]) uploadFile(e.target.files[0], 'pdf'); });
    }

    if (excelDropZone) {
        excelDropZone.addEventListener('click', () => excelInput.click());
        excelDropZone.addEventListener('dragover', (e) => { e.preventDefault(); excelDropZone.classList.add('dragover'); });
        excelDropZone.addEventListener('dragleave', () => excelDropZone.classList.remove('dragover'));
        excelDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            excelDropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')))
                uploadFile(file, 'excel');
        });
        excelInput.addEventListener('change', (e) => { if (e.target.files[0]) uploadFile(e.target.files[0], 'excel'); });
    }

    document.getElementById('clear-all-btn').addEventListener('click', () => {
        if (!confirm('Eliminar TODOS los productos, proveedores y precios?')) return;
        Store.clearAll();
        showToast('Todos los datos fueron eliminados', 'success');
        loadProducts();
        loadDashboard();
    });
}

async function uploadFile(file, type) {
    const progressEl = document.getElementById(type + '-progress');
    const fillEl = document.getElementById(type + '-progress-fill');
    const statusEl = document.getElementById(type + '-status');

    progressEl.style.display = 'block';
    fillEl.style.width = '30%';
    fillEl.style.background = 'var(--primary)';
    statusEl.textContent = 'Procesando...';

    try {
        let products;
        if (type === 'excel') {
            products = await parseExcelFile(file);
        } else {
            products = await parsePdfFile(file);
        }

        fillEl.style.width = '70%';
        statusEl.textContent = 'Guardando...';

        const uploadId = Store.getNextId('uploads');
        const imported = saveProducts(products, uploadId);

        const upload = {
            id: uploadId,
            filename: file.name,
            file_type: type,
            status: 'completed',
            records_imported: imported,
            created_at: new Date().toISOString()
        };
        const uploads = Store.getUploads();
        uploads.unshift(upload);
        Store.setUploads(uploads);

        fillEl.style.width = '100%';
        statusEl.textContent = `Se importaron ${imported} productos`;
        showToast(`Se importaron ${imported} productos`, 'success');
        loadUploadHistory();

    } catch (error) {
        fillEl.style.width = '100%';
        fillEl.style.background = 'var(--danger)';
        statusEl.textContent = `Error: ${error.message}`;
        showToast(`Error: ${error.message}`, 'error');
    }

    setTimeout(() => {
        progressEl.style.display = 'none';
        fillEl.style.width = '0%';
        fillEl.style.background = 'var(--primary)';
    }, 3000);
}

function loadUploadHistory() {
    const uploads = Store.getUploads();
    const tbody = document.querySelector('#upload-history-table tbody');
    tbody.innerHTML = '';

    uploads.forEach(upload => {
        const typeBadge = upload.file_type === 'pdf'
            ? '<span class="badge" style="background:#dc2626">PDF</span>'
            : '<span class="badge" style="background:#16a34a">Excel</span>';
        const statusBadge = upload.status === 'completed'
            ? '<span class="badge badge-success">Completado</span>'
            : '<span class="badge badge-danger">Error</span>';

        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(upload.filename)}</td>
                <td>${typeBadge}</td>
                <td>${statusBadge}</td>
                <td>${upload.records_imported}</td>
                <td>${new Date(upload.created_at).toLocaleDateString()}</td>
            </tr>
        `;
    });
}

// ----- COMPARE -----

let allResults = [];

function initCompareHandlers() {
    document.getElementById('apply-filters').addEventListener('click', applyFilters);
    document.getElementById('clear-filters').addEventListener('click', clearFilters);
    document.getElementById('compare-search').addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFilters(); });
    document.getElementById('filter-supplier').addEventListener('change', applyClientFilters);
    document.getElementById('min-price').addEventListener('change', applyClientFilters);
    document.getElementById('max-price').addEventListener('change', applyClientFilters);
    document.getElementById('sort-by').addEventListener('change', applyClientFilters);
    document.getElementById('export-btn').addEventListener('click', exportResults);
    document.getElementById('orders-btn').addEventListener('click', downloadOrders);
    document.getElementById('farmadeleite-btn').addEventListener('click', generateFarmadeleiteOrder);
}

function clearFilters() {
    document.getElementById('compare-search').value = '';
    document.getElementById('min-qty').value = '5';
    document.getElementById('min-months').value = '6';
    document.getElementById('filter-supplier').value = '';
    document.getElementById('min-price').value = '';
    document.getElementById('max-price').value = '';
    document.getElementById('sort-by').value = 'price_asc';
    applyFilters();
}

function applyFilters() {
    const search = document.getElementById('compare-search').value.trim();
    const qty = parseInt(document.getElementById('min-qty').value) || 5;
    const months = parseInt(document.getElementById('min-months').value) || 6;

    if (search) {
        allResults = compare_product(search, qty, months);
    } else {
        allResults = get_best_prices(qty, months);
    }

    const filterSupplier = document.getElementById('filter-supplier');
    const suppliers = [...new Set(allResults.map(r => r.supplier_name).filter(Boolean))];
    const current = filterSupplier.value;
    filterSupplier.innerHTML = '<option value="">Todos</option>';
    suppliers.sort().forEach(s => {
        filterSupplier.innerHTML += '<option value="' + escapeHtml(s) + '"' + (s === current ? ' selected' : '') + '>' + escapeHtml(s) + '</option>';
    });

    applyClientFilters();
}

function applyClientFilters() {
    let filtered = [...allResults];

    const supplier = document.getElementById('filter-supplier').value;
    const pMin = document.getElementById('min-price').value ? parseFloat(document.getElementById('min-price').value) : null;
    const pMax = document.getElementById('max-price').value ? parseFloat(document.getElementById('max-price').value) : null;
    const sort = document.getElementById('sort-by').value;

    if (supplier) filtered = filtered.filter(r => r.supplier_name === supplier);
    if (pMin !== null) filtered = filtered.filter(r => r.price >= pMin);
    if (pMax !== null) filtered = filtered.filter(r => r.price <= pMax);

    switch (sort) {
        case 'price_asc': filtered.sort((a, b) => a.price - b.price); break;
        case 'price_desc': filtered.sort((a, b) => b.price - a.price); break;
        case 'quantity_desc': filtered.sort((a, b) => b.quantity - a.quantity); break;
        case 'expiration_desc': filtered.sort((a, b) => (b.months_until_expiration || 0) - (a.months_until_expiration || 0)); break;
    }

    displayResults(filtered);
}

function displayResults(results) {
    const tbody = document.querySelector('#compare-table tbody');
    const countBadge = document.getElementById('results-count');
    countBadge.textContent = results.length;
    tbody.innerHTML = '';

    if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--gray-400); padding:60px 20px"><div class="empty-state"><h3>No se encontraron resultados</h3><p>Intenta ajustar los filtros de busqueda</p></div></td></tr>';
        return;
    }

    results.forEach(item => {
        const statusClass = item.is_valid ? 'status-valid' : 'status-invalid';
        const statusText = item.is_valid ? 'Valida' : 'Rechazada';
        let expiryText = 'N/A';
        if (item.months_until_expiration !== null) expiryText = item.months_until_expiration + ' meses';

        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(item.barcode || '-')}</td>
                <td>${escapeHtml(item.product_name)}</td>
                <td>${escapeHtml(item.supplier_name)}</td>
                <td><strong>Bs ${item.price.toFixed(2)}</strong></td>
                <td>${item.quantity} uds</td>
                <td>${expiryText}</td>
                <td>${escapeHtml(item.special_conditions || '-')}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
            </tr>
        `;
    });
}

// ----- EXPORT -----

function exportResults() {
    const search = document.getElementById('compare-search').value.trim();
    const qty = parseInt(document.getElementById('min-qty').value) || 5;
    const months = parseInt(document.getElementById('min-months').value) || 6;

    const results = search ? compare_product(search, qty, months) : get_best_prices(qty, months);

    if (typeof XLSX === 'undefined') { showToast('SheetJS no disponible', 'error'); return; }

    const wsData = [['Codigo', 'Producto', 'Proveedor', 'Precio', 'Cantidad', 'Vencimiento', 'Condicion', 'Estado']];
    results.forEach(item => {
        wsData.push([
            item.barcode || '-',
            item.product_name,
            item.supplier_name,
            item.price,
            item.quantity,
            item.months_until_expiration ? item.months_until_expiration + ' meses' : 'N/A',
            item.special_conditions || '-',
            item.is_valid ? 'Valida' : 'Rechazada'
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');

    ws['!cols'] = [
        { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 12 },
        { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 12 }
    ];

    XLSX.writeFile(wb, 'farmapp_resultados_' + Date.now() + '.xlsx');
}

function downloadOrders() {
    const search = document.getElementById('compare-search').value.trim();
    const qty = parseInt(document.getElementById('min-qty').value) || 5;
    const months = parseInt(document.getElementById('min-months').value) || 6;

    const results = search ? compare_product(search, qty, months) : get_best_prices(qty, months);
    const valid = results.filter(r => r.is_valid);

    if (valid.length === 0) { showToast('No hay productos validos para generar ordenes', 'error'); return; }
    if (typeof XLSX === 'undefined') { showToast('SheetJS no disponible', 'error'); return; }

    const bySupplier = {};
    valid.forEach(item => {
        if (!bySupplier[item.supplier_name]) bySupplier[item.supplier_name] = [];
        bySupplier[item.supplier_name].push(item);
    });

    const wb = XLSX.utils.book_new();
    const summaryData = [['Proveedor', 'Productos', 'Subtotal']];
    let grandTotal = 0;

    Object.keys(bySupplier).sort().forEach(supplier => {
        const items = bySupplier[supplier];
        const sheetData = [
            ['Orden de Compra - ' + supplier],
            ['Fecha: ' + new Date().toLocaleDateString()],
            [],
            ['#', 'Codigo Barra', 'Producto', 'Precio Unit.', 'Cantidad', 'Subtotal', 'Condicion']
        ];

        let supplierTotal = 0;
        items.forEach((item, i) => {
            const sub = item.price * item.quantity;
            supplierTotal += sub;
            sheetData.push([i + 1, item.barcode || '-', item.product_name, item.price, item.quantity, sub, item.special_conditions || '-']);
        });

        sheetData.push([]);
        sheetData.push(['', '', 'TOTAL', '', '', supplierTotal]);

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, ws, supplier.substring(0, 31));

        summaryData.push([supplier, items.length, supplierTotal]);
        grandTotal += supplierTotal;
    });

    summaryData.push([]);
    summaryData.push(['TOTAL GENERAL', valid.length, grandTotal]);

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

    XLSX.writeFile(wb, 'ordenes_compra_' + Date.now() + '.xlsx');
}

// ----- ORDEN FARMADELEITE -----

const FARMADELEITE = [
    { name: "Ketoprofeno amp. IV.", qty: 6, terms: ["ketoprofeno"] },
    { name: "Lagrioftol gotas", qty: 6, terms: ["lagrioftol"] },
    { name: "Artrovit x30 tab.", qty: 6, terms: ["artrovit"] },
    { name: "3crema", qty: 6, terms: ["3crema"] },
    { name: "Klafenac 100mg", qty: 6, terms: ["klafenac"] },
    { name: "Diapaglix 10mg", qty: 6, terms: ["diapaglix"] },
    { name: "Cilostazol 50mg", qty: 6, terms: ["cilostazol"] },
    { name: "Carbatil 6,25mg", qty: 6, terms: ["carbatil"] },
    { name: "Metformina 1000mg", qty: 12, terms: ["metformina"] },
    { name: "Xerograx x30 tab.", qty: 12, terms: ["xerograx"] },
    { name: "Xerograx x60 tab.", qty: 12, terms: ["xerograx", "x60"] },
    { name: "Mascarilla ojos Zoah", qty: 12, terms: ["zoah"] },
    { name: "Escitalopram 10mg x30 tab. Rowe", qty: 12, terms: ["escitalopram", "rowe"] },
    { name: "Escitalopram 10mg x28 tab. Calox", qty: 12, terms: ["escitalopram", "calox"] },
    { name: "Solucion 0,9% 100ml", qty: 12, terms: ["solucion", "0,9"] },
    { name: "Ferganic 40mg", qty: 12, terms: ["ferganic"] },
    { name: "Desler M 10 tab. Adulto", qty: 12, terms: ["desler"] },
    { name: "Atrevia 25mg x20 tab.", qty: 12, terms: ["atrevia"] },
    { name: "Olmesartan 40mg/Htc 12,5mg x30 tab. Genven", qty: 12, terms: ["olmesartan", "genven"] },
    { name: "Plidan Compuesto", qty: 3, terms: ["plidan"] },
    { name: "Dermazol crema", qty: 3, terms: ["dermazol"] },
    { name: "Dropil 100mg", qty: 3, terms: ["dropil"] },
    { name: "Breinox 800mg", qty: 3, terms: ["breinox"] },
    { name: "Valeriana gotas", qty: 3, terms: ["valeriana"] },
    { name: "Fitex 20mg x2 tab.", qty: 12, terms: ["fitex"] },
    { name: "Crisomet 50/850 x30", qty: 3, terms: ["crisomet"] },
    { name: "Espironolactona 25mg MEYER", qty: 3, terms: ["espironolactona"] },
    { name: "Notalac 30mg", qty: 3, terms: ["notalac"] },
    { name: "Omeprazol 40mg x10 Genven", qty: 3, terms: ["omeprazol", "genven"] },
    { name: "Artrodar", qty: 12, terms: ["artrodar"] },
    { name: "Canfir 750mg", qty: 3, terms: ["canfir"] },
    { name: "Lubrix 120cc", qty: 3, terms: ["lubrix"] },
    { name: "Letisan Jarabe", qty: 12, terms: ["letisan"] },
    { name: "Aceite de coco", qty: 3, terms: ["aceite", "coco"] },
    { name: "Pedialyte coco", qty: 12, terms: ["pedialyte"] },
    { name: "Opat gotas", qty: 12, terms: ["opat"] },
    { name: "Festal x50", qty: 12, terms: ["festal"] },
    { name: "Festal x20", qty: 3, terms: ["festal", "x20"] },
    { name: "Dicigel", qty: 3, terms: ["dicigel"] },
    { name: "Lafarcaina", qty: 3, terms: ["lafarcaina"] },
    { name: "Aflamax x20 tab.", qty: 3, terms: ["aflamax"] },
    { name: "Protector solar Dernier Spray 200mL", qty: 3, terms: ["dernier"] },
    { name: "Miovit x30 tab.", qty: 12, terms: ["miovit"] }
];

function searchFarmaProduct(terms) {
    const allProducts = Store.getProducts();
    const allPrices = Store.getPrices();
    const allSuppliers = Store.getSuppliers();

    let bestResult = null;
    let bestScore = 0;
    let bestPrice = Infinity;

    for (const product of allProducts) {
        const name = product.name.toLowerCase();
        let score = 0;
        for (const term of terms) {
            if (name.includes(term.toLowerCase())) score++;
        }
        if (score === 0) continue;
        if (score < bestScore) continue;

        const productPrices = allPrices.filter(p => p.product_id === product.id);
        for (const price of productPrices) {
            if (!is_valid_offer(price)) continue;
            if (score > bestScore || (score === bestScore && price.price < bestPrice)) {
                bestScore = score;
                bestPrice = price.price;
                const supplier = allSuppliers.find(s => s.id === price.supplier_id);
                bestResult = {
                    product_id: product.id,
                    barcode: product.barcode,
                    product_name: product.name,
                    price: price.price,
                    quantity: price.quantity,
                    supplier_name: supplier ? supplier.name : 'Desconocido',
                    expiration_date: price.expiration_date,
                    months_until_expiration: price.expiration_date ?
                        Math.round((new Date(price.expiration_date) - new Date()) / (30 * 24 * 60 * 60 * 1000) * 10) / 10 : null,
                    special_conditions: price.special_conditions
                };
            }
        }
    }

    return bestResult;
}

function generateFarmadeleiteOrder() {
    if (typeof XLSX === 'undefined') { showToast('SheetJS no disponible', 'error'); return; }

    const found = [];
    const notFound = [];

    FARMADELEITE.forEach(req => {
        const match = searchFarmaProduct(req.terms);
        if (match) {
            found.push({ ...req, match });
        } else {
            notFound.push(req);
        }
    });

    const wb = XLSX.utils.book_new();

    const orderData = [
        ['ORDEN DE COMPRA - FARMADELEITE'],
        ['Fecha: ' + new Date().toLocaleDateString()],
        [],
        ['#', 'Producto Requerido', 'Proveedor', 'Codigo', 'Precio Unit.', 'Cant. Requerida', 'Subtotal', 'Estado']
    ];

    let total = 0;
    let totalItems = 0;

    found.forEach((item, i) => {
        const subtotal = item.qty * item.match.price;
        total += subtotal;
        totalItems += item.qty;
        orderData.push([
            i + 1,
            item.name,
            item.match.supplier_name,
            item.match.barcode || '-',
            item.match.price,
            item.qty,
            subtotal,
            item.match.special_conditions || '-'
        ]);
    });

    notFound.forEach(item => {
        orderData.push(['-', item.name, '-', '-', '-', item.qty, 0, 'NO ENCONTRADO']);
    });

    orderData.push([]);
    orderData.push(['', '', '', '', 'TOTAL', totalItems, total]);

    const orderWs = XLSX.utils.aoa_to_sheet(orderData);
    orderWs['!cols'] = [
        { wch: 5 }, { wch: 40 }, { wch: 20 }, { wch: 18 },
        { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, orderWs, 'Orden Farmadeleite');

    XLSX.writeFile(wb, 'orden_farmadeleite_' + Date.now() + '.xlsx');

    showToast(
        `Encontrados: ${found.length} | No encontrados: ${notFound.length} | Total: Bs ${total.toFixed(2)}`,
        found.length > 0 ? 'success' : 'error'
    );
}

// ----- UTILS -----

function showToast(message, type) {
    type = type || 'info';
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ----- INIT -----

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initUploadHandlers();
    initCompareHandlers();
    loadDashboard();
});
