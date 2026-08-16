/**
 * Ky! Movies — Catálogo Interactivo de Películas
 * Versión Final de Producción:
 * - Carga fluida, sin duplicados ni errores en búsquedas o filtros
 * - Títulos grandes y legibles con quiebre de hasta 4 líneas
 * - Optimización Core Web Vitals (LCP) con fetchpriority="high" en carátulas visibles
 * - Long-Press táctil con vibración Android y botón atrás nativo (popstate)
 * - Cero botones sobrantes en carátulas (experiencia limpia y directa)
 * - Cero fugas de memoria y delegación de eventos en el Grid
 */

// TMDB API Configuration
const TMDB_API_KEY = "b00622de54cd7522d4640d5e5c527936";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342"; // w342: carga ultraligera y nítida en móvil

// Mapeo de IDs de género a nombres en español
const GENRE_MAP = {
    28: 'Acción',
    12: 'Aventura',
    16: 'Animación',
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

// Placeholder SVG estático codificado — Cero generación dinámica y Cero fugas de memoria
const DEFAULT_POSTER_PLACEHOLDER = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22342%22%20height%3D%22513%22%20viewBox%3D%220%200%20342%20513%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23101018%22%2F%3E%3Ccircle%20cx%3D%22171%22%20cy%3D%22220%22%20r%3D%2240%22%20fill%3D%22%23181826%22%2F%3E%3Cpath%20d%3D%22M150%20220%20L192%20220%20M171%20199%20L171%20241%22%20stroke%3D%22%238b5cf6%22%20stroke-width%3D%223.5%22%20stroke-linecap%3D%22round%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%22285%22%20font-family%3D%22sans-serif%22%20font-size%3D%2215%22%20font-weight%3D%22700%22%20fill%3D%22%2394a3b8%22%20text-anchor%3D%22middle%22%3ESin%20car%C3%A1tula%3C%2Ftext%3E%3C%2Fsvg%3E";

// Estado Global de la Aplicación
const AppState = {
    selectedMoviesMap: new Map(), // Map<id, MovieObject> persistente
    tmdbMovies: [],               // Películas cargadas en catálogo infinito
    movieLookup: new Map(),       // Lookup rápido Map<id, MovieObject> para delegación de eventos O(1)
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
    isModalInHistory: false       // Control de historial para el botón atrás de Android
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

// Utility: Debounce
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

// Utility: Sanitizar texto HTML (sin crear elementos DOM — cero allocations)
const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const _escapeRe = /[&<>"']/;
function escapeHtml(text) {
    if (!text) return '';
    const str = String(text);
    if (!_escapeRe.test(str)) return str;
    return str.replace(/[&<>"']/g, ch => _escapeMap[ch]);
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

// Caché en memoria para peticiones TMDB (Navegación instantánea en 0ms y cero consumo de datos en filtros repetidos)
const TMDB_CACHE = new Map();
const MAX_CACHE_ENTRIES = 80;

/**
 * Peticiones a TMDB API con Cancelación Activa y Caché Rápida
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

    const fetchOptions = signal ? { signal } : {};
    const response = await fetch(cacheKey, fetchOptions);
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
}

// Normalizar objeto película de TMDB (memoria mínima y textos informativos impecables)
function normalizeTMDBMovie(item) {
    const rawOverview = item.overview ? item.overview.trim() : '';
    return {
        id: item.id,
        title: item.title || item.original_title || 'Sin título',
        overview: rawOverview,
        year: getYearFromDate(item.release_date),
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

// Cargar películas desde la API con estricto filtro de estreno digital, carátulas reales y sinopsis completa
async function fetchMovies(page = 1, signal = null) {
    const query = AppState.currentQuery.trim();
    const category = AppState.currentCategory;
    const sort = AppState.currentSort;
    const today = getTodayDateString();

    let data;
    if (query) {
        data = await fetchFromTMDB('/search/movie', { query, page }, signal);
    } else {
        // Descubrimiento estricto de títulos ya estrenados con carátulas disponibles
        const discoverParams = {
            'primary_release_date.lte': today,
            'vote_count.gte': sort === 'rating' ? 30 : 2,
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
    const seenIds = new Set();
    const movies = [];

    for (const item of rawResults) {
        if (!item || !item.id) continue;

        // Exigir título
        const title = item.title || item.original_title;
        if (!title) continue;

        // FILTRO ESTRICTO 1: Solo películas que TENGAN CARÁTULA REAL
        if (!item.poster_path) continue;

        // FILTRO ESTRICTO 2: Solo películas YA ESTRENADAS (fecha válida y <= hoy)
        const releaseDate = item.release_date || '';
        if (!releaseDate || releaseDate.length < 4 || releaseDate > today) continue;

        // FILTRO ESTRICTO 3: Solo películas con SINOPSIS REAL (Cero textos vacíos o incompletos)
        const overview = item.overview ? item.overview.trim() : '';
        if (!overview || overview.length < 15) continue;

        if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            movies.push(normalizeTMDBMovie(item));
        }
    }

    return {
        movies,
        totalPages: Math.min(data.total_pages || 1, 500)
    };
}

/**
 * Motor de Renderizado Ultrarrápido con Optimización LCP y Liberación de Memoria
 */
async function loadInitialMovies() {
    if (AppState.activeAbortController) {
        AppState.activeAbortController.abort();
    }
    AppState.activeAbortController = new AbortController();
    const currentSignal = AppState.activeAbortController.signal;

    AppState.isLoading = true;
    showLoadingOverlay(true);

    AppState.currentPage = 1;
    AppState.tmdbMovies = [];
    AppState.movieLookup.clear();
    AppState.hasMorePages = true;

    if (DOM.grid) DOM.grid.replaceChildren();
    if (DOM.emptyState) DOM.emptyState.classList.add('hidden');

    try {
        const result = await fetchMovies(1, currentSignal);
        AppState.tmdbMovies = result.movies;
        result.movies.forEach(m => AppState.movieLookup.set(m.id, m));
        AppState.totalPages = result.totalPages;
        AppState.currentPage = 2;
        AppState.hasMorePages = AppState.currentPage <= AppState.totalPages;

        if (AppState.tmdbMovies.length === 0) {
            showEmptyState(true);
        } else {
            showEmptyState(false);
            renderCards(AppState.tmdbMovies, false);
        }

        updateTotalCount();
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Error cargando catálogo:', error);
        showToast('Error al conectar con el catálogo.', 'error');
        showEmptyState(true, 'Hubo un problema de conexión al cargar las películas.');
    } finally {
        AppState.isLoading = false;
        showLoadingOverlay(false);
        // Comprobar si la pantalla necesita más elementos para activar scroll
        setTimeout(checkAutoFillScreen, 300);
    }
}

// Cargar más películas (Scroll Infinito Real sin Límite con Deduplicación O(1))
async function loadMoreMovies() {
    if (AppState.isLoadingMore || !AppState.hasMorePages || AppState.isLoading) return;

    AppState.isLoadingMore = true;
    showInfiniteLoading(true);

    try {
        let attempts = 0;
        let addedCount = 0;

        while (AppState.currentPage <= AppState.totalPages && addedCount === 0 && attempts < 3) {
            attempts++;
            const result = await fetchMovies(AppState.currentPage, null);
            const newMovies = result.movies.filter(m => !AppState.movieLookup.has(m.id));

            AppState.currentPage++;
            AppState.totalPages = result.totalPages;

            if (newMovies.length > 0) {
                addedCount = newMovies.length;
                AppState.tmdbMovies.push(...newMovies);
                newMovies.forEach(m => AppState.movieLookup.set(m.id, m));
                renderCards(newMovies, true);
            }
        }

        AppState.hasMorePages = AppState.currentPage <= AppState.totalPages;
        updateTotalCount();
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error cargando más películas:', error);
        }
    } finally {
        AppState.isLoadingMore = false;
        showInfiniteLoading(false);
    }
}

function checkAutoFillScreen() {
    if (document.documentElement.scrollHeight <= window.innerHeight + 600 && AppState.hasMorePages && !AppState.isLoadingMore && !AppState.isLoading) {
        loadMoreMovies();
    }
}

/**
 * Renderizado de Tarjetas con Optimización LCP
 * Cero manejadores inline: las imágenes usan delegación de eventos en fase de captura.
 */
function renderCards(movies, isAppend = false) {
    if (!DOM.grid) return;
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

        // Optimización LCP: Las primeras 6 tarjetas visibles se cargan con eager y fetchpriority="high"
        const isAboveTheFold = !isAppend && index < 6;
        const loadingAttr = isAboveTheFold ? 'eager' : 'lazy';
        const fetchPriorityAttr = isAboveTheFold ? 'fetchpriority="high"' : '';

        card.innerHTML = `
            <div class="card-img-container">
                <img class="card-img" 
                     src="${movie.coverUrl}" 
                     alt="Carátula de ${safeTitle}" 
                     width="342"
                     height="513"
                     loading="${loadingAttr}"
                     ${fetchPriorityAttr}
                     decoding="async"
                     onerror="this.onerror=null;this.src='${DEFAULT_POSTER_PLACEHOLDER}';">
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
 * Gestor de Eventos y Gestos Táctiles con Cero Fugas de Memoria
 */
function setupGridEventDelegation() {
    if (!DOM.grid) return;

    // Delegación de eventos en fase de captura para carga de imágenes (Zero closures inline)
    DOM.grid.addEventListener('error', (e) => {
        const img = e.target;
        if (img && img.tagName === 'IMG' && img.classList.contains('card-img')) {
            img.src = DEFAULT_POSTER_PLACEHOLDER;
            img.classList.add('loaded');
        }
    }, true);

    DOM.grid.addEventListener('load', (e) => {
        const img = e.target;
        if (img && img.tagName === 'IMG' && img.classList.contains('card-img')) {
            img.classList.add('loaded');
        }
    }, true);

    let pressTimer = null;
    let isLongPress = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let activeHoldingCard = null;

    // Cancelación rápida y ligera con guard clause
    const cancelLongPress = () => {
        if (!pressTimer && !activeHoldingCard) return;
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
                try { navigator.vibrate([35, 20, 35]); } catch (err) {}
            }

            openSynopsisModal(movie);
        }, 420);
    }, { passive: true });

    // Touch Move: Cancelar Long Press si el usuario se desplaza
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
    window.addEventListener('scroll', cancelLongPress, { passive: true });
    window.addEventListener('blur', cancelLongPress, { passive: true });

    // Clic / Tap directo
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

    // Actualizar tarjeta en la cuadrícula de forma directa
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

// Renderizar la lista de películas seleccionadas en el modal con replaceChildren
function renderSelectedList() {
    if (!DOM.selectedMoviesList) return;

    const selectedArray = Array.from(AppState.selectedMoviesMap.values());

    if (selectedArray.length === 0) {
        DOM.selectedMoviesList.innerHTML = `
            <li class="empty-state" style="margin: 20px auto; padding: 30px;">
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
            <img class="selected-thumb" src="${movie.coverUrl}" alt="Portada de ${safeTitle}" width="52" height="78" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${DEFAULT_POSTER_PLACEHOLDER}';">
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

// Copiar al portapapeles
async function copyMoviesList() {
    const text = generateMoviesShareText();
    if (!text) {
        showToast('Selecciona al menos una película primero', 'info');
        return;
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        showToast('¡Lista copiada al portapapeles!', 'success');
    } catch (err) {
        console.error('Error al copiar:', err);
        showToast('No se pudo copiar automáticamente', 'error');
    }
}

// Compartir mediante Web Share API o WhatsApp directo
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
 * Modales con Soporte para el Botón Atrás de Android (History API)
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
            <img class="synopsis-thumb" src="${movie.coverUrl}" alt="Portada de ${safeTitle}" width="100" height="150" decoding="async" onerror="this.onerror=null;this.src='${DEFAULT_POSTER_PLACEHOLDER}';">
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
    openModal(DOM.synopsisModal);
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
 * Notificaciones Flotantes (Toasts) — con limpieza robusta de temporizadores
 */
function showToast(message, type = 'info') {
    if (!DOM.toastContainer) return;

    // Limpiar toasts anteriores y cancelar sus temporizadores pendientes para evitar fugas
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
        toast.style.transition = 'all 0.25s ease';
        toast._toastTimer2 = setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 250);
    }, 2200);
}

/**
 * Funciones de Control de Estado de Carga
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
 * Configuración del Centinela (IntersectionObserver para Infinite Scroll)
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
        rootMargin: '1200px',
        threshold: 0
    });

    sentinelObserver.observe(DOM.scrollSentinel);

    // Fallback de scroll nativo para máxima compatibilidad móvil y de escritorio
    window.addEventListener('scroll', () => {
        if (AppState.isLoadingMore || !AppState.hasMorePages || AppState.isLoading) return;
        const scrollBottom = window.innerHeight + window.scrollY;
        const triggerPoint = document.documentElement.scrollHeight - 1200;
        if (scrollBottom >= triggerPoint) {
            loadMoreMovies();
        }
    }, { passive: true });
}

/**
 * Inicialización de Event Listeners
 */
function setupEventListeners() {
    setupGridEventDelegation();

    // Búsqueda con debounce y cancelación instantánea
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

    // Botón de limpiar búsqueda
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

    // Filtro por categoría
    if (DOM.categoryFilter) {
        DOM.categoryFilter.addEventListener('change', () => {
            AppState.currentCategory = DOM.categoryFilter.value;
            loadInitialMovies();
        });
    }

    // Filtro de ordenación
    if (DOM.sortFilter) {
        DOM.sortFilter.addEventListener('change', () => {
            AppState.currentSort = DOM.sortFilter.value;
            loadInitialMovies();
        });
    }

    // Botón de resetear filtros en empty state
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

    // Abrir modal de selección (desde el dock flotante)
    if (DOM.btnViewList) {
        DOM.btnViewList.addEventListener('click', () => {
            renderSelectedList();
            openModal(DOM.selectionModal);
        });
    }

    // Botón Copiar del Dock
    if (DOM.btnCopyList) {
        DOM.btnCopyList.addEventListener('click', (e) => {
            e.stopPropagation();
            copyMoviesList();
        });
    }

    // Botón WhatsApp del Dock
    if (DOM.btnShareWhatsapp) {
        DOM.btnShareWhatsapp.addEventListener('click', (e) => {
            e.stopPropagation();
            shareMoviesList();
        });
    }

    // Eliminación delegada en el modal de selección
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

    // Acciones dentro del Modal de Selección
    if (DOM.btnDeselectAllModal) {
        DOM.btnDeselectAllModal.addEventListener('click', deselectAllMovies);
    }
    if (DOM.btnCopyModal) {
        DOM.btnCopyModal.addEventListener('click', copyMoviesList);
    }
    if (DOM.btnShareModal) {
        DOM.btnShareModal.addEventListener('click', shareMoviesList);
    }

    // Botón de toggle en el modal de sinopsis
    if (DOM.btnToggleSelectModal) {
        DOM.btnToggleSelectModal.addEventListener('click', () => {
            if (AppState.currentDetailMovie) {
                toggleMovieSelection(AppState.currentDetailMovie, null);
                updateSynopsisModalButton(AppState.currentDetailMovie.id);
            }
        });
    }

    // Cierre de modales desde UI (botones 'X' y fondo oscuro)
    document.querySelectorAll('[data-close-modal], .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', closeAllModalsFromUI);
    });

    // Soporte para el Botón Atrás de Android (Gestos nativos de Android)
    window.addEventListener('popstate', () => {
        AppState.isModalInHistory = false;
        closeModal(DOM.selectionModal);
        closeModal(DOM.synopsisModal);
    });

    // Cierre de modales con tecla Escape en PC
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
 * Inicialización al cargar el DOM
 */
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    setupScrollObserver();
    await loadInitialMovies();
});
