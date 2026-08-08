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
    selectedMovies: new Set(),
    isLoading: true,
    searchLanguage: 'es', // 'es' para español, 'en' para inglés
    tmdbMovies: [], // Caché de películas de TMDB
    defaultPlaceholder: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMjAwIDMwMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQgc2xpY2UiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxZTFhMWEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNmZmZmZmYiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlNpbiBQb3J0YWRhPC90ZXh0Pjwvc3ZnPg==",
    currentPage: 1, // Página actual para infinite scroll
    totalPages: 1, // Total de páginas disponibles
    isLoadingMore: false, // Estado de carga incremental
    hasMorePages: true, // Si hay más páginas para cargar
    currentQuery: '', // Búsqueda actual
    currentCategory: 'all' // Categoría actual
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

// Cargar películas iniciales de TMDB con precarga optimizada
async function loadTMDBMovies() {
    try {
        const isMobile = window.innerWidth <= 650;
        const pagesToPreload = isMobile ? 1 : 1; // Solo 1 página para ahorrar recursos
        
        // Cargar primera página
        const result = await getPopularTMDB(AppState.searchLanguage, 1);
        if (result.movies && result.movies.length > 0) {
            // En móvil, limitar a 30 películas para rendimiento
            const moviesToKeep = isMobile ? 30 : 40;
            AppState.tmdbMovies = result.movies.slice(0, moviesToKeep);
            AppState.totalPages = result.totalPages;
            AppState.currentPage = 2;
            AppState.hasMorePages = AppState.currentPage <= AppState.totalPages;
            
            // No precargar páginas adicionales para ahorrar recursos
        }
    } catch (error) {
        console.error('Error cargando películas de TMDB:', error);
        throw error;
    }
}

// Buscar películas en TMDB (carga incremental)
async function searchTMDB(query, language = 'es', page = 1) {
    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=${language}&include_adult=false&page=${page}`
        );
        const data = await response.json();

        if (data.results) {
            const movies = data.results
                .filter(movie => isMovieReleased(movie.release_date))
                .map(movie => ({
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
    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=${language}&page=${page}`
        );
        const data = await response.json();

        if (data.results) {
            const movies = data.results
                .filter(movie => isMovieReleased(movie.release_date))
                .map(movie => ({
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
    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&language=${language}&page=${page}`
        );
        const data = await response.json();

        if (data.results) {
            const movies = data.results
                .filter(movie => isMovieReleased(movie.release_date))
                .map(movie => ({
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

// Verificar si la película ya se estrenó en digital (fecha de lanzamiento <= hoy)
function isMovieReleased(releaseDate) {
    if (!releaseDate) return false;
    const release = new Date(releaseDate);
    const today = new Date();
    return release <= today;
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
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    
    cart: document.getElementById('floating-cart'),
    cartCount: document.getElementById('cart-count'),
    btnViewList: document.getElementById('btn-view-list'),
    btnCopyList: document.getElementById('btn-copy-list'),

    selectionModal: document.getElementById('selection-modal'),
    closeSelectionModalBtn: document.querySelector('.close-selection-modal'),
    selectedMoviesList: document.getElementById('selected-movies-list'),
    modalCartCount: document.getElementById('modal-cart-count'),
    btnDeselectAllModal: document.getElementById('btn-deselect-all-modal'),

    synopsisModal: document.getElementById('synopsis-modal'),
    closeSynopsisModalBtn: document.querySelector('.close-synopsis-modal'),
    synopsisContent: document.getElementById('synopsis-content'),
    synopsisModalTitle: document.getElementById('synopsis-modal-title')
};

/**
 * Inicialización
 */
document.addEventListener('DOMContentLoaded', async () => {
    showLoading(true);

    // Prevenir menú contextual globalmente (excepto en carátulas)
    document.addEventListener('contextmenu', (e) => {
        // Permitir click derecho solo en carátulas
        if (!e.target.closest('.movie-card')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });

    // Prevenir doble click globalmente
    document.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });

    try {
        setupEventListeners();

        // Cargar películas iniciales
        await loadTMDBMovies();

        // Renderizar películas
        await renderMovies();

        // Ocultar loading
        showLoading(false);

    } catch (error) {
        console.error('Error durante la inicialización:', error);
        showLoading(false);
    }
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
 * Motor de Renderizado (Grid Principal)
 * Usa View Transitions API si está disponible para transiciones suaves.
 * Sistema de infinite scroll para cargar todas las películas de TMDB.
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

    // Determinar la función API a usar
    let apiFunction = null;
    let apiParams = {};

    if (query) {
        apiFunction = searchTMDB;
        apiParams = { query, language: AppState.searchLanguage, page: AppState.currentPage };
    } else if (category !== 'all') {
        const genreId = getGenreIdFromName(category);
        if (genreId) {
            apiFunction = getMoviesByGenre;
            apiParams = { genreId, language: AppState.searchLanguage, page: AppState.currentPage };
        }
    } else {
        apiFunction = getPopularTMDB;
        apiParams = { language: AppState.searchLanguage, page: AppState.currentPage };
    }

    // Cargar datos de la API
    // Detectar si es móvil una sola vez para toda la función
    const isMobile = window.innerWidth <= 650;
    let newMoviesCount = 0;
    if (apiFunction && (AppState.hasMorePages || !loadMore) && !AppState.isLoadingMore) {
        AppState.isLoadingMore = true;
        
        // En móvil, limitar películas en memoria para rendimiento máximo
        if (isMobile && AppState.tmdbMovies.length > 30) {
            AppState.tmdbMovies = AppState.tmdbMovies.slice(0, 30);
        }
        
        const optimizedPage = AppState.currentPage;
        
        const result = await apiFunction(...Object.values(apiParams));
        
        if (loadMore) {
            // Evitar duplicados usando Set basado en ID
            const existingIds = new Set(AppState.tmdbMovies.map(m => m.id));
            const newMovies = result.movies.filter(m => !existingIds.has(m.id));
            
            if (newMovies.length > 0) {
                const previousLength = AppState.tmdbMovies.length;
                AppState.tmdbMovies.push(...newMovies);
                newMoviesCount = newMovies.length;
            } else {
                AppState.hasMorePages = false;
            }
        } else {
            // Carga inicial: limpiar completamente y asignar nuevas películas
            // En móvil, cargar más películas para scroll precargado
            AppState.tmdbMovies = isMobile ? result.movies.slice(0, 40) : result.movies.slice(0, 60);
        }
        
        AppState.totalPages = result.totalPages;
        AppState.currentPage++;
        AppState.hasMorePages = AppState.currentPage <= AppState.totalPages;
        AppState.isLoadingMore = false;
    }

    let moviesToRender = AppState.tmdbMovies;

    // Solo ordenar en carga inicial, no en carga incremental
    if (!loadMore) {
        if (sort === 'az') moviesToRender.sort((a, b) => a.title.localeCompare(b.title, 'es'));
        else if (sort === 'za') moviesToRender.sort((a, b) => b.title.localeCompare(a.title, 'es'));
        else moviesToRender.sort((a, b) => {
            const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
            const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
            return dateB - dateA;
        });
    }

    if (!DOM.grid) return;
    
    // Solo limpiar si no es carga incremental
    if (!loadMore) {
        DOM.grid.innerHTML = '';
    }

    // Update total counter
    if (DOM.totalCount) {
        DOM.totalCount.textContent = AppState.tmdbMovies.length;
    }

    if (moviesToRender.length === 0 && !loadMore) {
        if (DOM.emptyState) {
            DOM.emptyState.classList.remove('hidden');
            DOM.emptyState.setAttribute('aria-hidden', 'false');
        }
    } else {
        if (DOM.emptyState) {
            DOM.emptyState.classList.add('hidden');
            DOM.emptyState.setAttribute('aria-hidden', 'true');
        }
        
        // Si es carga incremental, solo renderizar las películas nuevas SIN reordenar
        let moviesToRenderCards;
        if (loadMore && newMoviesCount > 0) {
            // Usar las últimas películas añadidas exactamente como vienen de la API
            const startIndex = AppState.tmdbMovies.length - newMoviesCount;
            moviesToRenderCards = AppState.tmdbMovies.slice(startIndex);
        } else {
            moviesToRenderCards = moviesToRender;
        }
        
        // Verificar que hay películas para renderizar
        if (!moviesToRenderCards || moviesToRenderCards.length === 0) {
            return;
        }
        
        const fragment = document.createDocumentFragment();

        moviesToRenderCards.forEach((movie, index) => {
            // Verificar que la película no ya existe en el DOM
            const existingCard = DOM.grid.querySelector(`[data-id="${movie.id}"]`);
            if (existingCard) {
                return; // Skip si ya existe
            }
            
            // Verificar que la película tiene ID válido
            if (!movie.id) {
                return;
            }
            
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.dataset.id = movie.id;
            card.setAttribute('role', 'listitem');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `${escapeHtml(movie.title)} - ${escapeHtml(movie.category || 'Sin categoría')}`);
            // Stagger animation delay per card (instantáneo en móvil)
            const actualIndex = loadMore ? AppState.tmdbMovies.length - moviesToRenderCards.length + index : index;
            const maxDelay = isMobile ? 0 : 0.3;
            const delayMultiplier = isMobile ? 0 : 0.005;
            card.style.animationDelay = `${Math.min(actualIndex * delayMultiplier, maxDelay)}s`;

            const imgSrc = movie.previewUrl || movie.coverUrl || AppState.defaultPlaceholder;
            const safeTitle = escapeHtml(movie.title);
            const safeOriginalTitle = movie.originalTitle && movie.originalTitle !== movie.title ? escapeHtml(movie.originalTitle) : '';
            const safeCategory = escapeHtml(movie.category || 'Otro');

            // Usar la variable isMobile ya declarada arriba
            const optimizedImgSrc = isMobile && imgSrc.includes('tmdb.org') 
                ? imgSrc.replace('/w500/', '/w342/') 
                : imgSrc;

            // Mostrar título original si es diferente al título en el idioma actual
            const titleHTML = safeOriginalTitle ?
                `<h3 class="card-title">${safeTitle}</h3><p class="card-original-title">${safeOriginalTitle}</p>` :
                `<h3 class="card-title">${safeTitle}</h3>`;

            card.innerHTML = `
                <div class="select-badge" aria-hidden="true"><i class="fa-solid fa-check"></i></div>
                <div class="card-img-container">
                    <img class="card-img" data-src="${optimizedImgSrc}" src="${AppState.defaultPlaceholder}" alt="Portada de ${safeTitle}" loading="eager" decoding="async">
                </div>
                <div class="card-overlay">
                    ${titleHTML}
                    <p class="card-category">${safeCategory}</p>
                </div>
            `;

            // Manejo instantáneo de carga de imagen
            const img = card.querySelector('.card-img');
            if (img) {
                img.classList.add('loaded');
                
                const handleImageError = () => {
                    img.src = AppState.defaultPlaceholder;
                };
                
                img.onerror = handleImageError;
            }

                    // Click para seleccionar/deseleccionar
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (card && !longPressTriggered) {
                    toggleSelection(movie.id, card);
                }
                longPressTriggered = false;
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (card) {
                        toggleSelection(movie.id, card);
                    }
                }
            });
            
            // Configurar long press para mostrar synopsis
            setupLongPress(card, movie);

            fragment.appendChild(card);
        });

        DOM.grid.appendChild(fragment);
        
        // Cargar imágenes de forma controlada para evitar errores de renderizado
        const allImages = DOM.grid.querySelectorAll('.card-img[data-src]');
        allImages.forEach(img => {
            if (img.dataset.src && img.src !== img.dataset.src) {
                // Usar Intersection Observer para carga diferida
                const imgObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            img.src = img.dataset.src;
                            img.onload = () => {
                                img.style.opacity = '1';
                            };
                            img.onerror = () => {
                                img.src = AppState.defaultPlaceholder;
                                img.style.opacity = '1';
                            };
                            observer.unobserve(img);
                        }
                    });
                }, { rootMargin: '50px' });
                
                imgObserver.observe(img);
            }
        });
    }
}

/**
 * Motor de Renderizado (Modal de Selección)
 */
function renderSelectedList() {
    if (!DOM.selectedMoviesList) return;

    // Siempre limpiar completamente antes de renderizar
    DOM.selectedMoviesList.innerHTML = '';

    if (AppState.selectedMovies.size === 0) {
        DOM.selectedMoviesList.innerHTML = '<li style="justify-content: center; color: var(--text-muted);" role="listitem">No hay películas seleccionadas</li>';
        return;
    }

    const selectedList = AppState.tmdbMovies.filter(m => AppState.selectedMovies.has(m.id));

    if (selectedList.length === 0) {
        DOM.selectedMoviesList.innerHTML = '<li style="justify-content: center; color: var(--text-muted);" role="listitem">No hay películas seleccionadas</li>';
        return;
    }

    // Sin animaciones para evitar fugas de memoria
    selectedList.forEach((movie) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'listitem');

        const safeTitle = escapeHtml(movie.title);
        const safeSynopsis = movie.overview ? escapeHtml(movie.overview) : 'Sin descripción disponible';

        // Synopsis siempre visible en móvil y desktop
        li.innerHTML = `
            <div class="selected-movie-info">
                <span class="selected-title" title="${safeTitle}">${safeTitle}</span>
                <p class="selected-synopsis">${safeSynopsis}</p>
            </div>
            <button class="remove-item" title="Quitar ${safeTitle}" aria-label="Quitar ${safeTitle} de la lista"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        `;

        const removeBtn = li.querySelector('.remove-item');
        if (removeBtn) {
            removeBtn.addEventListener('click', async () => {
                AppState.selectedMovies.delete(movie.id);
                const card = document.querySelector(`.movie-card[data-id="${movie.id}"]`);
                if (card) {
                    card.classList.remove('selected');

                    // Ocultar el badge de selección
                    const badge = card.querySelector('.select-badge');
                    if (badge) {
                        badge.style.opacity = '0';
                        badge.style.transform = 'scale(0.7)';
                    }

                    // Limpiar completamente el aria-label
                    const currentLabel = card.getAttribute('aria-label');
                    if (currentLabel) {
                        const cleanLabel = currentLabel.replace(' (seleccionada)', '').trim();
                        card.setAttribute('aria-label', cleanLabel);
                    }

                    // Forzar limpieza de estilos inline
                    card.style.transform = '';
                    card.style.transition = '';
                }
                // Volver a renderizar la lista
                renderSelectedList();
                updateCartUI();
            });
        }

        DOM.selectedMoviesList.appendChild(li);
    });
}

/**
 * Lógica de Selección y Carrito Flotante con Animaciones (Spring/Pulse)
 */
function toggleSelection(id, cardElement) {
    if (!cardElement || !id) {
        return;
    }
    
    try {
        const isSelected = AppState.selectedMovies.has(id);
        const isMobile = window.innerWidth <= 650;
        
        // Solo animaciones en desktop, no en móvil
        if (!isMobile) {
            cardElement.style.transition = 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)';
        }
        
        if (isSelected) {
            AppState.selectedMovies.delete(id);
            cardElement.classList.remove('selected');
            
            // Ocultar el badge de selección
            const badge = cardElement.querySelector('.select-badge');
            if (badge) {
                badge.style.opacity = '0';
                badge.style.transform = 'scale(0.7)';
            }
            
            // Limpiar completamente el aria-label
            const currentLabel = cardElement.getAttribute('aria-label');
            if (currentLabel) {
                const cleanLabel = currentLabel.replace(' (seleccionada)', '').trim();
                cardElement.setAttribute('aria-label', cleanLabel);
            }
            
            // Forzar limpieza de estilos inline
            cardElement.style.transform = '';
            cardElement.style.transition = '';

            // Sin animaciones para evitar fugas de memoria
        } else {
            AppState.selectedMovies.add(id);
            cardElement.classList.add('selected');
            const currentLabel = cardElement.getAttribute('aria-label');
            if (currentLabel) {
                cardElement.setAttribute('aria-label', currentLabel + ' (seleccionada)');
            }

            // Sin animaciones para evitar fugas de memoria
        }
        updateCartUI();
    } catch (error) {
        console.error('Error en toggleSelection:', error);
    }
}

function updateCartUI() {
    const count = AppState.selectedMovies.size;
    if (DOM.cartCount) DOM.cartCount.textContent = count;
    if (DOM.modalCartCount) DOM.modalCartCount.textContent = count;

    if (DOM.cart) {
        if (count > 0) {
            DOM.cart.classList.remove('hide-dock');
            DOM.cart.style.display = 'flex';
            DOM.cart.style.visibility = 'visible';
            DOM.cart.style.opacity = '1';
            DOM.cart.style.pointerEvents = 'auto';

            // En móvil, resetear transform
            if (window.innerWidth <= 900) {
                DOM.cart.style.transform = 'none';
            } else {
                DOM.cart.style.transform = 'translateX(-50%) translateY(0)';
            }
        } else {
            DOM.cart.classList.add('hide-dock');
        }
    }

    // Si el modal de selección está abierto, actualizarlo en tiempo real
    if (DOM.selectionModal && !DOM.selectionModal.classList.contains('hidden')) {
        renderSelectedList();
    }
}

function getSelectedMoviesText() {
    const selectedList = AppState.tmdbMovies.filter(m => AppState.selectedMovies.has(m.id));
    if (selectedList.length === 0) return '';
    
    let text = '';
    selectedList.forEach((movie) => {
        if (movie && movie.title) {
            text += movie.title;
            
            // Agregar subtítulo si existe
            if (movie.subtitle) {
                text += ` (${movie.subtitle})`;
            }
            
            text += '\n';
        }
    });
    
    // Agregar contador al final en el formato solicitado
    const count = selectedList.length;
    text += `\nTotal ${count} Películas`;
    
    return text;
}

/**
 * Modal de Synopsis (Long Press)
 */
function showSynopsisModal(movie) {
    if (!DOM.synopsisModal || !DOM.synopsisContent || !movie) return;
    
    const safeTitle = escapeHtml(movie.title);
    const safeSynopsis = movie.overview ? escapeHtml(movie.overview) : 'Sin descripción disponible';
    
    DOM.synopsisModalTitle.textContent = safeTitle;
    DOM.synopsisContent.innerHTML = `<p>${safeSynopsis}</p>`;
    
    // Forzar display block y visible
    DOM.synopsisModal.classList.remove('hidden');
    DOM.synopsisModal.style.display = 'flex';
    DOM.synopsisModal.style.visibility = 'visible';
    DOM.synopsisModal.style.opacity = '1';
    
    // Bloquear scroll del body
    document.body.style.overflow = 'hidden';
}

// Variables para Long Press
let longPressTimer = null;
let longPressTriggered = false;
const LONG_PRESS_DURATION = 1000; // 1 segundo exacto

function setupLongPress(card, movie) {
    if (!card || !movie) return;
    
    // Función unificada para cancelar timer
    const cancelTimer = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };
    
    // Touch start - iniciar timer
    card.addEventListener('touchstart', (e) => {
        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            // Vibración en móviles para feedback
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            showSynopsisModal(movie);
        }, LONG_PRESS_DURATION);
    }, { passive: true });
    
    // Touch end - cancelar timer
    card.addEventListener('touchend', cancelTimer);
    
    // Touch move - cancelar timer
    card.addEventListener('touchmove', cancelTimer, { passive: true });
    
    // Touch cancel - cancelar timer
    card.addEventListener('touchcancel', cancelTimer);

    // Click derecho para mostrar synopsis
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showSynopsisModal(movie);
        return false;
    });

    // Mouse events para desktop (solo si no es móvil)
    if (window.innerWidth > 650) {
        card.addEventListener('mousedown', (e) => {
            // Solo si no es click derecho
            if (e.button !== 2) {
                longPressTriggered = false;
                longPressTimer = setTimeout(() => {
                    longPressTriggered = true;
                    showSynopsisModal(movie);
                }, LONG_PRESS_DURATION);
            }
        });

        card.addEventListener('mouseup', cancelTimer);
        card.addEventListener('mouseleave', cancelTimer);
    }
}

/**
 * Notificación centrada temporal
 */
function showNotification(message) {
    // Eliminar notificación existente si hay
    const existingNotification = document.querySelector('.notification-center');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'notification-center';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(139, 92, 246, 0.95);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        text-align: center;
        backdrop-filter: blur(10px);
    `;

    document.body.appendChild(notification);

    // Eliminar después de 2 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 2000);
}

/**
 * Toast Notifications - Eliminadas para rendimiento
 */
function showToast(message, type = 'info') {
    // No-op: notificaciones eliminadas para ahorrar recursos
    return;
}

/**
 * Modal Management - Open/Close with body scroll lock
 */
function openModal(modalElement) {
    if (!modalElement) return;
    modalElement.classList.remove('hidden');
    document.body.classList.add('modal-open');
    // Focus the first focusable element inside the modal (sin setTimeout para evitar fugas)
    const firstFocusable = modalElement.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
        firstFocusable.focus();
    }
}

function closeModal(modalElement) {
    if (!modalElement) return;
    modalElement.classList.add('hidden');
    modalElement.style.display = 'none';
    modalElement.style.visibility = 'hidden';
    modalElement.style.opacity = '0';
    
    // Liberar scroll del body
    document.body.style.overflow = '';
    
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
    // AMBAS VISTAS: Carrito de selección
    // ═══════════════════════════════════════════
    if (DOM.btnViewList) {
        const openSelectionModal = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            // Limpiar lista antes de renderizar
            if (DOM.selectedMoviesList) {
                DOM.selectedMoviesList.innerHTML = '';
            }
            renderSelectedList();
            openModal(DOM.selectionModal);
        };

        // Click normal
        DOM.btnViewList.addEventListener('click', openSelectionModal);

        // Touch para móviles
        DOM.btnViewList.addEventListener('touchend', (e) => {
            e.preventDefault();
            openSelectionModal(e);
        });

        // Keyboard
        DOM.btnViewList.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openSelectionModal(e);
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
    
    // Modal de Synopsis
    if (DOM.closeSynopsisModalBtn) {
        DOM.closeSynopsisModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeModal(DOM.synopsisModal);
        });
    }
    if (DOM.synopsisModal) {
        DOM.synopsisModal.addEventListener('click', (e) => {
            if (e.target === DOM.synopsisModal) {
                e.preventDefault();
                e.stopPropagation();
                closeModal(DOM.synopsisModal);
            }
        });
        
        // Cerrar con tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !DOM.synopsisModal.classList.contains('hidden')) {
                closeModal(DOM.synopsisModal);
            }
        });
    }
    
    // Botón Copiar Lista
    if (DOM.btnCopyList) {
        DOM.btnCopyList.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (AppState.selectedMovies.size === 0) {
                return;
            }

            try {
                const textToCopy = getSelectedMoviesText();
                await navigator.clipboard.writeText(textToCopy);
                showNotification('¡Películas copiadas exitosamente!');
            } catch (err) {
                // Fallback para navegadores que no soportan clipboard API
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = getSelectedMoviesText();
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-9999px';
                    textArea.style.top = '0';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    showNotification('¡Películas copiadas exitosamente!');
                } catch (fallbackErr) {
                    console.error('Error al copiar:', fallbackErr);
                }
            }
        });
    }
    
    // Botón Limpiar Todo
    if (DOM.btnDeselectAllModal) {
        DOM.btnDeselectAllModal.addEventListener('click', async () => {
            try {
                AppState.selectedMovies.clear();
                document.querySelectorAll('.movie-card.selected').forEach(card => {
                    if (card) {
                        card.classList.remove('selected');
                        
                        // Ocultar el badge de selección
                        const badge = card.querySelector('.select-badge');
                        if (badge) {
                            badge.style.opacity = '0';
                            badge.style.transform = 'scale(0.7)';
                        }
                        
                        // Limpiar completamente el aria-label
                        const currentLabel = card.getAttribute('aria-label');
                        if (currentLabel) {
                            const cleanLabel = currentLabel.replace(' (seleccionada)', '').trim();
                            card.setAttribute('aria-label', cleanLabel);
                        }
                        
                        // Forzar limpieza de estilos inline
                        card.style.transform = '';
                        card.style.transition = '';
                    }
                });
                renderSelectedList();
                updateCartUI();
                closeModal(DOM.selectionModal);
            } catch (error) {
                console.error('Error al limpiar selección:', error);
            }
        });
    }

    // Infinite Scroll optimizado para evitar fugas de memoria
    let scrollTimeout = null;
    let lastScrollPosition = 0;
    let scrollListenerAdded = false;

    const handleScroll = () => {
        if (AppState.isLoadingMore || !AppState.hasMorePages) {
            return;
        }

        const currentScrollPosition = window.scrollY;

        // Solo procesar si estamos haciendo scroll hacia abajo
        if (currentScrollPosition <= lastScrollPosition) {
            lastScrollPosition = currentScrollPosition;
            return;
        }

        lastScrollPosition = currentScrollPosition;

        if (scrollTimeout) clearTimeout(scrollTimeout);

        scrollTimeout = setTimeout(async () => {
            const scrollPosition = window.innerHeight + window.scrollY;
            const threshold = document.body.offsetHeight - 800;

            if (scrollPosition >= threshold) {
                try {
                    await renderMovies(true);
                } catch (error) {
                    console.error('Error al cargar más películas:', error);
                }
            }
        }, 100);
    };

    // Agregar listener solo una vez
    if (!scrollListenerAdded) {
        window.addEventListener('scroll', handleScroll, { passive: true });
        scrollListenerAdded = true;
    }
}
