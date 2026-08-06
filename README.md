# Ky! Movies - Catálogo de Películas

🎬 Un catálogo de películas interactivo y moderno con selección, filtrado y compartición por WhatsApp.

## ✨ Características

- **Interfaz Moderna**: Diseño minimalista con animaciones suaves y tipografía definida
- **Catálogo Interactivo**: Búsqueda, filtrado por categoría y ordenamiento
- **Selección de Películas**: Sistema de selección múltiple con carrito flotante
- **Compartición por WhatsApp**: Genera listas formateadas para compartir
- **Modo Administración**: Panel para agregar, editar y eliminar películas
- **Drag & Drop**: Subida de carátulas arrastrando archivos
- **Responsive**: Diseño adaptativo para todos los dispositivos
- **Accesibilidad**: Soporte completo para lectores de pantalla y navegación por teclado

## 🚀 Uso

### Vista de Usuario
Abre `index.html` para navegar el catálogo, buscar películas y seleccionarlas para compartir.

### Vista de Administración
Abre `modders.html` para gestionar el catálogo:
- Agregar películas manualmente
- Subir carátulas mediante drag & drop
- Editar detalles de películas existentes
- Exportar la base de datos (catalogo.json)
- Limpiar cambios locales

## 📁 Estructura del Proyecto

```
docs/
├── index.html          # Vista principal de usuario
├── modders.html        # Panel de administración
├── styles.css          # Estilos y animaciones
├── app.js              # Lógica de la aplicación
├── catalogo.json      # Base de datos de películas
└── caratulas/          # Carpeta para imágenes de carátulas (opcional)
```

## 🛠️ Tecnologías

- **HTML5**: Estructura semántica
- **CSS3**: Estilos modernos con variables CSS y animaciones
- **JavaScript (ES6+)**: Lógica sin frameworks
- **FontAwesome**: Iconos
- **Google Fonts**: Tipografías Inter y Outfit
- **GitHub Actions**: Automatización de despliegue
- **GitHub Pages**: Hosting estático

## 📝 Configuración

### Número de WhatsApp
Edita la constante `WHATSAPP_NUMBER` en `app.js` (línea 8) para configurar el número de destino:

```javascript
const WHATSAPP_NUMBER = "1234567890"; // Reemplaza con tu número
```

### Base de Datos
El catálogo se carga desde `catalogo.json`. Para actualizarlo:
1. Modifica el catálogo en modo administración
2. Exporta la base de datos usando el menú de opciones
3. Reemplaza el archivo `catalogo.json` con la versión exportada

## 🎨 Personalización

### Colores
Modifica las variables CSS en `styles.css` (líneas 1-36):

```css
:root {
    --bg-dark: #f5f0e8;
    --accent: #d4a574;
    --text-main: #2d231a;
    /* ... */
}
```

### Tipografía
Los tamaños de fuente se configuran con `clamp()` para diseño fluido:
- `--font-h1`: Títulos principales
- `--font-card-title`: Títulos de carátulas
- `--font-body`: Texto general

## 🔒 Seguridad

- Sanitización de HTML para prevenir XSS
- Sin uso de `eval()` o funciones peligrosas
- Validación de inputs de usuario
- Manejo seguro de URLs de objetos con cleanup de memoria

## ♿ Accesibilidad

- Etiquetas ARIA completas
- Navegación por teclado
- Contraste de colores WCAG AA
- Soporte para lectores de pantalla
- Roles semánticos HTML5

## 📱 Compatibilidad

- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Navegadores móviles: ✅

## 🌐 Despliegue en GitHub Pages

Este proyecto está configurado para despliegue automático en GitHub Pages.

### Pasos para desplegar:

1. **Inicializar repositorio Git** (si no está inicializado):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Crear repositorio en GitHub**:
   - Ve a github.com y crea un nuevo repositorio
   - No inicialices con README (ya tienes uno)

3. **Conectar y subir**:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git branch -M main
   git push -u origin main
   ```

4. **Configurar GitHub Pages**:
   - Ve a Settings > Pages
   - Selecciona "GitHub Actions" como fuente
   - El workflow `.github/workflows/pages.yml` se ejecutará automáticamente

5. **Verificar despliegue**:
   - Espera a que el workflow termine (Actions tab)
   - Tu sitio estará disponible en: `https://TU_USUARIO.github.io/TU_REPOSITORIO/`

### Estructura para GitHub Pages:
```
docs/              # Carpeta raíz del sitio
├── index.html     # Página principal
├── modders.html   # Panel de administración
├── styles.css     # Estilos
├── app.js         # JavaScript
├── catalogo.json  # Base de datos
└── caratulas/     # Imágenes (opcional)
.github/
└── workflows/
    └── pages.yml  # Workflow de despliegue
_config.yml        # Configuración Jekyll (bypass)
.gitignore         # Archivos ignorados
README.md          # Documentación
```

## 📄 Licencia

Este proyecto es de código abierto y está disponible para uso personal y educativo.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

---

Desarrollado con ❤️ para gestionar catálogos de películas de manera sencilla y moderna.