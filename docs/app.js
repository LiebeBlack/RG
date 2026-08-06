/**
 * CineBox - Visor Estático (Vanilla JS ES6+)
 * Arquitectura basada en repositorio (GitHub Pages). 
 * Soporta dos modos: Vista de Usuario (index.html) y Administración (modders.html).
 */

// NOTA: Reemplaza este número por el que prefieras usar para enviar los mensajes por WhatsApp
const WHATSAPP_NUMBER = "1234567890"; // <- Modifica esto

// Estado global de la aplicación
const AppState = {
    movies: [],
    selectedMovies: new Set(),
    isLoading: true,
    defaultPlaceholder: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMjAwIDMwMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQgc2xpY2UiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxZjIyMzEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM0ZjU1NmUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlNpbiBQb3J0YWRhPC90ZXh0Pjwvc3ZnPg=="
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
    btnWhatsapp: document.getElementById('btn-whatsapp'),
    
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
        renderMovies();
    } catch (error) {
        console.error('Error durante la inicialización:', error);
        showToast('Error al cargar el catálogo', 'error');
    } finally {
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

function handleFiles(files) {
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
    renderMovies();
    
    if (processedCount > 0) {
        showToast(`${processedCount} ítems registrados. Exporta la BD para guardar.`, 'success');
    } else {
        showToast('Los ítems ya existían en el catálogo.', 'info');
    }
}

/**
 * Motor de Renderizado (Grid Principal)
 * Usa View Transitions API si está disponible para transiciones suaves.
 */
function renderMovies() {
    const doRender = () => {
        const query = DOM.searchInput ? DOM.searchInput.value.toLowerCase().trim() : '';
        const category = DOM.categoryFilter ? DOM.categoryFilter.value : 'all';
        const sort = DOM.sortFilter ? DOM.sortFilter.value : 'recent';

        let filtered = AppState.movies.filter(m => {
            const matchesSearch = m.title.toLowerCase().includes(query) || 
                                  (m.category && m.category.toLowerCase().includes(query));
            const matchesCategory = category === 'all' || m.category === category;
            return matchesSearch && matchesCategory;
        });

        if (sort === 'az') filtered.sort((a, b) => a.title.localeCompare(b.title, 'es'));
        else if (sort === 'za') filtered.sort((a, b) => b.title.localeCompare(a.title, 'es'));
        else filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (!DOM.grid) return;
        DOM.grid.innerHTML = '';
        
        // Update total counter
        if (DOM.totalCount) {
            DOM.totalCount.textContent = filtered.length;
        }
        
        if (filtered.length === 0) {
            if (DOM.emptyState) {
                DOM.emptyState.classList.remove('hidden');
                DOM.emptyState.setAttribute('aria-hidden', 'false');
            }
        } else {
            if (DOM.emptyState) {
                DOM.emptyState.classList.add('hidden');
                DOM.emptyState.setAttribute('aria-hidden', 'true');
            }
            const fragment = document.createDocumentFragment();
            
            filtered.forEach((movie, index) => {
                const isSelected = AppState.selectedMovies.has(movie.id);
                const card = document.createElement('div');
                card.className = `movie-card${isSelected ? ' selected' : ''}`;
                card.dataset.id = movie.id;
                card.setAttribute('role', 'listitem');
                card.setAttribute('tabindex', '0');
                card.setAttribute('aria-label', `${escapeHtml(movie.title)} - ${escapeHtml(movie.category || 'Sin categoría')}${isSelected ? ' (seleccionada)' : ''}`);
                // Stagger animation delay per card (max 1.5s)
                card.style.animationDelay = `${Math.min(index * 0.04, 1.5)}s`;
                
                const imgSrc = movie.previewUrl || movie.coverUrl || AppState.defaultPlaceholder;
                const safeTitle = escapeHtml(movie.title);
                const safeCategory = escapeHtml(movie.category || 'Otro');
                
                let editBadgeHTML = '';
                if (isAdmin) {
                    editBadgeHTML = `<div class="edit-badge" title="Editar detalles" role="button" tabindex="0" aria-label="Editar ${safeTitle}"><i class="fa-solid fa-pen" aria-hidden="true"></i></div>`;
                }

                card.innerHTML = `
                    <div class="select-badge" aria-hidden="true"><i class="fa-solid fa-check"></i></div>
                    ${editBadgeHTML}
                    <div class="card-img-container">
                        <img class="card-img" src="${imgSrc}" alt="Portada de ${safeTitle}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${AppState.defaultPlaceholder}'">
                    </div>
                    <div class="card-overlay">
                        <h3 class="card-title">${safeTitle}</h3>
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
                                e.stopPropagation();
                                openEditModal(movie);
                            }
                        });
                    }
                }
                
                card.addEventListener('click', () => toggleSelection(movie.id, card));
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSelection(movie.id, card);
                    }
                });
                fragment.appendChild(card);
            });
            
            DOM.grid.appendChild(fragment);
        }
        updateCartUI();
    };

    // Use View Transitions API if available for smooth filter/search changes
    if (document.startViewTransition) {
        document.startViewTransition(doRender);
    } else {
        doRender();
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
        
        li.querySelector('.remove-item').addEventListener('click', () => {
            AppState.selectedMovies.delete(movie.id);
            renderMovies();
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
    let text = `🎬 *MI PEDIDO DE PELÍCULAS* (Total: ${selectedList.length})\n\n`;
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
    const debouncedRender = debounce(renderMovies, 200);
    if (DOM.searchInput) DOM.searchInput.addEventListener('input', debouncedRender);
    if (DOM.categoryFilter) DOM.categoryFilter.addEventListener('change', renderMovies);
    if (DOM.sortFilter) DOM.sortFilter.addEventListener('change', renderMovies);

    // ═══════════════════════════════════════════
    // SOLO ADMIN: Archivos y Drag & Drop
    // ═══════════════════════════════════════════
    if (DOM.fileUpload) {
        DOM.fileUpload.addEventListener('change', (e) => { 
            handleFiles(e.target.files); 
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
        DOM.addMovieForm.addEventListener('submit', (e) => {
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
            renderMovies(); 
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
        DOM.editMovieForm.addEventListener('submit', (e) => {
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
                renderMovies(); 
                closeModal(DOM.editModal);
                showToast('Película actualizada con éxito', 'success');
            } else {
                showToast('Película no encontrada en el catálogo', 'error');
            }
        });
    }
    if (DOM.btnDeleteMovie) {
        DOM.btnDeleteMovie.addEventListener('click', () => {
            const id = document.getElementById('edit-movie-id')?.value;
            if (!id) return;
            
            if (confirm('¿Estás seguro de que deseas eliminar esta película del catálogo?')) {
                AppState.movies = AppState.movies.filter(m => m.id !== id);
                AppState.selectedMovies.delete(id);
                saveToLocalStorage();
                renderMovies();
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
        DOM.btnDeselectAllModal.addEventListener('click', () => { 
            AppState.selectedMovies.clear(); 
            renderMovies(); 
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
    
    if (DOM.btnWhatsapp) {
        DOM.btnWhatsapp.addEventListener('click', () => {
            if (AppState.selectedMovies.size === 0) {
                showToast('Selecciona películas primero', 'info');
                return;
            }
            const text = encodeURIComponent(getSelectedMoviesText());
            const url = WHATSAPP_NUMBER 
                ? `https://wa.me/${WHATSAPP_NUMBER}?text=${text}` 
                : `https://wa.me/?text=${text}`;
            window.open(url, '_blank', 'noopener,noreferrer');
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
        DOM.btnClearDb.addEventListener('click', () => {
            if (confirm('⚠️ ¿Vaciar los cambios locales no exportados? (Se recargará desde catalogo.json)')) {
                localStorage.removeItem('cinebox_movies');
                AppState.movies = []; 
                AppState.selectedMovies.clear();
                loadDatabase().then(() => {
                    renderMovies();
                    showToast('Memoria local borrada y catálogo recargado.', 'success');
                });
            }
        });
    }
}
