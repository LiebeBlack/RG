# Ky! Movies - Catálogo de Películas

🎬 Un catálogo de películas interactivo y moderno con selección, filtrado y compartición por WhatsApp.

## ✨ Características

- **Interfaz Moderna**: Diseño minimalista con animaciones suaves y tipografía definida
- **Catálogo Interactivo**: Búsqueda, filtrado por categoría y ordenamiento
- **Base de Datos Completa**: Integración con TMDB API (1,000,000+ películas)
- **Carátulas Oficiales**: Imágenes en alta calidad de TMDB
- **Búsqueda Multi-idioma**: Busca en español e inglés
- **Selección de Películas**: Sistema de selección múltiple con carrito flotante
- **Copiar Lista**: Genera listas numeradas para copiar al portapapeles
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

### TMDB API Key (Opcional pero Recomendado)
Para acceder a la base de datos completa de películas con carátulas oficiales:

1. **Regístrate gratis en TMDB**: https://www.themoviedb.org/signup
2. **Obtén tu API Key**:
   - Ve a https://www.themoviedb.org/settings/api
   - Crea una nueva API key (Gratis para uso personal)
   - Copia tu API key
3. **Configura en app.js** (línea 12):
   ```javascript
   const TMDB_API_KEY = "TU_API_KEY_AQUI"; // Reemplaza con tu key
   ```

**Beneficios de usar TMDB API:**
- ✅ Base de datos de más de 1,000,000 de películas
- ✅ Carátulas oficiales en alta calidad
- ✅ Búsqueda en español e inglés
- ✅ Información detallada (año, género, rating)
- ✅ Actualización automática de películas

**Sin TMDB API:**
- Solo mostrará tu base de datos local (`catalogo.json`)
- Las carátulas deben estar en la carpeta `caratulas/`

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

## 🌐 Despliegue en GitHub Pages (Guía Paso a Paso)

### 📋 REQUISITOS PREVIOS:
1. Cuenta en GitHub (gratuita en github.com)
2. Git instalado en tu computadora
3. Los archivos del proyecto listos

---

### 🚀 PASO 1: INSTALAR GIT (Si no lo tienes)

**Windows:**
1. Descarga Git desde: https://git-scm.com/download/win
2. Ejecuta el instalador y sigue las instrucciones
3. Verifica instalación: Abre terminal y escribe `git --version`

**Mac:**
```bash
brew install git
```

**Linux:**
```bash
sudo apt install git
```

---

### 🚀 PASO 2: INICIALIZAR REPOSITORIO GIT

Abre una terminal en la carpeta del proyecto:
```bash
cd C:\Users\Admin\Documents\GitHub\TESTER
```

Inicializa Git:
```bash
git init
```

Agrega todos los archivos:
```bash
git add .
```

Haz el primer commit:
```bash
git commit -m "Initial commit - Ky! Movies con TMDB API"
```

---

### 🚀 PASO 3: CREAR REPOSITORIO EN GITHUB

1. Ve a https://github.com
2. Inicia sesión o crea una cuenta
3. Click en el botón **"+"** → **New repository**
4. Configura el repositorio:
   - **Repository name**: `ky-movies` (o el nombre que prefieras)
   - **Description**: "Catálogo de películas con TMDB API"
   - **Public/Private**: **Public** (necesario para GitHub Pages gratuito)
   - **⚠️ NO marques** "Initialize this repository with a README"
5. Click en **Create repository**

---

### 🚀 PASO 4: CONECTAR Y SUBIR A GITHUB

Copia la URL del repositorio (es algo como: `https://github.com/TU_USUARIO/ky-movies.git`)

En la terminal, ejecuta:
```bash
git remote add origin https://github.com/TU_USUARIO/ky-movies.git
```

Cambia el nombre de la rama a main:
```bash
git branch -M main
```

Sube los archivos:
```bash
git push -u origin main
```

📝 **Si te pide usuario y contraseña:**
- Usuario: Tu usuario de GitHub
- Contraseña: **NO uses tu contraseña normal**, usa un **Personal Access Token**:
  1. Ve a GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  2. Click "Generate new token (classic)"
  3. Selecciona permisos: **repo** (todos los checkboxes bajo repo)
  4. Genera y copia el token
  5. Usa el token como contraseña

---

### 🚀 PASO 5: CONFIGURAR GITHUB PAGES

1. Ve a tu repositorio en GitHub
2. Click en la pestaña **Settings**
3. En el menú lateral, click en **Pages**
4. En **Build and deployment**:
   - **Source**: Selecciona **GitHub Actions**
5. Click en **Save**

🎉 **El workflow se ejecutará automáticamente** (verás un check verde en la pestaña Actions)

---

### 🚀 PASO 6: VERIFICAR DESPLIEGUE

1. Ve a la pestaña **Actions** en tu repositorio
2. Espera a que el workflow termine (puede tardar 1-2 minutos)
3. Cuando veas ✅ verde, tu sitio está desplegado
4. Ve a **Settings → Pages** y verás la URL de tu sitio:
   ```
   https://TU_USUARIO.github.io/ky-movies/
   ```

---

### 🔧 SOLUCIÓN DE PROBLEMAS COMUNES

**Error: "remote origin already exists"**
```bash
git remote remove origin
git remote add origin https://github.com/TU_USUARIO/ky-movies.git
```

**Error: "failed to push some refs"**
```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

**Workflow falla:**
- Verifica que los archivos estén en la carpeta `docs/`
- Verifica que `.github/workflows/pages.yml` exista
- Revisa el log del error en la pestaña Actions

**Sitio no carga:**
- Espera 5-10 minutos después del despliegue
- Verifica que el repositorio sea **Public**
- Limpia el caché del navegador

---

### 📁 ESTRUCTURA FINAL DEL PROYECTO

```
TESTER/
├── docs/                    # 📁 Carpeta raíz del sitio
│   ├── index.html          # 📄 Página principal
│   ├── modders.html        # 📄 Panel de administración
│   ├── styles.css          # 🎨 Estilos
│   ├── app.js              # ⚡ JavaScript (con TMDB API key)
│   ├── catalogo.json      # 📊 Base de datos local (opcional)
│   └── caratulas/          # 🖼️ Imágenes (opcional)
├── .github/                # 📁 Configuración GitHub
│   └── workflows/
│       └── pages.yml       # 🔄 Workflow automático
├── _config.yml            # ⚙️ Config Jekyll bypass
├── .gitignore             # 🚫 Archivos ignorados
└── README.md              # 📖 Documentación
```

---

### ✅ CHECKLIST ANTES DE DESPLEGAR

- [ ] Git instalado
- [ ] API key de TMDB configurada en `app.js`
- [ ] Todos los archivos en carpeta `docs/`
- [ ] `.github/workflows/pages.yml` existe
- [ ] Repositorio en GitHub creado (Public)
- [ ] Git init y commit hechos
- [ ] Git remote conectado
- [ ] Push exitoso
- [ ] GitHub Pages configurado (GitHub Actions)
- [ ] Workflow ejecutado con éxito

---

### 🎯 RESULTADO FINAL

Tu sitio estará disponible en:
```
https://TU_USUARIO.github.io/ky-movies/
```

**Características activas:**
- ✅ Base de datos completa de TMDB (1,000,000+ películas)
- ✅ Carátulas oficiales en alta calidad
- ✅ Búsqueda en español e inglés
- ✅ 19 categorías de películas
- ✅ Selección y copia de listas
- ✅ Panel de administración
- ✅ Responsive en todos los dispositivos
- ✅ Despliegue automático con cada cambio

---

### 🔄 ACTUALIZACIONES FUTURAS

Para actualizar el sitio:
```bash
# Modifica archivos
git add .
git commit -m "Descripción del cambio"
git push
```

El workflow se ejecutará automáticamente y desplegará los cambios.

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