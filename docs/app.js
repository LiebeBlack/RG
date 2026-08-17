/**
 * Ky! Movies — Catálogo Interactivo de Películas
 * Versión de Rendimiento Extremo & 0 LAG:
 * - Deduplicación multi-nivel garantizada (Cero carátulas o películas repetidas)
 * - 0 LAG y scroll nativo fluido en Android y pantallas táctiles
 * - Carga ultrarrápida con priorización LCP y caché LRU de 0ms
 * - Despeje milimétrico de cabecera y dock ergonómico para cualquier smartphone
 * - Cero fugas de memoria y ciclo de vida de peticiones con Epoch Guard
 */

// Configuración TMDB API
const TMDB_API_KEY = "b00622de54cd7522d4640d5e5c527936";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342"; // w342: formato ultraligero y nítido para móvil

// Mapeo de IDs de género a nombres en español
const GENRE_MAP = {
    28: 'Acción',
    12: 'Aventura',
    16: 'Animación',
    23: 'Comedia',
    35: 'Comedia',
    80: 'Crimen',
    99: 'Documental',
    18: 'Drama',
    10751: 'Familia',
    14: 'Fantasía',
    36: 'Historia',
    27: 'Terror',
    10402: 'Música',
    9648: 'Misterio',
    10749: 'Romance',
    878: 'Sci-Fi',
    10770: 'TV',
    53: 'Thriller',
    10752: 'Bélico',
    37: 'Western'
};

// Placeholder SVG estático codificado — Cero peticiones de red y Cero fugas
const DEFAULT_POSTER_PLACEHOLDER = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22342%22%20height%3D%22513%22%20viewBox%3D%220%200%20342%20513%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23101018%22%2F%3E%3Ccircle%20cx%3D%22171%22%20cy%3D%22220%22%20r%3D%2240%22%20fill%3D%22%23181826%22%2F%3E%3Cpath%20d%3D%22M150%20220%20L192%20220%20M171%20199%20L171%20241%22%20stroke%3D%22%238b5cf6%22%20stroke-width%3D%223.5%22%20stroke-linecap%3D%22round%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%22285%22%20font-family%3D%22sans-serif%22%20font-size%3D%2215%22%20font-weight%3D%22700%22%20fill%3D%22%2394a3b8%22%20text-anchor%3D%22middle%22%3ESin%20car%C3%A1tula%3C%2Ftext%3E%3C%2Fsvg%3E";

// Estado Global de la Aplicación
const AppState = {
    selectedMoviesMap: new Map(),       // Map<id, MovieObject> persistente
    tmdbMovies: [],                     // Películas mostradas en el catálogo
    movieLookup: new Map(),             // Lookup rápido Map<id, MovieObject> para eventos O(1)
    seenPosterPaths: new Set(),         // Set<string> para garantizar 0 carátulas repetidas
    seenNormalizedTitles: new Set(),   // Set<string> para garantizar 0 películas duplicadas
    currentPage: 1,
    totalPages: 1,
    isLoading: false,
    isLoadingMore: false,
    hasMorePages: true,
    currentQuery: '',
    currentCategory: 'all',
    currentSort: 'recent',
    searchLanguage: 'es-ES',
    currentDetailMovie: null,
    activeAbortController: null,
    currentRequestId: 0,                // Epoch Guard para evitar condiciones de carrera
    isModalInHistory: false             // Soporte botón atrás de Android
};

// Referencias seguras al DOM
const DOM = {
    grid: document.getElementById('movie-grid'),
    emptyState: document.getElementById('empty-state'),
    emptyStateMessage: document.getElementById('empty-state-message'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    categoryFilter: document.getElementById('category-filter'),
    sortFilter: document.getElementById('sort-filter'),
    totalCount: document.getElementById('total-count-number'),
    loadingOverlay: document.getElementById('loading-overlay'),
    infiniteLoading: document.getElementById('infinite-loading'),
    scrollSentinel: document.getElementById('scroll-sentinel'),

    // Carrito / Dock Flotante
    cart: document.getElementById('floating-cart'),
    cartCount: document.getElementById('cart-count'),
    btnViewList: document.getElementById('btn-view-list'),
    btnCopyList: document.getElementById('btn-copy-list'),
    btnShareWhatsapp: document.getElementById('btn-share-whatsapp'),

    // Modal de Selección
    selectionModal: document.getElementById('selection-modal'),
    selectedMoviesList: document.getElementById('selected-movies-list'),
    modalCartCount: document.getElementById('modal-cart-count'),
    btnDeselectAllModal: document.getElementById('btn-deselect-all-modal'),
    btnCopyModal: document.getElementById('btn-copy-modal'),
    btnShareModal: document.getElementById('btn-share-modal'),

    // Modal de Sinopsis
    synopsisModal: document.getElementById('synopsis-modal'),
    synopsisContent: document.getElementById('synopsis-content'),
    synopsisModalTitle: document.getElementById('synopsis-modal-title'),
    btnToggleSelectModal: document.getElementById('btn-toggle-select-modal'),

    // Notificaciones
    toastContainer: document.getElementById('toast-container')
};

// IntersectionObserver para Infinite Scroll
let sentinelObserver = null;

// Utility: Debounce para búsquedas reactivas
function debounce(fn, delay = 180) {
    let timer = null;
    return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn.apply(this, args);
        }, delay);
    };
}

// Utility: Sanitizar texto HTML sin crear elementos DOM (0 allocations)
const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const _escapeRe = /[&<>"']/;
function escapeHtml(text) {
    if (!text) return '';
    const str = String(text);
    if (!_escapeRe.test(str)) return str;
    return str.replace(/[&<>"']/g, ch => _escapeMap[ch]);
}

// Normalizar título para deduplicación
function normalizeTitleKey(title, year) {
    const cleanTitle = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanTitle}_${year || ''}`;
}

// Obtener nombre del género
function getGenreName(genreIds) {
    if (!genreIds || genreIds.length === 0) return 'Película';
    return GENRE_MAP[genreIds[0]] || 'Película';
}

// Obtener ID de género por nombre
function getGenreIdByName(genreName) {
    for (const [id, name] of Object.entries(GENRE_MAP)) {
        if (name.toLowerCase() === genreName.toLowerCase()) {
            return parseInt(id, 10);
        }
    }
    return null;
}

// Formatear año
function getYearFromDate(dateStr) {
    if (!dateStr) return '';
    return dateStr.split('-')[0] || '';
}

// Caché LRU en memoria para respuestas TMDB (Navegación instantánea en 0ms)
const TMDB_CACHE = new Map();
const MAX_CACHE_ENTRIES = 50;

/**
 * Peticiones a TMDB API con Cancelación Activa, Timeout de Conexión y Caché LRU
 */
async function fetchFromTMDB(endpoint, params = {}, signal = null) {
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('language', AppState.searchLanguage);
    url.searchParams.set('include_adult', 'false');

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    }

    const cacheKey = url.toString();
    if (TMDB_CACHE.has(cacheKey)) {
        return TMDB_CACHE.get(cacheKey);
    }

    const timeoutCtrl = new AbortController();
    const timeoutId = setTimeout(() => timeoutCtrl.abort(), 9000);

    const onParentAbort = () => timeoutCtrl.abort();
    if (signal) {
        if (signal.aborted) {
            clearTimeout(timeoutId);
            throw new DOMException('Aborted', 'AbortError');
        }
        signal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
        const response = await fetch(cacheKey, { signal: timeoutCtrl.signal });
        if (!response.ok) {
            throw new Error(`TMDB HTTP ${response.status}`);
        }
        const data = await response.json();

        if (TMDB_CACHE.size >= MAX_CACHE_ENTRIES) {
            const oldestKey = TMDB_CACHE.keys().next().value;
            TMDB_CACHE.delete(oldestKey);
        }
        TMDB_CACHE.set(cacheKey, data);
        return data;
    } finally {
        clearTimeout(timeoutId);
        if (signal) {
            signal.removeEventListener('abort', onParentAbort);
        }
    }
}

// Normalizar objeto película de TMDB
function normalizeTMDBMovie(item) {
    const rawOverview = item.overview ? item.overview.trim() : '';
    const year = getYearFromDate(item.release_date);
    const title = item.title || item.original_title || 'Sin título';
    return {
        id: item.id,
        title: title,
        overview: rawOverview,
        year: year,
        posterPath: item.poster_path,
        coverUrl: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : DEFAULT_POSTER_PLACEHOLDER,
        voteAverage: typeof item.vote_average === 'number' && item.vote_average > 0 ? item.vote_average.toFixed(1) : '0.0',
        category: getGenreName(item.genre_ids)
    };
}

// Obtener fecha actual en formato YYYY-MM-DD
function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Cargar películas desde la API con Deduplicación Multi-Nivel Estricta
 */
async function fetchMovies(page = 1, signal = null) {
    const query = AppState.currentQuery.trim();
    const category = AppState.currentCategory;
    const sort = AppState.currentSort;
    const today = getTodayDateString();

    let data;
    if (query) {
        data = await fetchFromTMDB('/search/movie', { query, page }, signal);
    } else {
        // Parámetros de servidor optimizados para máxima velocidad y 0 resultados basura
        const discoverParams = {
            'primary_release_date.lte': today,
            'vote_count.gte': sort === 'rating' ? 30 : 5,
            'with_runtime.gte': 40,
            'include_video': 'false',
            page
        };

        if (category !== 'all') {
            const genreId = getGenreIdByName(category);
            if (genreId) discoverParams.with_genres = genreId;
        }

        if (sort === 'rating') {
            discoverParams.sort_by = 'vote_average.desc';
        } else if (sort === 'recent') {
            discoverParams.sort_by = 'primary_release_date.desc';
        } else {
            discoverParams.sort_by = 'popularity.desc';
        }

        data = await fetchFromTMDB('/discover/movie', discoverParams, signal);
    }

    const rawResults = data.results || [];
    const movies = [];

    for (const item of rawResults) {
        if (!item || !item.id) continue;

        const title = item.title || item.original_title;
        if (!title) continue;

        // FILTRO 1: Debe tener carátula válida
        if (!item.poster_path) continue;

        // FILTRO 2: Solo estrenadas
        const releaseDate = item.release_date || '';
        if (!releaseDate || releaseDate.length < 4 || releaseDate > today) continue;

        // FILTRO 3: Sinopsis válida
        const overview = item.overview ? item.overview.trim() : '';
        if (!overview || overview.length < 12) continue;

        const year = getYearFromDate(releaseDate);
        const titleKey = normalizeTitleKey(title, year);

        // DEDUPLICACIÓN MULTI-CRITERIO:
        // 1. ID único
        if (AppState.movieLookup.has(item.id)) continue;
        // 2. Ruta de póster única (evita carátulas duplicadas en diferentes entradas de TMDB)
        if (AppState.seenPosterPaths.has(item.poster_path)) continue;
        // 3. Título + Año único
        if (AppState.seenNormalizedTitles.has(titleKey)) continue;

        // Registrar en sets de deduplicación
        AppState.seenPosterPaths.add(item.poster_path);
        AppState.seenNormalizedTitles.add(titleKey);

        const movieObj = normalizeTMDBMovie(item);
        movies.push(movieObj);
    }

    return {
        movies,
        totalPages: Math.min(data.total_pages || 1, 500)
    };
}

/**
 * Carga Inicial del Catálogo con Epoch Guard (0 Lag y 0 carreras asíncronas)
 */
async function loadInitialMovies() {
    const requestId = ++AppState.currentRequestId;

    if (AppState.activeAbortController) {
        AppState.activeAbortController.abort();
    }
    AppState.activeAbortController = new AbortController();
    const currentSignal = AppState.activeAbortController.signal;

    AppState.isLoading = true;

    AppState.currentPage = 1;
    AppState.tmdbMovies = [];
    AppState.movieLookup.clear();
    AppState.seenPosterPaths.clear();
    AppState.seenNormalizedTitles.clear();
    AppState.hasMorePages = true;

    if (DOM.emptyState) DOM.emptyState.classList.add('hidden');

    try {
        const result = await fetchMovies(1, currentSignal);
        if (requestId !== AppState.currentRequestId) return;

        AppState.tmdbMovies = result.movies;
        result.movies.forEach(m => AppState.movieLookup.set(m.id, m));
        AppState.totalPages = result.totalPages;
        AppState.currentPage = 2;
        AppState.hasMorePages = AppState.currentPage <= AppState.totalPages;

        if (AppState.tmdbMovies.length === 0) {
            if (DOM.grid) DOM.grid.replaceChildren();
            showEmptyState(true);
        } else {
            showEmptyState(false);
            renderCards(AppState.tmdbMovies, false);
            // Pre-llenar pantalla si hay espacio sobrante
            setTimeout(checkAutoFillScreen, 250);
        }

        updateTotalCount();
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Error cargando catálogo:', error);
        showToast('Error al conectar con el catálogo.', 'error');
        showEmptyState(true, 'Hubo un problema de conexión al cargar las películas.');
    } finally {
        if (requestId === AppState.currentRequestId) {
            AppState.isLoading = false;
            showLoadingOverlay(false);
        }
    }
}

/**
 * Cargar Más Películas — Scroll Infinito Continuo Sin Límite
 */
async function loadMoreMovies() {
    if (AppState.isLoadingMore || !AppState.hasMorePages || AppState.isLoading) return;

    const requestId = AppState.currentRequestId;
    AppState.isLoadingMore = true;
    showInfiniteLoading(true);

    try {
        const signal = AppState.activeAbortController ? AppState.activeAbortController.signal : null;
        const accumulatedMovies = [];
        let attempts = 0;

        // Cargar continuamente hasta reunir un lote sustancial de carátulas nuevas
        while (AppState.currentPage <= AppState.totalPages && accumulatedMovies.length < 12 && attempts < 4) {
            attempts++;
            const result = await fetchMovies(AppState.currentPage, signal);
            if (requestId !== AppState.currentRequestId) return;

            AppState.currentPage++;
            AppState.totalPages = result.totalPages;

            if (result.movies && result.movies.length > 0) {
                accumulatedMovies.push(...result.movies);
                AppState.tmdbMovies.push(...result.movies);
                result.movies.forEach(m => AppState.movieLookup.set(m.id, m));
            }
        }

        if (accumulatedMovies.length > 0) {
            renderCards(accumulatedMovies, true);
        }

        AppState.hasMorePages = AppState.currentPage <= AppState.totalPages;
        updateTotalCount();
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error cargando más películas:', error);
        }
    } finally {
        if (requestId === AppState.currentRequestId) {
            AppState.isLoadingMore = false;
            showInfiniteLoading(false);
            // Verificar si se necesita seguir cargando
            setTimeout(checkAutoFillScreen, 300);
        }
    }
}

/**
 * Llenado automático anticipado para scroll infinito ininterrumpido
 */
function checkAutoFillScreen() {
    if (AppState.hasMorePages && !AppState.isLoadingMore && !AppState.isLoading) {
        const scrollBottom = window.innerHeight + window.scrollY;
        const docHeight = document.documentElement.scrollHeight;
        if (docHeight <= scrollBottom + 1000) {
            loadMoreMovies();
        }
    }
}

/**
 * Renderizado de Tarjetas Optimizado para 60/120 FPS
 */
function renderCards(movies, isAppend = false) {
    if (!DOM.grid || movies.length === 0) return;
    const fragment = document.createDocumentFragment();

    movies.forEach((movie, index) => {
        const isSelected = AppState.selectedMoviesMap.has(movie.id);
        const card = document.createElement('div');
        card.className = `movie-card ${isSelected ? 'selected' : ''}`;
        card.dataset.id = movie.id;
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `${movie.title} (${movie.year || 'S/F'}) - ${movie.category}. Toca para seleccionar, mantén pulsado para ver sinopsis.`);

        const safeTitle = escapeHtml(movie.title);
        const safeCategory = escapeHtml(movie.category);
        const safeYear = escapeHtml(movie.year);
        const safeRating = escapeHtml(movie.voteAverage);

        // Optimización LCP Extrema: Las primeras 4 tarjetas llevan fetchpriority="high" y eager
        const isLCPCandidate = !isAppend && index < 4;
        const loadingAttr = isLCPCandidate ? 'eager' : 'lazy';
        const fetchPriorityAttr = isLCPCandidate ? 'fetchpriority="high"' : '';

        card.innerHTML = `
            <div class="card-img-container">
                <img class="card-img" 
                     src="${movie.coverUrl}" 
                     alt="Carátula de ${safeTitle}" 
                     width="342"
                     height="513"
                     loading="${loadingAttr}"
                     ${fetchPriorityAttr}
                     decoding="async">
            </div>
            <div class="card-category-badge" aria-hidden="true">${safeCategory}</div>
            <div class="select-badge" aria-hidden="true">
                <i class="fa-solid fa-check"></i>
            </div>
            <div class="card-overlay">
                <h3 class="card-title" title="${safeTitle}">${safeTitle}</h3>
                <div class="card-meta">
                    ${safeYear ? `<span class="meta-pill year-pill">${safeYear}</span>` : ''}
                    <span class="meta-pill rating-pill"><i class="fa-solid fa-star" aria-hidden="true"></i> ${safeRating}</span>
                </div>
            </div>
        `;

        fragment.appendChild(card);
    });

    if (isAppend) {
        DOM.grid.appendChild(fragment);
    } else {
        DOM.grid.replaceChildren(fragment);
    }
}

/**
 * Gestor de Eventos y Gestos Táctiles con Cero Fugas de Memoria y 0 LAG
 */
function setupGridEventDelegation() {
    if (!DOM.grid) return;

    // Delegación de eventos en fase de captura para errores de imagen
    DOM.grid.addEventListener('error', (e) => {
        const img = e.target;
        if (img && img.tagName === 'IMG' && img.classList.contains('card-img')) {
            img.src = DEFAULT_POSTER_PLACEHOLDER;
        }
    }, true);

    let pressTimer = null;
    let isLongPress = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let activeHoldingCard = null;

    const cancelLongPress = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        if (activeHoldingCard) {
            activeHoldingCard.classList.remove('holding');
            activeHoldingCard = null;
        }
    };

    // Touch Start: Iniciar temporizador de pulsación prolongada
    DOM.grid.addEventListener('touchstart', (e) => {
        const card = e.target.closest('.movie-card');
        if (!card) return;

        isLongPress = false;
        activeHoldingCard = card;
        card.classList.add('holding');

        if (e.touches && e.touches[0]) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }

        const movieId = parseInt(card.dataset.id, 10);
        const movie = AppState.movieLookup.get(movieId);
        if (!movie) return;

        pressTimer = setTimeout(() => {
            isLongPress = true;
            if (activeHoldingCard) {
                activeHoldingCard.classList.remove('holding');
                activeHoldingCard = null;
            }

            // Vibración háptica en Android
            if (navigator.vibrate) {
                try { navigator.vibrate([30, 20, 30]); } catch (err) {}
            }

            openSynopsisModal(movie);
        }, 400);
    }, { passive: true });

    // Touch Move: Cancelar si el usuario hace scroll
    DOM.grid.addEventListener('touchmove', (e) => {
        if (!pressTimer) return;
        if (e.touches && e.touches[0]) {
            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);
            if (dx > 8 || dy > 8) {
                cancelLongPress();
            }
        }
    }, { passive: true });

    DOM.grid.addEventListener('touchend', cancelLongPress, { passive: true });
    DOM.grid.addEventListener('touchcancel', cancelLongPress, { passive: true });

    // Clic / Tap directo para seleccionar
    DOM.grid.addEventListener('click', (e) => {
        if (isLongPress) {
            isLongPress = false;
            return;
        }

        const card = e.target.closest('.movie-card');
        if (card) {
            const movieId = parseInt(card.dataset.id, 10);
            const movie = AppState.movieLookup.get(movieId);
            if (movie) toggleMovieSelection(movie, card);
        }
    });

    // Menú contextual en PC (clic derecho abre sinopsis)
    DOM.grid.addEventListener('contextmenu', (e) => {
        const card = e.target.closest('.movie-card');
        if (card) {
            e.preventDefault();
            const movieId = parseInt(card.dataset.id, 10);
            const movie = AppState.movieLookup.get(movieId);
            if (movie) openSynopsisModal(movie);
        }
    });

    // Teclado accesible
    DOM.grid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const card = e.target.closest('.movie-card');
            if (card) {
                e.preventDefault();
                const movieId = parseInt(card.dataset.id, 10);
                const movie = AppState.movieLookup.get(movieId);
                if (movie) toggleMovieSelection(movie, card);
            }
        }
    });
}

/**
 * Lógica de Selección y Carrito Persistente
 */
function toggleMovieSelection(movie, cardElement) {
    if (!movie || !movie.id) return;
    const isSelected = AppState.selectedMoviesMap.has(movie.id);

    if (isSelected) {
        AppState.selectedMoviesMap.delete(movie.id);
        if (cardElement) cardElement.classList.remove('selected');
    } else {
        AppState.selectedMoviesMap.set(movie.id, movie);
        if (cardElement) cardElement.classList.add('selected');
    }

    if (DOM.grid) {
        const targetCard = cardElement || DOM.grid.querySelector(`.movie-card[data-id="${movie.id}"]`);
        if (targetCard) {
            targetCard.classList.toggle('selected', AppState.selectedMoviesMap.has(movie.id));
        }
    }

    updateCartUI();
}

function updateCartUI() {
    const count = AppState.selectedMoviesMap.size;
    if (DOM.cartCount) DOM.cartCount.textContent = count;
    if (DOM.modalCartCount) DOM.modalCartCount.textContent = count;

    if (DOM.cart) {
        if (count > 0) {
            DOM.cart.classList.remove('hide-dock');
        } else {
            DOM.cart.classList.add('hide-dock');
        }
    }

    if (DOM.selectionModal && !DOM.selectionModal.classList.contains('hidden')) {
        renderSelectedList();
    }
}

// Renderizar lista de seleccionados en el modal
function renderSelectedList() {
    if (!DOM.selectedMoviesList) return;

    const selectedArray = Array.from(AppState.selectedMoviesMap.values());

    if (selectedArray.length === 0) {
        DOM.selectedMoviesList.innerHTML = `
            <li class="empty-state" style="margin: 16px auto; padding: 24px;">
                <p>No tienes películas seleccionadas todavía.</p>
            </li>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    selectedArray.forEach((movie, index) => {
        const li = document.createElement('li');
        li.className = 'selected-item';
        li.setAttribute('role', 'listitem');

        const safeTitle = escapeHtml(movie.title);
        const safeYear = escapeHtml(movie.year);
        const safeCategory = escapeHtml(movie.category);

        li.innerHTML = `
            <img class="selected-thumb" src="${movie.coverUrl}" alt="Portada de ${safeTitle}" width="48" height="72" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${DEFAULT_POSTER_PLACEHOLDER}';">
            <div class="selected-info">
                <span class="selected-title" title="${safeTitle}">${index + 1}. ${safeTitle}</span>
                <p class="selected-meta">${safeCategory}${safeYear ? ` • ${safeYear}` : ''}</p>
            </div>
            <button class="remove-item-btn" data-remove-id="${movie.id}" title="Quitar ${safeTitle}" aria-label="Quitar ${safeTitle} de la lista" type="button">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
        `;

        fragment.appendChild(li);
    });

    DOM.selectedMoviesList.replaceChildren(fragment);
}

// Vaciar selección completa
function deselectAllMovies() {
    if (AppState.selectedMoviesMap.size === 0) return;
    AppState.selectedMoviesMap.clear();

    if (DOM.grid) {
        DOM.grid.querySelectorAll('.movie-card.selected').forEach(c => c.classList.remove('selected'));
    }
    updateCartUI();
    closeModal(DOM.selectionModal);
    showToast('Lista vaciada correctamente', 'info');
}

/**
 * Formateo y Compartición (WhatsApp & Web Share API)
 */
function generateMoviesShareText() {
    const selectedArray = Array.from(AppState.selectedMoviesMap.values());
    if (selectedArray.length === 0) return '';

    let text = '🎬 Ky! Movies\n\n';
    const lines = selectedArray.map(movie => {
        const yearStr = movie.year ? ` (${movie.year})` : '';
        const catStr = movie.category ? ` · ${movie.category}` : '';
        return `${movie.title}${yearStr}${catStr}`;
    });

    text += lines.join('\n\n');
    text += `\n\nTotal: ${selectedArray.length} película${selectedArray.length > 1 ? 's' : ''}`;
    return text;
}

// Bandera interna para autorizar copiado programático por botón
let isAppInternalCopying = false;

async function copyMoviesList() {
    const text = generateMoviesShareText();
    if (!text) {
        showToast('Selecciona al menos una película primero', 'info');
        return;
    }

    isAppInternalCopying = true;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            textarea.setAttribute('readonly', '');
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        showToast('¡Lista copiada al portapapeles!', 'success');
    } catch (err) {
        console.error('Error al copiar:', err);
        showToast('No se pudo copiar automáticamente', 'error');
    } finally {
        isAppInternalCopying = false;
    }
}

async function shareMoviesList() {
    const text = generateMoviesShareText();
    if (!text) {
        showToast('Selecciona al menos una película primero', 'info');
        return;
    }

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Ky! Movies — Mi Selección',
                text: text
            });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
        }
    }

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Modales con Soporte para el Botón Atrás de Android
 */
function openModal(modalElement) {
    if (!modalElement) return;
    modalElement.classList.remove('hidden');
    document.body.classList.add('modal-open');

    if (!AppState.isModalInHistory) {
        AppState.isModalInHistory = true;
        history.pushState({ modalOpen: true }, '');
    }
}

function closeModal(modalElement) {
    if (!modalElement) return;
    modalElement.classList.add('hidden');
    const openModals = document.querySelectorAll('.modal:not(.hidden)');
    if (openModals.length === 0) {
        document.body.classList.remove('modal-open');
        AppState.currentDetailMovie = null;
    }
}

function closeAllModalsFromUI() {
    closeModal(DOM.selectionModal);
    closeModal(DOM.synopsisModal);
    if (AppState.isModalInHistory) {
        AppState.isModalInHistory = false;
        if (history.state && history.state.modalOpen) {
            history.back();
        }
    }
}

function openSynopsisModal(movie) {
    if (!DOM.synopsisModal || !DOM.synopsisContent || !movie) return;
    AppState.currentDetailMovie = movie;

    const safeTitle = escapeHtml(movie.title);
    const safeYear = escapeHtml(movie.year || 'S/A');
    const ratingVal = parseFloat(movie.voteAverage);
    const safeRating = ratingVal > 0 ? `${movie.voteAverage} / 10` : 'Sin calificación';
    const safeCategory = escapeHtml(movie.category);
    const fallbackDesc = `${movie.title} (${movie.year || 'Película'}) es una obra destacada del género ${movie.category}.`;
    const safeOverview = escapeHtml(movie.overview || fallbackDesc);

    if (DOM.synopsisModalTitle) {
        DOM.synopsisModalTitle.textContent = safeTitle;
    }

    DOM.synopsisContent.innerHTML = `
        <div class="synopsis-card-preview">
            <img class="synopsis-thumb" src="${movie.coverUrl}" alt="Portada de ${safeTitle}" width="90" height="135" decoding="async" onerror="this.onerror=null;this.src='${DEFAULT_POSTER_PLACEHOLDER}';">
            <div class="synopsis-header-info">
                <h3 class="synopsis-movie-title">${safeTitle}</h3>
                <div class="synopsis-badges">
                    <span class="synopsis-badge rating"><i class="fa-solid fa-star"></i> ${safeRating}</span>
                    <span class="synopsis-badge genre"><i class="fa-solid fa-film"></i> ${safeCategory}</span>
                    <span class="synopsis-badge"><i class="fa-regular fa-calendar"></i> ${safeYear}</span>
                </div>
            </div>
        </div>
        <div class="synopsis-text">
            <p>${safeOverview}</p>
        </div>
    `;

    updateSynopsisModalButton(movie.id);
    requestAnimationFrame(() => {
        openModal(DOM.synopsisModal);
    });
}

function updateSynopsisModalButton(movieId) {
    if (!DOM.btnToggleSelectModal) return;
    const isSelected = AppState.selectedMoviesMap.has(movieId);
    if (isSelected) {
        DOM.btnToggleSelectModal.className = 'btn btn-danger-outline w-100';
        DOM.btnToggleSelectModal.innerHTML = '<i class="fa-solid fa-xmark"></i> Quitar de mis películas';
    } else {
        DOM.btnToggleSelectModal.className = 'btn btn-primary w-100';
        DOM.btnToggleSelectModal.innerHTML = '<i class="fa-solid fa-check"></i> Seleccionar película';
    }
}

/**
 * Notificaciones Flotantes (Toasts) con Limpieza de Memoria
 */
function showToast(message, type = 'info') {
    if (!DOM.toastContainer) return;

    while (DOM.toastContainer.children.length >= 3) {
        const oldToast = DOM.toastContainer.firstChild;
        if (oldToast._toastTimer1) clearTimeout(oldToast._toastTimer1);
        if (oldToast._toastTimer2) clearTimeout(oldToast._toastTimer2);
        oldToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info');
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;

    DOM.toastContainer.appendChild(toast);

    toast._toastTimer1 = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.95)';
        toast.style.transition = 'all 0.2s ease';
        toast._toastTimer2 = setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 200);
    }, 2000);
}

/**
 * Control de Estado de Carga
 */
function showLoadingOverlay(show) {
    if (DOM.loadingOverlay) {
        if (show) DOM.loadingOverlay.classList.remove('hidden');
        else DOM.loadingOverlay.classList.add('hidden');
    }
}

function showInfiniteLoading(show) {
    if (DOM.infiniteLoading) {
        if (show) DOM.infiniteLoading.classList.remove('hidden');
        else DOM.infiniteLoading.classList.add('hidden');
    }
}

function showEmptyState(show, customMessage = '') {
    if (DOM.emptyState) {
        if (show) {
            DOM.emptyState.classList.remove('hidden');
            if (customMessage && DOM.emptyStateMessage) {
                DOM.emptyStateMessage.textContent = customMessage;
            }
        } else {
            DOM.emptyState.classList.add('hidden');
        }
    }
}

function updateTotalCount() {
    if (DOM.totalCount) {
        DOM.totalCount.textContent = AppState.tmdbMovies.length;
    }
}

/**
 * Centinela de Scroll Infinito con IntersectionObserver (0 CPU en Scroll Nativo)
 */
function setupScrollObserver() {
    if (sentinelObserver) {
        sentinelObserver.disconnect();
    }

    if (!DOM.scrollSentinel) return;

    sentinelObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !AppState.isLoadingMore && AppState.hasMorePages && !AppState.isLoading) {
                loadMoreMovies();
            }
        });
    }, {
        root: null,
        rootMargin: '1000px',
        threshold: 0
    });

    sentinelObserver.observe(DOM.scrollSentinel);
}

/**
 * Inicialización de Event Listeners
 */
function setupEventListeners() {
    setupGridEventDelegation();

    // Búsqueda con debounce
    const handleSearch = debounce(() => {
        const query = DOM.searchInput ? DOM.searchInput.value.trim() : '';
        AppState.currentQuery = query;
        if (DOM.btnClearSearch) {
            DOM.btnClearSearch.classList.toggle('hidden', query.length === 0);
        }
        loadInitialMovies();
    }, 180);

    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', handleSearch);
        DOM.searchInput.addEventListener('search', handleSearch);
    }

    if (DOM.btnClearSearch) {
        DOM.btnClearSearch.addEventListener('click', () => {
            if (DOM.searchInput) {
                DOM.searchInput.value = '';
                DOM.searchInput.focus();
            }
            DOM.btnClearSearch.classList.add('hidden');
            AppState.currentQuery = '';
            loadInitialMovies();
        });
    }

    if (DOM.categoryFilter) {
        DOM.categoryFilter.addEventListener('change', () => {
            AppState.currentCategory = DOM.categoryFilter.value;
            loadInitialMovies();
        });
    }

    if (DOM.sortFilter) {
        DOM.sortFilter.addEventListener('change', () => {
            AppState.currentSort = DOM.sortFilter.value;
            loadInitialMovies();
        });
    }

    if (DOM.btnResetFilters) {
        DOM.btnResetFilters.addEventListener('click', () => {
            if (DOM.searchInput) DOM.searchInput.value = '';
            if (DOM.btnClearSearch) DOM.btnClearSearch.classList.add('hidden');
            if (DOM.categoryFilter) DOM.categoryFilter.value = 'all';
            if (DOM.sortFilter) DOM.sortFilter.value = 'recent';

            AppState.currentQuery = '';
            AppState.currentCategory = 'all';
            AppState.currentSort = 'recent';
            loadInitialMovies();
        });
    }

    if (DOM.btnViewList) {
        DOM.btnViewList.addEventListener('click', () => {
            requestAnimationFrame(() => {
                renderSelectedList();
                openModal(DOM.selectionModal);
            });
        });
    }

    if (DOM.btnCopyList) {
        DOM.btnCopyList.addEventListener('click', (e) => {
            e.stopPropagation();
            copyMoviesList();
        });
    }

    if (DOM.btnShareWhatsapp) {
        DOM.btnShareWhatsapp.addEventListener('click', (e) => {
            e.stopPropagation();
            shareMoviesList();
        });
    }

    if (DOM.selectedMoviesList) {
        DOM.selectedMoviesList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-remove-id]');
            if (removeBtn) {
                const movieId = parseInt(removeBtn.dataset.removeId, 10);
                const movie = AppState.selectedMoviesMap.get(movieId);
                if (movie) toggleMovieSelection(movie, null);
            }
        });
    }

    if (DOM.btnDeselectAllModal) {
        DOM.btnDeselectAllModal.addEventListener('click', deselectAllMovies);
    }
    if (DOM.btnCopyModal) {
        DOM.btnCopyModal.addEventListener('click', copyMoviesList);
    }
    if (DOM.btnShareModal) {
        DOM.btnShareModal.addEventListener('click', shareMoviesList);
    }

    if (DOM.btnToggleSelectModal) {
        DOM.btnToggleSelectModal.addEventListener('click', () => {
            if (AppState.currentDetailMovie) {
                toggleMovieSelection(AppState.currentDetailMovie, null);
                updateSynopsisModalButton(AppState.currentDetailMovie.id);
            }
        });
    }

    document.querySelectorAll('[data-close-modal], .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', closeAllModalsFromUI);
    });

    window.addEventListener('popstate', () => {
        AppState.isModalInHistory = false;
        closeModal(DOM.selectionModal);
        closeModal(DOM.synopsisModal);
    });

    // Deshabilitar menú contextual de clic derecho en toda la página web
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Deshabilitar selección manual de texto en la interfaz (sin afectar inputs o textareas)
    document.addEventListener('selectstart', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
            return;
        }
        e.preventDefault();
    });

    // Deshabilitar copiado manual de texto en la web (excepto el botón Copiar de la app o dentro de inputs)
    document.addEventListener('copy', (e) => {
        if (isAppInternalCopying) return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
            return;
        }
        e.preventDefault();
    });

    // Búsqueda con enter inmediato o debounce
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = DOM.searchInput.value.trim();
                AppState.currentQuery = query;
                if (DOM.btnClearSearch) {
                    DOM.btnClearSearch.classList.toggle('hidden', query.length === 0);
                }
                loadInitialMovies();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModalsFromUI();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (DOM.searchInput) DOM.searchInput.focus();
        }
    });
}

/**
 * Inicialización al Cargar el DOM
 */
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    setupScrollObserver();
    await loadInitialMovies();
});
