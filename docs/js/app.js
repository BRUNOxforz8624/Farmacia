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
        try {
            localStorage.setItem('farmapp_' + key, JSON.stringify(data));
        } catch (e) {
            throw new Error('El almacenamiento del navegador esta lleno. Pulsa "Borrar Todos" o usa archivos mas pequenos.');
        }
    },
    getProducts() { return this._get('products'); },
    setProducts(d) { this._set('products', d); },
    getSuppliers() { return this._get('suppliers'); },
    setSuppliers(d) { this._set('suppliers', d); },
    getPrices() { return this._get('prices'); },
    setPrices(d) { this._set('prices', d); },
    getUploads() { return this._get('uploads'); },
    setUploads(d) { this._set('uploads', d); },
    getFarmadeleite() {
        try {
            return JSON.parse(localStorage.getItem('farmapp_farmadeleite'));
        } catch (e) { return null; }
    },
    setFarmadeleite(d) { this._set('farmadeleite', d); },
    getDroguerias() { return this._get('droguerias'); },
    setDroguerias(d) { this._set('droguerias', d); },
    getOrden() { return this._get('orden'); },
    setOrden(d) { this._set('orden', d); },
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
        ['products', 'suppliers', 'prices', 'uploads', 'droguerias', 'orden', 'counters'].forEach(k => {
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

function saveProducts(products, uploadId, drogueriaId) {
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
            upload_id: uploadId,
            drogueria_id: drogueriaId || null
        });
        count++;
    }

    Store.setProducts(allProducts);
    Store.setSuppliers(allSuppliers);
    Store.setPrices(allPrices);

    return count;
}

// ----- INDEXED DATA ACCESS (evita O(n^2) con archivos grandes) -----

function buildIndexes() {
    const allProducts = Store.getProducts();
    const allSuppliers = Store.getSuppliers();
    const allPrices = Store.getPrices();

    const productById = new Map();
    const supplierById = new Map();
    const pricesByProduct = new Map();

    for (const p of allProducts) productById.set(p.id, p);
    for (const s of allSuppliers) supplierById.set(s.id, s);
    for (const price of allPrices) {
        if (!pricesByProduct.has(price.product_id)) pricesByProduct.set(price.product_id, []);
        pricesByProduct.get(price.product_id).push(price);
    }

    return { allProducts, allSuppliers, allPrices, productById, supplierById, pricesByProduct };
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

    const { allPrices, productById, supplierById } = buildIndexes();

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
        const product = productById.get(price.product_id);
        if (!product) return;

        const groupKey = product.barcode || 'id_' + product.id;
        if (!groups[groupKey]) groups[groupKey] = [];

        const supplier = supplierById.get(price.supplier_id);
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

    const { allProducts, productById, supplierById, pricesByProduct } = buildIndexes();
    const today = new Date();
    const term = searchTerm.toLowerCase();

    const matchingProducts = allProducts.filter(p => {
        const nameMatch = p.name && p.name.toLowerCase().includes(term);
        const barcodeMatch = p.barcode && p.barcode.toLowerCase().includes(term);
        return nameMatch || barcodeMatch;
    });

    const barcodes = new Set(matchingProducts.map(p => p.barcode).filter(Boolean));
    const allProductIds = new Set(matchingProducts.map(p => p.id));

    allProducts.forEach(p => {
        if (p.barcode && barcodes.has(p.barcode)) {
            allProductIds.add(p.id);
        }
    });

    const results = [];
    allProductIds.forEach(productId => {
        const product = productById.get(productId);
        if (!product) return;

        const productPrices = pricesByProduct.get(productId) || [];
        productPrices.forEach(price => {
            const supplier = supplierById.get(price.supplier_id);
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
        case 'requirements': loadRequirements(); break;
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
    const rows = [];

    deals.slice(0, 10).forEach(deal => {
        rows.push(`
            <tr>
                <td>${escapeHtml(deal.barcode || '-')}</td>
                <td>${escapeHtml(deal.product_name)}</td>
                <td>${escapeHtml(deal.supplier_name)}</td>
                <td><strong>Bs ${deal.price.toFixed(2)}</strong></td>
                <td>${deal.quantity}</td>
                <td>${deal.months_until_expiration ? deal.months_until_expiration + ' meses' : 'N/A'}</td>
                <td>${escapeHtml(deal.special_conditions || '-')}</td>
            </tr>
        `);
    });
    tbody.innerHTML = rows.join('');
}

// ----- PRODUCTS PAGE -----

let productsPageLimit = 250;

function loadProducts(search) {
    const { allProducts, pricesByProduct } = buildIndexes();

    const droguerias = Store.getDroguerias();
    const drogueriaMap = new Map();
    droguerias.forEach(d => drogueriaMap.set(d.id, d.name));

    let filtered = allProducts;
    if (search) {
        const term = search.toLowerCase();
        filtered = allProducts.filter(p =>
            (p.name && p.name.toLowerCase().includes(term)) ||
            (p.barcode && p.barcode.toLowerCase().includes(term))
        );
    }

    const orden = Store.getOrden();
    const ordenIds = new Set(orden.map(o => o.product_id));

    const thead = document.getElementById('products-thead');
    thead.innerHTML = '<tr><th>Codigo</th><th>Descripcion</th><th>Precio Min</th><th>Droguerias</th><th>Acciones</th></tr>';

    const tbody = document.querySelector('#products-table tbody');
    const rows = [];

    for (let i = 0; i < filtered.length; i++) {
        const product = filtered[i];
        const productPrices = pricesByProduct.get(product.id) || [];

        let minPrice = null;
        let minDrog = null;
        for (let j = 0; j < productPrices.length; j++) {
            const price = productPrices[j];
            if (minPrice === null || price.price < minPrice.price) {
                minPrice = price;
                minDrog = price.drogueria_id || null;
            }
        }

        let drogueriaName = '-';
        if (minPrice) {
            drogueriaName = minDrog === null
                ? 'Sin drogueria'
                : (drogueriaMap.get(minDrog) || ('Drogueria ' + minDrog));
        }

        const cells = [
            `<td>${escapeHtml(product.barcode || '-')}</td>`,
            `<td>${escapeHtml(product.name)}</td>`,
            `<td><strong>${minPrice ? 'Bs ' + minPrice.price.toFixed(2) : '-'}</strong></td>`,
            `<td>${escapeHtml(drogueriaName)}</td>`
        ];

        const inOrden = ordenIds.has(product.id);
        let acciones = '';
        if (inOrden) {
            acciones += `<button class="btn btn-sm btn-secondary" onclick="removeFromOrder(${product.id})">Quitar de orden</button> `;
        } else {
            acciones += `<button class="btn btn-sm btn-success" onclick="addToOrder(${product.id})">Agregar a orden</button> `;
        }
        acciones += `<button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">Eliminar</button>`;
        cells.push('<td>' + acciones + '</td>');
        rows.push('<tr>' + cells.join('') + '</tr>');
    }

    tbody.innerHTML = rows.slice(0, productsPageLimit).join('');

    updateOrderBadge();

    const container = document.getElementById('products-load-more-container');
    if (container) {
        document.getElementById('products-shown-count').textContent =
            'Mostrando ' + Math.min(rows.length, productsPageLimit) + ' de ' + filtered.length + ' productos';
        document.getElementById('products-load-more').style.display =
            filtered.length > productsPageLimit ? 'inline-block' : 'none';
        container.style.display = 'flex';
    }
}

function initProductsHandlers() {
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.addEventListener('keyup', () => {
            productsPageLimit = 250;
            loadProducts(searchInput.value.trim());
        });
    }
    const loadMoreBtn = document.getElementById('products-load-more');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            productsPageLimit += 250;
            loadProducts(document.getElementById('product-search').value.trim());
        });
    }
    const downloadBtn = document.getElementById('orden-download');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadManualOrder);
    const clearBtn = document.getElementById('orden-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearOrder);
    updateOrderBadge();
}

function updateOrderBadge() {
    const badge = document.getElementById('orden-count');
    if (badge) badge.textContent = Store.getOrden().length;
}

function addToOrder(productId) {
    const { productById, pricesByProduct, supplierById } = buildIndexes();
    const product = productById.get(productId);
    if (!product) return;

    const orden = Store.getOrden();
    if (orden.some(o => o.product_id === productId)) {
        showToast('El producto ya esta en la orden', 'error');
        return;
    }

    const productPrices = pricesByProduct.get(productId) || [];
    if (productPrices.length === 0) {
        showToast('El producto no tiene precios', 'error');
        return;
    }

    let best = productPrices[0];
    for (let i = 1; i < productPrices.length; i++) {
        if (productPrices[i].price < best.price) best = productPrices[i];
    }

    const qty = parseInt(prompt('Cantidad a ordenar de "' + product.name + '":', '1'), 10);
    if (!qty || qty < 1) return;

    const supplier = supplierById.get(best.supplier_id);
    orden.push({
        product_id: product.id,
        barcode: product.barcode || null,
        name: product.name,
        supplier_name: supplier ? supplier.name : 'Desconocido',
        price: best.price,
        quantity: qty,
        special_conditions: best.special_conditions || null
    });
    Store.setOrden(orden);
    showToast('Agregado a la orden de compra', 'success');
    loadProducts(document.getElementById('product-search').value);
}

function removeFromOrder(productId) {
    let orden = Store.getOrden();
    orden = orden.filter(o => o.product_id !== productId);
    Store.setOrden(orden);
    showToast('Quitado de la orden de compra', 'success');
    loadProducts(document.getElementById('product-search').value);
}

function clearOrder() {
    if (!confirm('Vaciar la orden de compra?')) return;
    Store.setOrden([]);
    showToast('Orden vaciada', 'success');
    loadProducts(document.getElementById('product-search').value);
}

function downloadManualOrder() {
    const orden = Store.getOrden();
    if (orden.length === 0) { showToast('La orden esta vacia. Agrega productos primero.', 'error'); return; }
    downloadOrdersExcel(orden);
}

function deleteProduct(id) {
    if (!confirm('Eliminar este producto y todos sus precios?')) return;

    let products = Store.getProducts();
    let prices = Store.getPrices();
    let orden = Store.getOrden();

    products = products.filter(p => p.id !== id);
    prices = prices.filter(p => p.product_id !== id);
    orden = orden.filter(o => o.product_id !== id);

    Store.setProducts(products);
    Store.setPrices(prices);
    Store.setOrden(orden);
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
            if (file && file.name.toLowerCase().endsWith('.pdf')) askDrogueria(file, 'pdf');
        });
        pdfInput.addEventListener('change', (e) => { if (e.target.files[0]) askDrogueria(e.target.files[0], 'pdf'); });
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
                askDrogueria(file, 'excel');
        });
        excelInput.addEventListener('change', (e) => { if (e.target.files[0]) askDrogueria(e.target.files[0], 'excel'); });
    }

    const confirmBtn = document.getElementById('drogueria-confirm');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmDrogueria);
    const cancelBtn = document.getElementById('drogueria-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelDrogueria);

    document.getElementById('clear-all-btn').addEventListener('click', () => {
        if (!confirm('Eliminar TODOS los productos, laboratorios, precios y droguerias?')) return;
        Store.clearAll();
        showToast('Todos los datos fueron eliminados', 'success');
        loadProducts();
        loadDashboard();
    });
}

let pendingFile = null;
let pendingFileType = null;

function askDrogueria(file, type) {
    pendingFile = file;
    pendingFileType = type;

    const select = document.getElementById('drogueria-select');
    const droguerias = Store.getDroguerias();
    select.innerHTML = '<option value="">-- Seleccionar drogueria --</option>';
    droguerias.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(d => {
        select.innerHTML += '<option value="' + d.id + '">' + escapeHtml(d.name) + '</option>';
    });
    document.getElementById('drogueria-new').value = '';
    document.getElementById('drogueria-modal').style.display = 'flex';
}

function confirmDrogueria() {
    const select = document.getElementById('drogueria-select');
    const newName = document.getElementById('drogueria-new').value.trim();

    let drogueriaId = null;

    if (newName) {
        const droguerias = Store.getDroguerias();
        const existing = droguerias.find(d => (d.name || '').toLowerCase() === newName.toLowerCase());
        if (existing) {
            drogueriaId = existing.id;
        } else {
            const maxId = droguerias.length > 0 ? Math.max(...droguerias.map(d => d.id)) : 0;
            drogueriaId = maxId + 1;
            droguerias.push({ id: drogueriaId, name: newName });
            Store.setDroguerias(droguerias);
        }
    } else if (select.value) {
        drogueriaId = parseInt(select.value, 10);
    }

    if (drogueriaId === null) {
        showToast('Selecciona o crea una drogueria', 'error');
        return;
    }

    document.getElementById('drogueria-modal').style.display = 'none';
    const file = pendingFile;
    const type = pendingFileType;
    pendingFile = null;
    pendingFileType = null;
    if (file && type) uploadFile(file, type, drogueriaId);
}

function cancelDrogueria() {
    pendingFile = null;
    pendingFileType = null;
    document.getElementById('drogueria-modal').style.display = 'none';
}

async function uploadFile(file, type, drogueriaId) {
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
        const imported = saveProducts(products, uploadId, drogueriaId);

        const upload = {
            id: uploadId,
            filename: file.name,
            file_type: type,
            drogueria_id: drogueriaId || null,
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
    const rows = [];

    const droguerias = Store.getDroguerias();
    const drogueriaMap = {};
    droguerias.forEach(d => { drogueriaMap[d.id] = d.name; });

    uploads.forEach(upload => {
        const typeBadge = upload.file_type === 'pdf'
            ? '<span class="badge" style="background:#dc2626">PDF</span>'
            : '<span class="badge" style="background:#16a34a">Excel</span>';
        const statusBadge = upload.status === 'completed'
            ? '<span class="badge badge-success">Completado</span>'
            : '<span class="badge badge-danger">Error</span>';
        const drogueriaName = upload.drogueria_id ? drogueriaMap[upload.drogueria_id] : null;

        rows.push(`
            <tr>
                <td>${escapeHtml(upload.filename)}</td>
                <td>${typeBadge}</td>
                <td>${escapeHtml(drogueriaName || '-')}</td>
                <td>${statusBadge}</td>
                <td>${upload.records_imported}</td>
                <td>${new Date(upload.created_at).toLocaleDateString()}</td>
            </tr>
        `);
    });
    tbody.innerHTML = rows.join('');
}

// ----- COMPARE -----

let allResults = [];
let farmadeleiteMode = false;

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
    const farmaFilter = document.getElementById('farmadeleite-filter');
    if (farmaFilter) farmaFilter.addEventListener('change', applyFilters);
}

function clearFilters() {
    document.getElementById('compare-search').value = '';
    document.getElementById('min-qty').value = '5';
    document.getElementById('min-months').value = '6';
    document.getElementById('filter-supplier').value = '';
    document.getElementById('min-price').value = '';
    document.getElementById('max-price').value = '';
    document.getElementById('sort-by').value = 'price_asc';
    const farmaFilter = document.getElementById('farmadeleite-filter');
    if (farmaFilter) farmaFilter.checked = false;
    applyFilters();
}

function applyFilters() {
    const search = document.getElementById('compare-search').value.trim();
    const qty = parseInt(document.getElementById('min-qty').value) || 5;
    const months = parseInt(document.getElementById('min-months').value) || 6;
    const farmaFilter = document.getElementById('farmadeleite-filter');

    if (farmaFilter && farmaFilter.checked) {
        farmadeleiteMode = true;
        allResults = buildFarmadeleiteResults(months);
    } else {
        farmadeleiteMode = false;
        if (search) {
            allResults = compare_product(search, qty, months);
        } else {
            allResults = get_best_prices(qty, months);
        }
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
    if (pMin !== null) filtered = filtered.filter(r => (r.price || 0) >= pMin);
    if (pMax !== null) filtered = filtered.filter(r => (r.price || 0) <= pMax);

    if (farmadeleiteMode) {
        displayFarmadeleiteResults(filtered);
        return;
    }

    switch (sort) {
        case 'price_asc': filtered.sort((a, b) => a.price - b.price); break;
        case 'price_desc': filtered.sort((a, b) => b.price - a.price); break;
        case 'quantity_desc': filtered.sort((a, b) => b.quantity - a.quantity); break;
        case 'expiration_desc': filtered.sort((a, b) => (b.months_until_expiration || 0) - (a.months_until_expiration || 0)); break;
    }

    displayResults(filtered);
}

function displayFarmadeleiteResults(results) {
    const tbody = document.querySelector('#compare-table tbody');
    const countBadge = document.getElementById('results-count');
    countBadge.textContent = results.length;
    tbody.innerHTML = '';

    if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--gray-400); padding:60px 20px"><div class="empty-state"><h3>No se encontraron resultados</h3><p>Intenta ajustar los filtros de busqueda</p></div></td></tr>';
        return;
    }

    const rows = [];

    results.forEach(item => {
        let statusClass, statusText, codeText, priceText, qtyText, supplierText, expiryText, condText;

        if (item.reason === 'OK') {
            statusClass = 'status-valid';
            statusText = 'OK';
            codeText = item.barcode || '-';
            priceText = 'Bs ' + item.price.toFixed(2);
            qtyText = item.quantity + ' uds (req ' + item.required_qty + ')';
            supplierText = item.supplier_name;
            expiryText = item.months_until_expiration !== null && item.months_until_expiration !== undefined
                ? item.months_until_expiration + ' meses' : 'N/A';
            condText = item.special_conditions || '-';
        } else if (item.reason === 'INSUFFICIENT_STOCK') {
            statusClass = 'status-warning';
            statusText = 'Stock insuficiente';
            codeText = item.barcode || '-';
            priceText = item.price ? 'Bs ' + item.price.toFixed(2) : '-';
            qtyText = (item.quantity || 0) + ' uds (req ' + item.required_qty + ')';
            supplierText = item.supplier_name || '-';
            expiryText = '-';
            condText = '-';
        } else {
            statusClass = 'status-invalid';
            statusText = 'No encontrado';
            codeText = '-';
            priceText = '-';
            qtyText = '0 uds (req ' + item.required_qty + ')';
            supplierText = '-';
            expiryText = '-';
            condText = '-';
        }

        rows.push(`
            <tr>
                <td>${escapeHtml(codeText)}</td>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(supplierText)}</td>
                <td><strong>${priceText}</strong></td>
                <td>${qtyText}</td>
                <td>${expiryText}</td>
                <td>${escapeHtml(condText)}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
            </tr>
        `);
    });

    tbody.innerHTML = rows.join('');
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

    const MAX_ROWS = 1000;
    const shown = Math.min(results.length, MAX_ROWS);
    const rows = [];

    for (let i = 0; i < shown; i++) {
        const item = results[i];
        const statusClass = item.is_valid ? 'status-valid' : 'status-invalid';
        const statusText = item.is_valid ? 'Valida' : 'Rechazada';
        let expiryText = 'N/A';
        if (item.months_until_expiration !== null) expiryText = item.months_until_expiration + ' meses';

        rows.push(`
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
        `);
    }

    if (results.length > MAX_ROWS) {
        rows.push(`<tr><td colspan="8" style="text-align:center; color:var(--gray-400); padding:20px">Mostrando ${MAX_ROWS} de ${results.length} resultados. Usa los filtros para reducir la lista.</td></tr>`);
    }

    tbody.innerHTML = rows.join('');
}

// ----- EXPORT -----

function exportResults() {
    const farmaFilter = document.getElementById('farmadeleite-filter');
    if (farmaFilter && farmaFilter.checked) {
        const months = parseInt(document.getElementById('min-months').value) || 6;
        exportFarmadeleiteExcel(buildFarmadeleiteResults(months));
        return;
    }

    const search = document.getElementById('compare-search').value.trim();
    const qty = parseInt(document.getElementById('min-qty').value) || 5;
    const months = parseInt(document.getElementById('min-months').value) || 6;

    const results = search ? compare_product(search, qty, months) : get_best_prices(qty, months);

    if (typeof XLSX === 'undefined') { showToast('SheetJS no disponible', 'error'); return; }

    const wsData = [['Codigo', 'Producto', 'Laboratorio', 'Precio', 'Cantidad', 'Vencimiento', 'Condicion', 'Estado']];
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

function exportFarmadeleiteExcel(results) {
    if (typeof XLSX === 'undefined') { showToast('SheetJS no disponible', 'error'); return; }

    const wsData = [
        ['FILTRO FARMADELEITE'],
        ['Fecha: ' + new Date().toLocaleDateString()],
        [],
        ['#', 'Producto Requerido', 'Laboratorio', 'Codigo', 'Precio', 'Cant. Requerida', 'Stock Disp.', 'Vencimiento', 'Condicion', 'Estado']
    ];

    results.forEach((item, i) => {
        let estado, precio, stock, laboratorio, vencimiento, condicion;

        if (item.reason === 'OK') {
            estado = 'OK';
            precio = item.price;
            stock = item.quantity;
            laboratorio = item.supplier_name;
            vencimiento = item.months_until_expiration !== null && item.months_until_expiration !== undefined
                ? item.months_until_expiration + ' meses' : 'N/A';
            condicion = item.special_conditions || '-';
        } else if (item.reason === 'INSUFFICIENT_STOCK') {
            estado = 'STOCK INSUFICIENTE (tiene ' + (item.quantity || 0) + ' de ' + item.required_qty + ')';
            precio = item.price || '-';
            stock = item.quantity || 0;
            laboratorio = item.supplier_name || '-';
            vencimiento = '-';
            condicion = '-';
        } else {
            estado = 'NO ENCONTRADO';
            precio = '-';
            stock = 0;
            laboratorio = '-';
            vencimiento = '-';
            condicion = '-';
        }

        wsData.push([
            i + 1,
            item.name,
            laboratorio,
            item.barcode || '-',
            precio,
            item.required_qty,
            stock,
            vencimiento,
            condicion,
            estado
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
        { wch: 5 }, { wch: 40 }, { wch: 20 }, { wch: 18 },
        { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtro Farmadeleite');
    XLSX.writeFile(wb, 'filtro_farmadeleite_' + Date.now() + '.xlsx');
}

function downloadOrders() {
    const farmaFilter = document.getElementById('farmadeleite-filter');
    if (farmaFilter && farmaFilter.checked) {
        const months = parseInt(document.getElementById('min-months').value) || 6;
        const results = buildFarmadeleiteResults(months).filter(r => r.reason === 'OK');
        downloadOrdersExcel(results);
        return;
    }

    const search = document.getElementById('compare-search').value.trim();
    const qty = parseInt(document.getElementById('min-qty').value) || 5;
    const months = parseInt(document.getElementById('min-months').value) || 6;

    const results = search ? compare_product(search, qty, months) : get_best_prices(qty, months);
    const valid = results.filter(r => r.is_valid);
    downloadOrdersExcel(valid);
}

function downloadOrdersExcel(items) {
    if (items.length === 0) { showToast('No hay productos validos para generar ordenes', 'error'); return; }
    if (typeof XLSX === 'undefined') { showToast('SheetJS no disponible', 'error'); return; }

    const bySupplier = {};
    items.forEach(item => {
        if (!bySupplier[item.supplier_name]) bySupplier[item.supplier_name] = [];
        bySupplier[item.supplier_name].push(item);
    });

    const wb = XLSX.utils.book_new();
    const summaryData = [['Laboratorio', 'Productos', 'Subtotal']];
    let grandTotal = 0;

    Object.keys(bySupplier).sort().forEach(supplier => {
        const supplierItems = bySupplier[supplier];
        const sheetData = [
            ['Orden de Compra - ' + supplier],
            ['Fecha: ' + new Date().toLocaleDateString()],
            [],
            ['#', 'Codigo Barra', 'Producto', 'Precio Unit.', 'Cantidad', 'Subtotal', 'Condicion']
        ];

        let supplierTotal = 0;
        supplierItems.forEach((item, i) => {
            const qty = item.required_qty || item.quantity;
            const sub = item.price * qty;
            supplierTotal += sub;
            sheetData.push([i + 1, item.barcode || '-', item.product_name || item.name, item.price, qty, sub, item.special_conditions || '-']);
        });

        sheetData.push([]);
        sheetData.push(['', '', 'TOTAL', '', '', supplierTotal]);

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, ws, supplier.substring(0, 31));

        summaryData.push([supplier, supplierItems.length, supplierTotal]);
        grandTotal += supplierTotal;
    });

    summaryData.push([]);
    summaryData.push(['TOTAL GENERAL', items.length, grandTotal]);

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

    XLSX.writeFile(wb, 'ordenes_compra_' + Date.now() + '.xlsx');
}

// ----- FILTRO / ORDEN FARMADELEITE -----

const FARMADELEITE_DEFAULT = [
    { name: "Ketoprofeno amp. IV.", qty: 6, terms: ["ketoprofeno"] },
    { name: "Lagrioftol gotas", qty: 6, terms: ["lagrioftol"] },
    { name: "Artrovit x30 tab.", qty: 6, terms: ["artrovit"] },
    { name: "3crema", qty: 6, terms: ["3crema"] },
    { name: "Klafenac 100mg", qty: 6, terms: ["klafenac"] },
    { name: "Diapaglix 10mg", qty: 6, terms: ["diapaglix"] },
    { name: "Cilostazol 50mg", qty: 6, terms: ["cilostazol"] },
    { name: "Carbatil 6,25mg", qty: 6, terms: ["carbatil"] },
    { name: "Metformina 1000mg spefar", qty: 12, terms: ["metformina"] },
    { name: "Xerograx x30 tab.", qty: 12, terms: ["xerograx"] },
    { name: "Xerograx x60 tab.", qty: 12, terms: ["xerograx", "x60"] },
    { name: "Mascarilla ojos Zoah", qty: 12, terms: ["zoah"] },
    { name: "Escitalopram 10mg x30 tab. Rowe", qty: 12, terms: ["escitalopram", "rowe"] },
    { name: "Escitalopram 10mg x28 tab. Calox", qty: 12, terms: ["escitalopram", "calox"] },
    { name: "Solucion 0,9% de 100ml", qty: 12, terms: ["solucion", "0,9"] },
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
    { name: "Protector solar Dernier Spray 200mL coco", qty: 3, terms: ["dernier"] },
    { name: "Miovit x30 tab.", qty: 12, terms: ["miovit"] }
];

function normalizeFarmaTerm(text) {
    return (text || '').toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ').trim();
}

function normBarcode(text) {
    return (text || '').toString().trim().replace(/\s+/g, '');
}

// Devuelve la lista editable de productos requeridos (localStorage) o la por defecto.
function getFarmadeleiteList() {
    const stored = Store.getFarmadeleite();
    if (Array.isArray(stored)) return stored;
    return FARMADELEITE_DEFAULT;
}

function saveFarmadeleiteList(list) {
    Store.setFarmadeleite(list);
}

// Busca un producto de la lista Farmadeleite entre TODOS los archivos cargados.
function findFarmaProduct(req, minMonths, ctx, normProducts) {
    const { allProducts, supplierById, pricesByProduct } = ctx || buildIndexes();

    if (!normProducts) {
        normProducts = allProducts.map(p => ({ p: p, n: normalizeFarmaTerm(p.name) }));
    }

    const terms = req.terms.map(normalizeFarmaTerm);
    const barcode = req.barcode ? normBarcode(req.barcode) : null;
    const matching = [];
    for (let i = 0; i < normProducts.length; i++) {
        const np = normProducts[i];
        let ok = false;
        if (terms.length > 0) {
            ok = true;
            for (let j = 0; j < terms.length; j++) {
                if (np.n.indexOf(terms[j]) === -1) { ok = false; break; }
            }
        }
        if (!ok && barcode) {
            const pb = np.p.barcode ? normBarcode(np.p.barcode) : '';
            ok = pb === barcode;
            if (!ok && barcode.length >= 4 && (pb.indexOf(barcode) !== -1 || barcode.indexOf(pb) !== -1)) {
                ok = true;
            }
        }
        if (ok) matching.push(np.p);
    }

    if (matching.length === 0) {
        return { reason: 'NOT_FOUND', required_qty: req.qty };
    }

    const today = new Date();
    const cutoffDate = new Date(today.getTime() + minMonths * 30 * 24 * 60 * 60 * 1000);

    let bestValid = null;
    let bestStock = null;

    for (const product of matching) {
        const productPrices = pricesByProduct.get(product.id) || [];
        for (const price of productPrices) {
            const supplier = supplierById.get(price.supplier_id);
            const monthsLeft = price.expiration_date
                ? Math.round((new Date(price.expiration_date) - today) / (30 * 24 * 60 * 60 * 1000) * 10) / 10
                : null;
            const shelfOk = !price.expiration_date || new Date(price.expiration_date) > cutoffDate;

            const offer = {
                product_id: product.id,
                barcode: product.barcode,
                product_name: product.name,
                supplier_name: supplier ? supplier.name : 'Desconocido',
                price: price.price,
                quantity: price.quantity,
                months_until_expiration: monthsLeft,
                special_conditions: price.special_conditions
            };

            if (!bestStock || price.quantity > bestStock.quantity) {
                bestStock = Object.assign({}, offer);
            }

            if (price.quantity >= req.qty && shelfOk) {
                if (!bestValid || price.price < bestValid.price) {
                    bestValid = Object.assign({}, offer);
                }
            }
        }
    }

    if (bestValid) {
        return Object.assign({ reason: 'OK', required_qty: req.qty }, bestValid);
    }
    return Object.assign({ reason: 'INSUFFICIENT_STOCK', required_qty: req.qty }, bestStock || {});
}

function buildFarmadeleiteResults(minMonths) {
    const ctx = buildIndexes();
    const normProducts = ctx.allProducts.map(p => ({ p: p, n: normalizeFarmaTerm(p.name) }));
    return getFarmadeleiteList().map(req => Object.assign({ name: req.name }, findFarmaProduct(req, minMonths, ctx, normProducts)));
}

function searchFarmaProduct(terms) {
    const result = findFarmaProduct({ terms: terms, qty: 0 }, 6);
    if (result.reason === 'OK') {
        const clean = Object.assign({}, result);
        delete clean.reason;
        delete clean.required_qty;
        return clean;
    }
    return null;
}

function generateFarmadeleiteOrder() {
    if (typeof XLSX === 'undefined') { showToast('SheetJS no disponible', 'error'); return; }

    const months = parseInt(document.getElementById('min-months').value) || 6;
    const results = buildFarmadeleiteResults(months);

    const found = [];
    const insufficient = [];
    const notFound = [];

    results.forEach(item => {
        if (item.reason === 'OK') found.push(item);
        else if (item.reason === 'INSUFFICIENT_STOCK') insufficient.push(item);
        else notFound.push(item);
    });

    const wb = XLSX.utils.book_new();

    const orderData = [
        ['ORDEN DE COMPRA - FARMADELEITE'],
        ['Fecha: ' + new Date().toLocaleDateString()],
        [],
        ['#', 'Producto Requerido', 'Laboratorio', 'Codigo', 'Precio Unit.', 'Cant. Requerida', 'Stock Disp.', 'Subtotal', 'Estado']
    ];

    let total = 0;
    let totalItems = 0;

    found.forEach((item, i) => {
        const subtotal = item.required_qty * item.price;
        total += subtotal;
        totalItems += item.required_qty;
        orderData.push([
            i + 1,
            item.name,
            item.supplier_name,
            item.barcode || '-',
            item.price,
            item.required_qty,
            item.quantity,
            subtotal,
            item.special_conditions || '-'
        ]);
    });

    insufficient.forEach(item => {
        orderData.push([
            '-',
            item.name,
            item.supplier_name || '-',
            item.barcode || '-',
            item.price || '-',
            item.required_qty,
            item.quantity || 0,
            0,
            'STOCK INSUFICIENTE (tiene ' + (item.quantity || 0) + ' de ' + item.required_qty + ')'
        ]);
    });

    notFound.forEach(item => {
        orderData.push(['-', item.name, '-', '-', '-', item.required_qty, 0, 0, 'NO ENCONTRADO']);
    });

    orderData.push([]);
    orderData.push(['', '', '', '', 'TOTAL', totalItems, '', total]);

    const orderWs = XLSX.utils.aoa_to_sheet(orderData);
    orderWs['!cols'] = [
        { wch: 5 }, { wch: 40 }, { wch: 20 }, { wch: 18 },
        { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, orderWs, 'Orden Farmadeleite');

    XLSX.writeFile(wb, 'orden_farmadeleite_' + Date.now() + '.xlsx');

    showToast(
        `OK: ${found.length} | Stock insuf.: ${insufficient.length} | No enc.: ${notFound.length} | Total: Bs ${total.toFixed(2)}`,
        found.length > 0 ? 'success' : 'error'
    );
}

// ----- EDICION DE PRODUCTOS REQUERIDOS -----

let editingFarmaIndex = null;

function initRequirementsHandlers() {
    const form = document.getElementById('farma-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('farma-name').value.trim();
            const qty = parseInt(document.getElementById('farma-qty').value) || 3;
            const termsText = document.getElementById('farma-terms').value.trim();
            const barcode = document.getElementById('farma-barcode').value.trim();
            if (!name) { showToast('Ingresa el nombre del producto', 'error'); return; }

            const terms = termsText.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
            if (terms.length === 0 && !barcode) { showToast('Ingresa terminos de busqueda o un codigo de barras', 'error'); return; }

            const list = getFarmadeleiteList();
            if (editingFarmaIndex !== null) {
                list[editingFarmaIndex] = { name: name, qty: qty, terms: terms, barcode: barcode };
                showToast('Producto actualizado', 'success');
                cancelFarmaEdit();
            } else {
                list.push({ name: name, qty: qty, terms: terms, barcode: barcode });
                showToast('Producto agregado', 'success');
            }
            saveFarmadeleiteList(list);
            form.reset();
            loadRequirements();
        });
    }

    const cancelBtn = document.getElementById('farma-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { cancelFarmaEdit(); loadRequirements(); });

    const resetBtn = document.getElementById('farma-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (!confirm('Restaurar la lista por defecto de productos requeridos?')) return;
            try { localStorage.removeItem('farmapp_farmadeleite'); } catch (err) { }
            cancelFarmaEdit();
            loadRequirements();
            showToast('Lista restaurada a la version por defecto', 'success');
        });
    }
}

function cancelFarmaEdit() {
    editingFarmaIndex = null;
    const form = document.getElementById('farma-form');
    if (form) form.reset();
    const title = document.getElementById('farma-form-title');
    if (title) title.textContent = 'Agregar Producto Requerido';
    const submit = document.getElementById('farma-submit');
    if (submit) submit.textContent = 'Agregar';
    const cancel = document.getElementById('farma-cancel');
    if (cancel) cancel.style.display = 'none';
}

function loadRequirements() {
    const list = getFarmadeleiteList();
    const tbody = document.querySelector('#farma-table tbody');
    const rows = [];

    list.forEach((item, i) => {
        rows.push(`
            <tr>
                <td>${i + 1}</td>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.barcode || '-')}</td>
                <td>${item.qty}</td>
                <td>${escapeHtml(item.terms.join(', '))}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editFarmaProduct(${i})">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteFarmaProduct(${i})">Eliminar</button>
                </td>
            </tr>
        `);
    });

    tbody.innerHTML = rows.join('');
    const countEl = document.getElementById('farma-count');
    if (countEl) countEl.textContent = list.length;
}

function editFarmaProduct(index) {
    const list = getFarmadeleiteList();
    const item = list[index];
    if (!item) return;

    editingFarmaIndex = index;
    document.getElementById('farma-name').value = item.name;
    document.getElementById('farma-qty').value = item.qty;
    document.getElementById('farma-terms').value = item.terms.join(', ');
    document.getElementById('farma-barcode').value = item.barcode || '';
    document.getElementById('farma-form-title').textContent = 'Editar Producto Requerido';
    document.getElementById('farma-submit').textContent = 'Guardar Cambios';
    document.getElementById('farma-cancel').style.display = 'inline-flex';
    document.getElementById('farma-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteFarmaProduct(index) {
    const list = getFarmadeleiteList();
    const item = list[index];
    if (!item) return;
    if (!confirm('Eliminar "' + item.name + '" de la lista?')) return;

    list.splice(index, 1);
    saveFarmadeleiteList(list);
    if (editingFarmaIndex === index) cancelFarmaEdit();
    loadRequirements();
    showToast('Producto eliminado', 'success');
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
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ----- INIT -----

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initUploadHandlers();
    initCompareHandlers();
    initProductsHandlers();
    initRequirementsHandlers();
    loadDashboard();
});
