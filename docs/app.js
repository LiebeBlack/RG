/**
 * CineBox - Visor Estático con API TMDB (Vanilla JS ES6+)
 * Arquitectura basada en repositorio (GitHub Pages).
 * Soporta dos modos: Vista de Usuario (index.html) y Administración (modders.html).
 * Integración con TMDB API para base de datos completa de películas.
 */



// TMDB API Configuration
const TMDB_API_KEY = "b00622de54cd7522d4640d5e5c527936";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

// Estado global de la aplicación
const AppState = {
    movies: [],
    selectedMovies: new Set(),
    isLoading: true,
    searchLanguage: 'es', // 'es' para español, 'en' para inglés
    tmdbMovies: [], // Caché de películas de TMDB
    defaultPlaceholder: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMjAwIDMwMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQgc2xpY2UiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxZTFhMWEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNmZmZmZmYiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlNpbiBQb3J0YWRhPC90ZXh0Pjwvc3ZnPg==",
    objectUrls: new Set(), // Track object URLs for cleanup
    currentPage: 1, // Página actual para infinite scroll
    totalPages: 1, // Total de páginas disponibles
    isLoadingMore: false, // Estado de carga incremental
    hasMorePages: true, // Si hay más páginas para cargar
    currentQuery: '', // Búsqueda actual
    currentCategory: 'all', // Categoría actual
    currentMode: 'tmdb' // 'tmdb' o 'local'
};

// Detectar si estamos en la página de administración (modders.html)
const isAdmin = document.getElementById('edit-modal') !== null;

// Debounce utility
function debounce(fn, delay = 250) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * TMDB API Functions
 */

// Buscar películas en TMDB (carga incremental)
async function searchTMDB(query, language = 'es', page = 1) {
    if (!TMDB_API_KEY || TMDB_API_KEY === "TU_API_KEY_AQUI") {
        console.warn("TMDB API key no configurada. Usando base de datos local.");
        return { movies: [], totalPages: 0 };
    }

    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=${language}&include_adult=false&page=${page}`
        );
        const data = await response.json();

        if (data.results) {
            const movies = data.results.map(movie => ({
                id: movie.id,
                tmdbId: movie.id,
                title: movie.title,
                originalTitle: movie.original_title,
                overview: movie.overview,
                releaseDate: movie.release_date,
                posterPath: movie.poster_path,
                backdropPath: movie.backdrop_path,
                voteAverage: movie.vote_average,
                genreIds: movie.genre_ids,
                category: getGenreFromIds(movie.genre_ids),
                coverUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : AppState.defaultPlaceholder,
                previewUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : AppState.defaultPlaceholder,
                fromTMDB: true
            }));
            return { movies, totalPages: data.total_pages || 1 };
        }
        return { movies: [], totalPages: 0 };
    } catch (error) {
        console.error('Error buscando en TMDB:', error);
        return { movies: [], totalPages: 0 };
    }
}

// Obtener películas populares de TMDB (carga incremental)
async function getPopularTMDB(language = 'es', page = 1) {
    if (!TMDB_API_KEY || TMDB_API_KEY === "TU_API_KEY_AQUI") {
        console.warn("TMDB API key no configurada. Usando base de datos local.");
        return { movies: [], totalPages: 0 };
    }

    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=${language}&page=${page}`
        );
        const data = await response.json();

        if (data.results) {
            const movies = data.results.map(movie => ({
                id: movie.id,
                tmdbId: movie.id,
                title: movie.title,
                originalTitle: movie.original_title,
                overview: movie.overview,
                releaseDate: movie.release_date,
                posterPath: movie.poster_path,
                backdropPath: movie.backdrop_path,
                voteAverage: movie.vote_average,
                genreIds: movie.genre_ids,
                category: getGenreFromIds(movie.genre_ids),
                coverUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : AppState.defaultPlaceholder,
                previewUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : AppState.defaultPlaceholder,
                fromTMDB: true
            }));
            return { movies, totalPages: data.total_pages || 1 };
        }
        return { movies: [], totalPages: 0 };
    } catch (error) {
        console.error('Error obteniendo populares de TMDB:', error);
        return { movies: [], totalPages: 0 };
    }
}

// Obtener películas por género (carga incremental)
async function getMoviesByGenre(genreId, language = 'es', page = 1) {
    if (!TMDB_API_KEY || TMDB_API_KEY === "TU_API_KEY_AQUI") {
        console.warn("TMDB API key no configurada. Usando base de datos local.");
        return { movies: [], totalPages: 0 };
    }

    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&language=${language}&page=${page}`
        );
        const data = await response.json();

        if (data.results) {
            const movies = data.results.map(movie => ({
                id: movie.id,
                tmdbId: movie.id,
                title: movie.title,
                originalTitle: movie.original_title,
                overview: movie.overview,
                releaseDate: movie.release_date,
                posterPath: movie.poster_path,
                backdropPath: movie.backdrop_path,
                voteAverage: movie.vote_average,
                genreIds: movie.genre_ids,
                category: getGenreFromIds(movie.genre_ids),
                coverUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : AppState.defaultPlaceholder,
                previewUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : AppState.defaultPlaceholder,
                fromTMDB: true
            }));
            return { movies, totalPages: data.total_pages || 1 };
        }
        return { movies: [], totalPages: 0 };
    } catch (error) {
        console.error('Error obteniendo películas por género:', error);
        return { movies: [], totalPages: 0 };
    }
}

// Mapeo de IDs de género a nombres
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
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'Bélico',
    37: 'Western'
};

function getGenreFromIds(genreIds) {
    if (!genreIds || genreIds.length === 0) return 'Otro';
    const genreId = genreIds[0];
    return GENRE_MAP[genreId] || 'Otro';
}

// Mapeo inverso de nombres a IDs
function getGenreIdFromName(genreName) {
    for (const [id, name] of Object.entries(GENRE_MAP)) {
        if (name.toLowerCase() === genreName.toLowerCase()) {
            return parseInt(id);
        }
    }
    return null;
}

// Sanitize text for XSS prevention
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Referencias al DOM (seguras: devuelven null si el elemento no existe)
const DOM = {
    grid: document.getElementById('movie-grid'),
    emptyState: document.getElementById('empty-state'),
    searchInput: document.getElementById('search-input'),
    categoryFilter: document.getElementById('category-filter'),
    sortFilter: document.getElementById('sort-filter'),
    languageFilter: document.getElementById('language-filter'),
    totalCount: document.getElementById('total-count-number'),
    
    fileUpload: document.getElementById('file-upload'),
    dropZoneOverlay: document.getElementById('drop-zone-overlay'),
    loadingOverlay: document.getElementById('loading-overlay'),
    
    addModal: document.getElementById('add-modal'),
    btnAddModal: document.getElementById('btn-add-modal'),
    closeAddModalBtn: document.querySelector('.close-add-modal'),
    addMovieForm: document.getElementById('add-movie-form'),
    
    cart: document.getElementById('floating-cart'),
    cartCount: document.getElementById('cart-count'),
    btnViewList: document.getElementById('btn-view-list'),
    btnCopyList: document.getElementById('btn-copy-list'),
    
    selectionModal: document.getElementById('selection-modal'),
    closeSelectionModalBtn: document.querySelector('.close-selection-modal'),
    selectedMoviesList: document.getElementById('selected-movies-list'),
    modalCartCount: document.getElementById('modal-cart-count'),
    btnDeselectAllModal: document.getElementById('btn-deselect-all-modal'),
    
    btnExportDb: document.getElementById('btn-export-db'),
    btnClearDb: document.getElementById('btn-clear-db'),
    
    editModal: document.getElementById('edit-modal'),
    closeEditModalBtn: document.querySelector('.close-edit-modal'),
    editMovieForm: document.getElementById('edit-movie-form'),
    btnDeleteMovie: document.getElementById('btn-delete-movie'),
    
    toastContainer: document.getElementById('toast-container')
};

/**
 * Inicialización
 */
document.addEventListener('DOMContentLoaded', async () => {
    showLoading(true);
    try {
        await loadDatabase();
        setupEventListeners();
        await renderMovies();
    } catch (error) {
        console.error('Error durante la inicialización:', error);
        showToast('Error al cargar el catálogo', 'error');
    }
    showLoading(false);
});

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
    cleanupObjectUrls();
});

/**
 * Loading overlay control
 */
function showLoading(show) {
    AppState.isLoading = show;
    if (DOM.loadingOverlay) {
        if (show) {
            DOM.loadingOverlay.classList.remove('hidden');
        } else {
            DOM.loadingOverlay.classList.add('hidden');
        }
    }
}

/**
 * Carga de Base de Datos Estática (catalogo.json)
 */
async function loadDatabase() {
    try {
        const response = await fetch('./catalogo.json', { cache: 'no-cache' });
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                AppState.movies = data;
                return;
            }
        }
        console.warn("catalogo.json está vacío o no se encontró. Intentando localStorage.");
    } catch (e) {
        console.warn("Fallo al hacer fetch de catalogo.json. Intentando fallback a localStorage.", e);
    }

    try {
        const stored = localStorage.getItem('cinebox_movies');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                AppState.movies = parsed;
            }
        }
    } catch (err) { 
        console.error('Error al leer localStorage:', err); 
    }
}

function saveToLocalStorage() {
    try { 
        localStorage.setItem('cinebox_movies', JSON.stringify(AppState.movies)); 
    } catch (error) { 
        console.warn("Memoria local llena o no disponible.");
        showToast('No se pudo guardar en almacenamiento local', 'error');
    }
}

function generateId() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function parseFilenameToTitle(filename) {
    let name = filename.replace(/\.(jpg|jpeg|png|webp|gif|bmp|avif)$/i, '');
    const techTags = /\b(1080p|720p|4k|2160p|x264|x265|hevc|hdr|web-dl|webrip|bluray|brrip|bdrip|rip|aac|ac3|dts|yify|remux|dual|latino|castellano|subbed|xvid|dvdrip|cam|ts|hdtv)\b/gi;
    name = name.replace(techTags, ' ');
    name = name.replace(/[-_.]/g, ' ');
    name = name.replace(/\s+/g, ' ').trim();
    name = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    return name || 'Película Desconocida';
}

async function handleFiles(files) {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
        showToast('No se encontraron archivos de imagen válidos', 'error');
        return;
    }

    let processedCount = 0;
    for (const file of imageFiles) {
        const title = parseFilenameToTitle(file.name);
        const staticPath = `./caratulas/${file.name}`;
        const objectUrl = URL.createObjectURL(file);

        // Track object URL for cleanup
        AppState.objectUrls.add(objectUrl);

        const newMovie = {
            id: generateId(),
            title: title,
            coverUrl: staticPath,
            previewUrl: objectUrl,
            category: 'Otro',
            timestamp: Date.now()
        };

        if (!AppState.movies.find(m => m.coverUrl === staticPath)) {
            AppState.movies.push(newMovie);
            processedCount++;
        }
    }

    saveToLocalStorage();
    await renderMovies();

    if (processedCount > 0) {
        showToast(`${processedCount} elementos registrados. Exporta la BD para guardar.`, 'success');
    } else {
        showToast('Los elementos ya existían en el catálogo.', 'info');
    }
}

// Cleanup function for object URLs
function cleanupObjectUrls() {
    AppState.objectUrls.forEach(url => {
        URL.revokeObjectURL(url);
    });
    AppState.objectUrls.clear();
}

/**
 * Motor de Renderizado (Grid Principal)
 * Usa View Transitions API si está disponible para transiciones suaves.
 * Integra TMDB API cuando está configurada.
 * Sistema de infinite scroll para cargar todas las películas.
 */
async function renderMovies(loadMore = false) {
    const query = DOM.searchInput ? DOM.searchInput.value.trim() : '';
    const category = DOM.categoryFilter ? DOM.categoryFilter.value : 'all';
    const sort = DOM.sortFilter ? DOM.sortFilter.value : 'recent';

    // Detectar si cambiaron los filtros (resetear estado)
    if (!loadMore && (query !== AppState.currentQuery || category !== AppState.currentCategory)) {
        AppState.currentQuery = query;
        AppState.currentCategory = category;
        AppState.currentPage = 1;
        AppState.tmdbMovies = [];
        AppState.hasMorePages = true;
    }

    // Determinar el modo de carga
    let useTMDB = false;
    let apiFunction = null;
    let apiParams = {};

    if (query && TMDB_API_KEY && TMDB_API_KEY !== "TU_API_KEY_AQUI") {
        useTMDB = true;
        apiFunction = searchTMDB;
        apiParams = { query, language: AppState.searchLanguage, page: AppState.currentPage };
    } else if (category !== 'all' && TMDB_API_KEY && TMDB_API_KEY !== "TU_API_KEY_AQUI") {
        const genreId = getGenreIdFromName(category);
        if (genreId) {
            useTMDB = true;
            apiFunction = getMoviesByGenre;
            apiParams = { genreId, language: AppState.searchLanguage, page: AppState.currentPage };
        }
    } else if (!query && TMDB_API_KEY && TMDB_API_KEY !== "TU_API_KEY_AQUI") {
        useTMDB = true;
        apiFunction = getPopularTMDB;
        apiParams = { language: AppState.searchLanguage, page: AppState.currentPage };
    }

    AppState.currentMode = useTMDB ? 'tmdb' : 'local';

    if (useTMDB && apiFunction) {
        // Cargar siempre, incluso si no hay más páginas en estado inicial
        if ((AppState.hasMorePages || !loadMore) && !AppState.isLoadingMore) {
            AppState.isLoadingMore = true;
            
            const result = await apiFunction(...Object.values(apiParams));
            
            if (loadMore) {
                AppState.tmdbMovies.push(...result.movies);
            } else {
                AppState.tmdbMovies = result.movies;
            }
            
            AppState.totalPages = result.totalPages;
            AppState.currentPage++;
            AppState.hasMorePages = AppState.currentPage <= AppState.totalPages;
            AppState.isLoadingMore = false;
        }
    } else {
        // Base de datos local
        if (!loadMore) {
            AppState.tmdbMovies = AppState.movies;
        }
    }

    let moviesToRender = AppState.tmdbMovies;

    let filtered = moviesToRender.filter(m => {
        const matchesSearch = query === '' ||
                              m.title.toLowerCase().includes(query.toLowerCase()) ||
                              (m.originalTitle && m.originalTitle.toLowerCase().includes(query.toLowerCase()));
        const matchesCategory = category === 'all' || m.category === category;
        return matchesSearch && matchesCategory;
    });

    if (sort === 'az') filtered.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    else if (sort === 'za') filtered.sort((a, b) => b.title.localeCompare(a.title, 'es'));
    else filtered.sort((a, b) => {
        // Usar releaseDate para TMDB, timestamp para local
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : (a.timestamp || 0);
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : (b.timestamp || 0);
        return dateB - dateA;
    });

    if (!DOM.grid) return;
    
    // Solo limpiar si no es carga incremental
    if (!loadMore) {
        DOM.grid.innerHTML = '';
    }

    // Update total counter
    if (DOM.totalCount) {
        DOM.totalCount.textContent = AppState.tmdbMovies.length;
    }

    if (filtered.length === 0 && !loadMore) {
        if (DOM.emptyState) {
            DOM.emptyState.classList.remove('hidden');
            DOM.emptyState.setAttribute('aria-hidden', 'false');
        }
    } else {
        if (DOM.emptyState) {
            DOM.emptyState.classList.add('hidden');
            DOM.emptyState.setAttribute('aria-hidden', 'true');
        }
        
        // Solo renderizar las nuevas películas si es carga incremental
        const moviesToRenderCards = loadMore ? 
            filtered.slice(AppState.tmdbMovies.length - filtered.length) : filtered;
        
        const fragment = document.createDocumentFragment();

        moviesToRenderCards.forEach((movie, index) => {
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.dataset.id = movie.id;
            card.setAttribute('role', 'listitem');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `${escapeHtml(movie.title)} - ${escapeHtml(movie.category || 'Sin categoría')}`);
            // Stagger animation delay per card (max 1.5s) - compensar offset en carga incremental
            const actualIndex = loadMore ? AppState.tmdbMovies.length - moviesToRenderCards.length + index : index;
            card.style.animationDelay = `${Math.min(actualIndex * 0.04, 1.5)}s`;

            const imgSrc = movie.previewUrl || movie.coverUrl || AppState.defaultPlaceholder;
            const safeTitle = escapeHtml(movie.title);
            const safeOriginalTitle = movie.originalTitle && movie.originalTitle !== movie.title ? escapeHtml(movie.originalTitle) : '';
            const safeCategory = escapeHtml(movie.category || 'Otro');

            let editBadgeHTML = '';
            if (isAdmin) {
                editBadgeHTML = `<div class="edit-badge" title="Editar detalles" role="button" tabindex="0" aria-label="Editar ${safeTitle}"><i class="fa-solid fa-pen" aria-hidden="true"></i></div>`;
            }

            // Mostrar título original si es diferente al título en el idioma actual
            const titleHTML = safeOriginalTitle ?
                `<h3 class="card-title">${safeTitle}</h3><p class="card-original-title">${safeOriginalTitle}</p>` :
                `<h3 class="card-title">${safeTitle}</h3>`;

            card.innerHTML = `
                <div class="select-badge" aria-hidden="true"><i class="fa-solid fa-check"></i></div>
                ${editBadgeHTML}
                <div class="card-img-container">
                    <img class="card-img" src="${imgSrc}" alt="Portada de ${safeTitle}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${AppState.defaultPlaceholder}'">
                </div>
                <div class="card-overlay">
                    ${titleHTML}
                    <p class="card-category">${safeCategory}</p>
                </div>
            `;

            // Evento para editar (solo en modo modder)
            if (isAdmin) {
                const editBadge = card.querySelector('.edit-badge');
                if (editBadge) {
                    editBadge.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openEditModal(movie);
                    });
                    editBadge.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openEditModal(movie);
                        }
                    });
                }
            }

            // Click para seleccionar/deseleccionar
            card.addEventListener('click', () => {
                toggleSelection(movie.id);
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSelection(movie.id);
                }
            });

            fragment.appendChild(card);
        });

        DOM.grid.appendChild(fragment);
    }
}

/**
 * Motor de Renderizado (Modal de Selección)
 */
function renderSelectedList() {
    if (!DOM.selectedMoviesList) return;
    DOM.selectedMoviesList.innerHTML = '';
    
    if (AppState.selectedMovies.size === 0) {
        DOM.selectedMoviesList.innerHTML = '<li style="justify-content: center; color: var(--text-muted);" role="listitem">No hay películas seleccionadas</li>';
        return;
    }
    
    const selectedList = AppState.movies.filter(m => AppState.selectedMovies.has(m.id));
    
    selectedList.forEach((movie, index) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'listitem');
        li.style.animationDelay = `${index * 0.05}s`;
        const safeTitle = escapeHtml(movie.title);
        li.innerHTML = `
            <span class="selected-title" title="${safeTitle}">${safeTitle}</span>
            <button class="remove-item" title="Quitar ${safeTitle}" aria-label="Quitar ${safeTitle} de la lista"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        `;
        
        li.querySelector('.remove-item').addEventListener('click', async () => {
            AppState.selectedMovies.delete(movie.id);
            const card = document.querySelector(`.movie-card[data-id="${movie.id}"]`);
            if (card) {
                card.classList.remove('selected');
            }
            await renderMovies();
        });
        
        DOM.selectedMoviesList.appendChild(li);
    });
}

/**
 * Lógica de Selección y Carrito Flotante con Animaciones (Spring/Pulse)
 */
function toggleSelection(id, cardElement) {
    if (AppState.selectedMovies.has(id)) {
        AppState.selectedMovies.delete(id);
        cardElement.classList.remove('selected');
        cardElement.setAttribute('aria-label', cardElement.getAttribute('aria-label').replace(' (seleccionada)', ''));
    } else {
        AppState.selectedMovies.add(id);
        cardElement.classList.add('selected');
        cardElement.setAttribute('aria-label', cardElement.getAttribute('aria-label') + ' (seleccionada)');
        
        // Animación Pulse en el badge del carrito
        const badge = document.querySelector('.cart-badge');
        if (badge) {
            badge.classList.remove('pulse');
            void badge.offsetWidth; // trigger reflow for animation restart
            badge.classList.add('pulse');
        }
    }
    updateCartUI();
}

function updateCartUI() {
    const count = AppState.selectedMovies.size;
    if (DOM.cartCount) DOM.cartCount.textContent = count;
    if (DOM.modalCartCount) DOM.modalCartCount.textContent = count;
    
    if (DOM.cart) {
        if (count > 0) {
            DOM.cart.classList.remove('hide-dock');
        } else {
            DOM.cart.classList.add('hide-dock');
        }
    }
    
    // Si el modal de selección está abierto, mantenlo actualizado en tiempo real
    if (DOM.selectionModal && !DOM.selectionModal.classList.contains('hidden')) {
        renderSelectedList();
    }
}

function getSelectedMoviesText() {
    const selectedList = AppState.movies.filter(m => AppState.selectedMovies.has(m.id));
    let text = '';
    selectedList.forEach((movie, index) => text += `${index + 1}. ${movie.title}\n`);
    return text;
}

/**
 * Toast Notifications
 */
function showToast(message, type = 'info') {
    if (!DOM.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    const icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        info: 'fa-circle-info'
    };
    const icon = icons[type] || icons.info;
    toast.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> <span>${escapeHtml(message)}</span>`;
    DOM.toastContainer.appendChild(toast);
    
    const autoRemoveTimeout = setTimeout(() => {
        toast.style.animation = 'fadeOut 0.4s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 450);
    }, 4000);
    
    // Allow click to dismiss early
    toast.addEventListener('click', () => {
        clearTimeout(autoRemoveTimeout);
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 350);
    });
    toast.style.cursor = 'pointer';
}

/**
 * Modal Management - Open/Close with body scroll lock
 */
function openModal(modalElement) {
    if (!modalElement) return;
    modalElement.classList.remove('hidden');
    document.body.classList.add('modal-open');
    // Focus the first focusable element inside the modal
    const firstFocusable = modalElement.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 100);
    }
}

function closeModal(modalElement) {
    if (!modalElement) return;
    modalElement.classList.add('hidden');
    // Only remove modal-open if no other modals are open
    const openModals = document.querySelectorAll('.modal:not(.hidden)');
    if (openModals.length === 0) {
        document.body.classList.remove('modal-open');
    }
}

/**
 * Lógica de Edición (Solo Admin)
 */
function openEditModal(movie) {
    const idField = document.getElementById('edit-movie-id');
    const titleField = document.getElementById('edit-movie-title');
    const urlField = document.getElementById('edit-movie-url');
    const catField = document.getElementById('edit-movie-category');
    if (!idField || !titleField || !urlField || !catField || !DOM.editModal) return;
    
    idField.value = movie.id;
    titleField.value = movie.title;
    urlField.value = movie.coverUrl;
    catField.value = movie.category;
    openModal(DOM.editModal);
}

/**
 * Listeners de Eventos
 */
function setupEventListeners() {
    // ═══════════════════════════════════════════
    // GLOBAL: Keyboard shortcuts
    // ═══════════════════════════════════════════
    document.addEventListener('keydown', (e) => {
        // Escape to close any open modal
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal:not(.hidden)');
            openModals.forEach(modal => closeModal(modal));
        }
        
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (DOM.searchInput) DOM.searchInput.focus();
        }
    });

    // Interfaz de dropdowns (funciona en ambas vistas)
    document.addEventListener('click', (e) => {
        const isDropdownBtn = e.target.closest('.dropdown > button');
        const isDropdownContent = e.target.closest('.dropdown-content');
        if (isDropdownBtn) {
            const dropdown = e.target.closest('.dropdown');
            const btn = dropdown.querySelector('button[aria-expanded]');
            const isActive = dropdown.classList.toggle('active');
            if (btn) btn.setAttribute('aria-expanded', isActive);
        } else if (!isDropdownContent) {
            document.querySelectorAll('.dropdown').forEach(d => {
                d.classList.remove('active');
                const btn = d.querySelector('button[aria-expanded]');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            });
        }
    });

    // Búsqueda con debounce y filtros (funciona en ambas vistas)
    const debouncedRender = debounce(async () => await renderMovies(), 200);
    if (DOM.searchInput) DOM.searchInput.addEventListener('input', debouncedRender);
    if (DOM.categoryFilter) DOM.categoryFilter.addEventListener('change', async () => await renderMovies());
    if (DOM.sortFilter) DOM.sortFilter.addEventListener('change', async () => await renderMovies());
    if (DOM.languageFilter) {
        DOM.languageFilter.addEventListener('change', async (e) => {
            AppState.searchLanguage = e.target.value;
            await renderMovies();
        });
    }

    // ═══════════════════════════════════════════
    // SOLO ADMIN: Archivos y Drag & Drop
    // ═══════════════════════════════════════════
    if (DOM.fileUpload) {
        DOM.fileUpload.addEventListener('change', async (e) => { 
            await handleFiles(e.target.files); 
            e.target.value = ''; 
        });
    }
    if (DOM.dropZoneOverlay) {
        let dragCounter = 0;
        
        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes('Files')) {
                dragCounter++;
                DOM.dropZoneOverlay.classList.remove('hidden');
            }
        });
        window.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                DOM.dropZoneOverlay.classList.add('hidden');
            }
        });
        DOM.dropZoneOverlay.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            DOM.dropZoneOverlay.classList.add('hidden');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
            }
        });
    }

    // SOLO ADMIN: Modal de Añadir Manualmente
    if (DOM.btnAddModal && DOM.addModal) {
        DOM.btnAddModal.addEventListener('click', () => openModal(DOM.addModal));
    }
    if (DOM.closeAddModalBtn && DOM.addModal) {
        DOM.closeAddModalBtn.addEventListener('click', () => closeModal(DOM.addModal));
    }
    if (DOM.addModal) {
        DOM.addModal.addEventListener('click', (e) => { 
            if (e.target === DOM.addModal) closeModal(DOM.addModal); 
        });
    }
    if (DOM.addMovieForm) {
        DOM.addMovieForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const titleInput = document.getElementById('movie-title');
            const urlInput = document.getElementById('movie-url');
            const categorySelect = document.getElementById('movie-category');
            
            const title = titleInput ? titleInput.value.trim() : '';
            const url = urlInput ? urlInput.value.trim() : '';
            const category = categorySelect ? categorySelect.value : 'Otro';
            
            if (!title) {
                showToast('El título es obligatorio', 'error');
                if (titleInput) titleInput.focus();
                return;
            }
            if (!url) {
                showToast('La URL de portada es obligatoria', 'error');
                if (urlInput) urlInput.focus();
                return;
            }
            
            AppState.movies.push({ 
                id: generateId(), 
                title, 
                coverUrl: url, 
                category, 
                timestamp: Date.now() 
            });
            saveToLocalStorage(); 
            await renderMovies(); 
            closeModal(DOM.addModal); 
            DOM.addMovieForm.reset();
            showToast('Película añadida con éxito', 'success');
        });
    }

    // SOLO ADMIN: Modal de Edición
    if (DOM.editModal && DOM.closeEditModalBtn) {
        DOM.closeEditModalBtn.addEventListener('click', () => closeModal(DOM.editModal));
        DOM.editModal.addEventListener('click', (e) => { 
            if (e.target === DOM.editModal) closeModal(DOM.editModal); 
        });
    }
    if (DOM.editMovieForm) {
        DOM.editMovieForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-movie-id')?.value;
            const title = document.getElementById('edit-movie-title')?.value.trim();
            const url = document.getElementById('edit-movie-url')?.value.trim();
            const category = document.getElementById('edit-movie-category')?.value;
            
            if (!title) {
                showToast('El título es obligatorio', 'error');
                return;
            }
            if (!url) {
                showToast('La URL de portada es obligatoria', 'error');
                return;
            }
            
            const movieIndex = AppState.movies.findIndex(m => m.id === id);
            if (movieIndex !== -1) {
                AppState.movies[movieIndex] = {
                    ...AppState.movies[movieIndex],
                    title,
                    coverUrl: url,
                    category
                };
                
                saveToLocalStorage(); 
                await renderMovies(); 
                closeModal(DOM.editModal);
                showToast('Película actualizada con éxito', 'success');
            } else {
                showToast('Película no encontrada en el catálogo', 'error');
            }
        });
    }
    if (DOM.btnDeleteMovie) {
        DOM.btnDeleteMovie.addEventListener('click', async () => {
            const id = document.getElementById('edit-movie-id')?.value;
            if (!id) return;
            
            if (confirm('¿Estás seguro de que deseas eliminar esta película del catálogo?')) {
                AppState.movies = AppState.movies.filter(m => m.id !== id);
                AppState.selectedMovies.delete(id);
                saveToLocalStorage();
                await renderMovies();
                closeModal(DOM.editModal);
                showToast('Película eliminada del catálogo', 'success');
            }
        });
    }

    // ═══════════════════════════════════════════
    // AMBAS VISTAS: Carrito de selección
    // ═══════════════════════════════════════════
    if (DOM.btnViewList) {
        const openSelectionModal = () => {
            renderSelectedList();
            openModal(DOM.selectionModal);
        };
        DOM.btnViewList.addEventListener('click', openSelectionModal);
        DOM.btnViewList.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openSelectionModal();
            }
        });
    }
    if (DOM.closeSelectionModalBtn) {
        DOM.closeSelectionModalBtn.addEventListener('click', () => closeModal(DOM.selectionModal));
    }
    if (DOM.selectionModal) {
        DOM.selectionModal.addEventListener('click', (e) => { 
            if (e.target === DOM.selectionModal) closeModal(DOM.selectionModal); 
        });
    }
    
    if (DOM.btnDeselectAllModal) {
        DOM.btnDeselectAllModal.addEventListener('click', async () => { 
            AppState.selectedMovies.clear();
            document.querySelectorAll('.movie-card.selected').forEach(card => {
                card.classList.remove('selected');
            });
            await renderMovies(); 
            closeModal(DOM.selectionModal);
            showToast('Películas deseleccionadas', 'info');
        });
    }
    
    // Copiar y WhatsApp
    if (DOM.btnCopyList) {
        DOM.btnCopyList.addEventListener('click', async () => {
            if (AppState.selectedMovies.size === 0) {
                showToast('No hay películas seleccionadas', 'info');
                return;
            }
            try { 
                await navigator.clipboard.writeText(getSelectedMoviesText()); 
                showToast('¡Lista copiada al portapapeles!', 'success'); 
            } catch (err) { 
                // Fallback for browsers that don't support clipboard API
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = getSelectedMoviesText();
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-9999px';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    showToast('¡Lista copiada al portapapeles!', 'success');
                } catch (fallbackErr) {
                    showToast('Error al copiar al portapapeles', 'error');
                }
            }
        });
    }

    // SOLO ADMIN: Exportar / Vaciar BD
    if (DOM.btnExportDb) {
        DOM.btnExportDb.addEventListener('click', () => {
            if (AppState.movies.length === 0) {
                showToast('El catálogo está vacío.', 'info');
                return;
            }
            // Limpiar previewUrl antes de exportar (son URLs temporales)
            const exportData = AppState.movies.map(({ previewUrl, ...clean }) => clean);
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const blobUrl = URL.createObjectURL(blob);
            const linkElement = document.createElement('a');
            linkElement.href = blobUrl;
            linkElement.download = 'catalogo.json';
            document.body.appendChild(linkElement);
            linkElement.click();
            document.body.removeChild(linkElement);
            URL.revokeObjectURL(blobUrl);
            showToast('catalogo.json exportado. Recuerda subirlo a tu repositorio.', 'success');
        });
    }
    
    if (DOM.btnClearDb) {
        DOM.btnClearDb.addEventListener('click', async () => {
            if (confirm('⚠️ ¿Vaciar los cambios locales no exportados? (Se recargará desde catalogo.json)')) {
                localStorage.removeItem('cinebox_movies');
                cleanupObjectUrls(); // Cleanup memory
                AppState.movies = [];
                AppState.selectedMovies.clear();
                await loadDatabase();
                await renderMovies();
                showToast('Memoria local borrada y catálogo recargado.', 'success');
            }
        });
    }
    
    // Infinite Scroll para cargar más películas
    window.addEventListener('scroll', debounce(async () => {
        if (AppState.currentMode !== 'tmdb' || AppState.isLoadingMore || !AppState.hasMorePages) return;
        
        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.body.offsetHeight - 500; // Cargar 500px antes del final
        
        if (scrollPosition >= threshold) {
            await renderMovies(true); // true = loadMore mode
        }
    }, 200));
}
