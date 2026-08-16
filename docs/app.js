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

// Generador de Placeholder SVG ligero con caché para evitar regeneración
const _placeholderCache = new Map();
function createPosterPlaceholder(title = '') {
    const key = title.slice(0, 30);
    if (_placeholderCache.has(key)) return _placeholderCache.get(key);
    const safeTitle = escapeHtml(key);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513" viewBox="0 0 342 513"><rect width="100%" height="100%" fill="#101018"/><circle cx="171" cy="210" r="45" fill="#181826"/><path d="M150 210 L195 210 M171 185 L171 235" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round"/><text x="50%" y="280" font-family="sans-serif" font-size="16" font-weight="700" fill="#94a3b8" dominant-baseline="middle" text-anchor="middle">Sin carátula</text><text x="50%" y="310" font-family="sans-serif" font-size="13" fill="#64748b" dominant-baseline="middle" text-anchor="middle">${safeTitle}</text></svg>`;
    const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    // Limitar caché a 100 entradas para no crecer sin límite
    if (_placeholderCache.size > 100) _placeholderCache.clear();
    _placeholderCache.set(key, uri);
    return uri;
}

// Estado Global de la Aplicación
const AppState = {
    selectedMoviesMap: new Map(), // Map<id, MovieObject> persistente
    tmdbMovies: [],               // Películas en memoria actual (capped a 500 para no crecer sin límite)
    movieLookup: new Map(),       // Lookup rápido Map<id, MovieObject> para delegación de eventos O(1)
    MAX_MOVIES_IN_MEMORY: 500,    // Techo de películas en memoria para evitar fuga por scroll infinito
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
function debounce(fn, delay = 250) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Utility: Sanitizar texto HTML (sin crear elementos DOM — cero allocations)
const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const _escapeRe = /[&<>"']/g;
function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(_escapeRe, ch => _escapeMap[ch]);
}

// Obtener nombre del género
function getGenreName(genreIds) {
    if (!genreIds || genreIds.length === 0) return 'Cine';
    return GENRE_MAP[genreIds[0]] || 'Cine';
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

/**
 * Peticiones a TMDB API con Cancelación Activa
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

    const fetchOptions = signal ? { signal } : {};
    const response = await fetch(url.toString(), fetchOptions);
    if (!response.ok) {
        throw new Error(`TMDB HTTP ${response.status}`);
    }
    return await response.json();
}

// Normalizar objeto película de TMDB
function normalizeTMDBMovie(item) {
    const placeholder = createPosterPlaceholder(item.title);
    return {
        id: item.id,
        title: item.title || item.original_title || 'Sin título',
        originalTitle: item.original_title || '',
        overview: item.overview ? item.overview.trim() : 'No hay sinopsis disponible para este título.',
        releaseDate: item.release_date || '',
        year: getYearFromDate(item.release_date),
        posterPath: item.poster_path,
        coverUrl: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : placeholder,
        voteAverage: typeof item.vote_average === 'number' ? item.vote_average.toFixed(1) : '0.0',
        genreIds: item.genre_ids || [],
        category: getGenreName(item.genre_ids),
        popularity: item.popularity || 0
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

// Cargar películas desde la API con estricto filtro de estreno digital / ya estrenadas
async function fetchMovies(page = 1, signal = null) {
    const query = AppState.currentQuery.trim();
    const category = AppState.currentCategory;
    const sort = AppState.currentSort;
    const today = getTodayDateString();

    let data;
    if (query) {
        data = await fetchFromTMDB('/search/movie', { query, page }, signal);
    } else {
        // Descubrimiento estricto de títulos ya estrenados
        const discoverParams = {
            'primary_release_date.lte': today,
            'vote_count.gte': sort === 'rating' ? 60 : 8,
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
        if (!item || !item.id || (!item.title && !item.original_title)) continue;

        // Filtro estricto: Solo películas que YA estén estrenadas (release_date <= hoy)
        const releaseDate = item.release_date || '';
        if (!releaseDate || releaseDate > today) continue;

        if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            movies.push(normalizeTMDBMovie(item));
        }
    }

    if (sort === 'az') {
        movies.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    } else if (sort === 'za') {
        movies.sort((a, b) => b.title.localeCompare(a.title, 'es'));
    } else if (sort === 'rating') {
        movies.sort((a, b) => parseFloat(b.voteAverage) - parseFloat(a.voteAverage));
    } else if (sort === 'recent') {
        movies.sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
    }

    return {
        movies,
        totalPages: Math.min(data.total_pages || 1, 500)
    };
}

/**
 * Motor de Renderizado Ultrarrápido con Optimización LCP
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

    if (DOM.grid) DOM.grid.innerHTML = '';
    if (DOM.emptyState) DOM.emptyState.classList.add('hidden');

    try {
        const result = await fetchMovies(1, currentSignal);
        AppState.tmdbMovies = result.movies;
        result.movies.forEach(m => AppState.movieLookup.set(m.id, m));
        AppState.totalPages = result.totalPages;
        AppState.hasMorePages = AppState.currentPage < AppState.totalPages;

        if (AppState.tmdbMovies.length === 0) {
            showEmptyState(true);
        } else {
            showEmptyState(false);
            renderCards(AppState.tmdbMovies, false);
            AppState.currentPage = 2;
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
    }
}

// Cargar más películas (Scroll Infinito con Deduplicación Absoluta y techo de memoria)
async function loadMoreMovies() {
    if (AppState.isLoadingMore || !AppState.hasMorePages || AppState.isLoading) return;

    // Parar si ya tenemos demasiadas películas en memoria
    if (AppState.tmdbMovies.length >= AppState.MAX_MOVIES_IN_MEMORY) {
        AppState.hasMorePages = false;
        return;
    }

    AppState.isLoadingMore = true;
    showInfiniteLoading(true);

    try {
        const result = await fetchMovies(AppState.currentPage, AppState.activeAbortController?.signal);
        const existingIds = new Set(AppState.tmdbMovies.map(m => m.id));
        const newMovies = result.movies.filter(m => !existingIds.has(m.id));

        if (newMovies.length > 0) {
            AppState.tmdbMovies.push(...newMovies);
            newMovies.forEach(m => AppState.movieLookup.set(m.id, m));
            renderCards(newMovies, true);
            AppState.currentPage++;
            AppState.hasMorePages = AppState.currentPage <= AppState.totalPages
                && AppState.tmdbMovies.length < AppState.MAX_MOVIES_IN_MEMORY;
        } else if (AppState.currentPage < result.totalPages) {
            AppState.currentPage++;
        } else {
            AppState.hasMorePages = false;
        }

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

/**
 * Renderizado de Tarjetas con Optimización LCP (fetchpriority="high" en los primeros elementos)
 * Títulos grandes con soporte para hasta 4 líneas
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
                     loading="${loadingAttr}"
                     ${fetchPriorityAttr}
                     decoding="async"
                     onload="this.classList.add('loaded')"
                     onerror="this.src='${createPosterPlaceholder(movie.title)}';this.classList.add('loaded');">
            </div>
            <div class="select-badge" aria-hidden="true">
                <i class="fa-solid fa-check"></i>
            </div>
            <div class="card-overlay">
                <h3 class="card-title" title="${safeTitle}">${safeTitle}</h3>
                <div class="card-meta">
                    <div class="card-meta-left">
                        <span class="meta-pill genre-pill">${safeCategory}</span>
                        ${safeYear ? `<span class="meta-pill">${safeYear}</span>` : ''}
                    </div>
                    <span class="meta-pill rating-pill"><i class="fa-solid fa-star" aria-hidden="true"></i> ${safeRating}</span>
                </div>
            </div>
        `;

        fragment.appendChild(card);
    });

    if (!isAppend) {
        DOM.grid.innerHTML = '';
    }
    DOM.grid.appendChild(fragment);
}

/**
 * Gestor de Gestos Android & Móviles:
 * - Tap rápido: Seleccionar / Deseleccionar película
 * - Long Press (tocar un rato): Feedback háptico y apertura de sinopsis
 */
function setupGridEventDelegation() {
    if (!DOM.grid) return;

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
                try { navigator.vibrate([35, 20, 35]); } catch (err) {}
            }

            openSynopsisModal(movie);
        }, 480);
    }, { passive: true });

    // Touch Move: Cancelar Long Press si el usuario se desplaza
    DOM.grid.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);
            if (dx > 8 || dy > 8) {
                cancelLongPress();
            }
        }
    }, { passive: true });

    DOM.grid.addEventListener('touchend', cancelLongPress);
    DOM.grid.addEventListener('touchcancel', cancelLongPress);

    // Clic / Tap
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

    // Teclado
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

    const matchingCards = document.querySelectorAll(`.movie-card[data-id="${movie.id}"]`);
    matchingCards.forEach(c => {
        if (AppState.selectedMoviesMap.has(movie.id)) {
            c.classList.add('selected');
        } else {
            c.classList.remove('selected');
        }
    });

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

// Renderizar la lista de películas seleccionadas en el modal
function renderSelectedList() {
    if (!DOM.selectedMoviesList) return;
    DOM.selectedMoviesList.innerHTML = '';

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
            <img class="selected-thumb" src="${movie.coverUrl}" alt="Portada de ${safeTitle}" loading="lazy">
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

    DOM.selectedMoviesList.appendChild(fragment);
}

// Vaciar selección completa
function deselectAllMovies() {
    if (AppState.selectedMoviesMap.size === 0) return;
    AppState.selectedMoviesMap.clear();

    document.querySelectorAll('.movie-card.selected').forEach(c => c.classList.remove('selected'));
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

    let text = '🎬 *Mis Películas Seleccionadas — Ky! Movies*\n\n';
    selectedArray.forEach((movie, idx) => {
        const yearStr = movie.year ? ` (${movie.year})` : '';
        const catStr = movie.category ? ` - _${movie.category}_` : '';
        text += `${idx + 1}. *${movie.title}*${yearStr}${catStr}\n`;
    });

    text += `\n🍿 *Total:* ${selectedArray.length} película${selectedArray.length > 1 ? 's' : ''}`;
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
    const safeYear = escapeHtml(movie.year || 'Desconocido');
    const safeRating = escapeHtml(movie.voteAverage);
    const safeCategory = escapeHtml(movie.category);
    const safeOverview = escapeHtml(movie.overview);

    if (DOM.synopsisModalTitle) {
        DOM.synopsisModalTitle.textContent = safeTitle;
    }

    // Limpiar contenido anterior explícitamente para liberar nodos DOM huérfanos
    DOM.synopsisContent.textContent = '';

    DOM.synopsisContent.innerHTML = `
        <div class="synopsis-card-preview">
            <img class="synopsis-thumb" src="${movie.coverUrl}" alt="Portada de ${safeTitle}">
            <div class="synopsis-header-info">
                <h3 class="synopsis-movie-title">${safeTitle}</h3>
                <div class="synopsis-badges">
                    <span class="synopsis-badge rating"><i class="fa-solid fa-star"></i> ${safeRating} / 10</span>
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
 * Notificaciones Flotantes (Toasts) — con limpieza robusta
 */
function showToast(message, type = 'info') {
    if (!DOM.toastContainer) return;

    // Limitar toasts activos a 3 para no saturar el DOM
    while (DOM.toastContainer.children.length >= 3) {
        DOM.toastContainer.firstChild.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info');
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;

    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.95)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => {
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
        rootMargin: '600px',
        threshold: 0.05
    });

    sentinelObserver.observe(DOM.scrollSentinel);
}

/**
 * Inicialización de Event Listeners
 */
function setupEventListeners() {
    setupGridEventDelegation();

    // Búsqueda con debounce y cancelación
    const handleSearch = debounce(() => {
        const query = DOM.searchInput ? DOM.searchInput.value.trim() : '';
        AppState.currentQuery = query;
        if (DOM.btnClearSearch) {
            DOM.btnClearSearch.classList.toggle('hidden', query.length === 0);
        }
        loadInitialMovies();
    }, 250);

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
