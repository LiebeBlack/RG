# 🚀 Guía de Instalación y Despliegue - Windows

Esta guía es específica para Windows. Sigue estos pasos exactos para desplegar tu web en GitHub Pages sin errores.

---

## 📋 PASO 1: VERIFICAR SI TIENES GIT INSTALADO

Abre **PowerShell** o **Command Prompt** y escribe:
```powershell
git --version
```

**Si ves un número de versión** (ej: `git version 2.43.0`): ✅ Ya tienes Git instalado, ve al PASO 3

**Si ves "no se reconoce el comando"**: ❌ Instala Git siguiendo el PASO 2

---

## 📋 PASO 2: INSTALAR GIT EN WINDOWS

1. Descarga Git desde: https://git-scm.com/download/win
2. Ejecuta el instalador (`Git-2.43.0-64-bit.exe` o similar)
3. Durante la instalación, deja todas las opciones por defecto:
   - Click "Next" en todas las pantallas
   - Click "Finish" al final
4. Abre una nueva terminal y verifica:
   ```powershell
   git --version
   ```
5. Deberías ver: `git version X.X.X`

---

## 📋 PASO 3: INICIALIZAR REPOSITORIO GIT

1. Abre **PowerShell** o **Command Prompt**
2. Navega a la carpeta del proyecto:
   ```powershell
   cd C:\Users\Admin\Documents\GitHub\TESTER
   ```
3. Verifica que estás en la carpeta correcta:
   ```powershell
   dir
   ```
   Deberías ver: `docs/`, `README.md`, `.github/`, etc.

4. Inicializa Git:
   ```powershell
   git init
   ```
   Deberías ver: `Initialized empty Git repository in C:\Users\Admin\Documents\GitHub\TESTER\.git\`

5. Agrega todos los archivos:
   ```powershell
   git add .
   ```

6. Haz el primer commit:
   ```powershell
   git commit -m "Initial commit - Ky! Movies con TMDB API"
   ```
   Deberías ver mensajes como "X files changed"

---

## 📋 PASO 4: CREAR REPOSITORIO EN GITHUB

1. Ve a https://github.com
2. Inicia sesión o crea una cuenta (es gratis)
3. Click en el botón **"+"** (arriba a la derecha) → **New repository**
4. Configura el repositorio:
   - **Repository name**: `ky-movies` (o el nombre que prefieras)
   - **Description**: `Catálogo de películas con TMDB API`
   - **Public/Private**: 🔴 **Public** (obligatorio para GitHub Pages gratuito)
   - ⚠️ **NO marques** "Initialize this repository with a README"
   - ⚠️ **NO marques** "Add .gitignore"
   - ⚠️ **NO marques** "Choose a license"
5. Click en **Create repository**

---

## 📋 PASO 5: OBTENER TOKEN DE ACCESO PERSONAL

⚠️ **IMPORTANTE**: GitHub ya no permite contraseñas normales. Necesitas un token.

1. En GitHub, click en tu foto de perfil → **Settings**
2. En el menú lateral, scroll hasta abajo → **Developer settings**
3. Click en **Personal access tokens** → **Tokens (classic)**
4. Click en **Generate new token (classic)**
5. Configura el token:
   - **Note**: `Ky Movies Deployment`
   - **Expiration**: Elige una fecha (o No expiration)
   - **Select scopes**: Marca **repo** (marca todos los checkboxes bajo repo)
6. Click en **Generate token**
7. ⚠️ **COPIA EL TOKEN** (comienza con `ghp_...`)
   - Solo se muestra una vez, guárdalo en un lugar seguro

---

## 📋 PASO 6: CONECTAR CON GITHUB

1. En la página del repositorio en GitHub, copia la URL:
   ```
   https://github.com/TU_USUARIO/ky-movies.git
   ```
   (Reemplaza `TU_USUARIO` y `ky-movies` con tus datos reales)

2. En PowerShell, ejecuta:
   ```powershell
   git remote add origin https://github.com/TU_USUARIO/ky-movies.git
   ```

3. Cambia el nombre de la rama:
   ```powershell
   git branch -M main
   ```

4. Sube los archivos:
   ```powershell
   git push -u origin main
   ```

5. Te pedirá autenticación:
   - **Username**: Tu usuario de GitHub
   - **Password**: Pega el token que copiaste (ghp_...)
   - No se verá mientras escribes, es normal

6. Espera a que termine. Deberías ver algo como:
   ```
   To https://github.com/TU_USUARIO/ky-movies.git
    * [new branch]      main -> main
   ```

---

## 📋 PASO 7: CONFIGURAR GITHUB PAGES

1. En tu repositorio en GitHub, click en la pestaña **Settings**
2. En el menú lateral, click en **Pages**
3. En **Build and deployment**:
   - **Source**: Selecciona **GitHub Actions** del dropdown
4. Click en **Save**

🎉 **El workflow se ejecutará automáticamente**

---

## 📋 PASO 8: VERIFICAR DESPLIEGUE

1. Ve a la pestaña **Actions** en tu repositorio
2. Verás un workflow ejecutándose (amarillo)
3. Espera 1-2 minutos hasta que se vuelva verde ✅
4. Click en el workflow para ver los detalles
5. Si todo está bien, verás "Deploy to GitHub Pages" ✅

6. Ve a **Settings → Pages** de nuevo
7. En la parte superior verás la URL de tu sitio:
   ```
   https://TU_USUARIO.github.io/ky-movies/
   ```

8. Click en la URL para abrir tu sitio

---

## 🔧 SOLUCIÓN DE ERRORES COMUNES

### Error: "remote origin already exists"
```powershell
git remote remove origin
git remote add origin https://github.com/TU_USUARIO/ky-movies.git
git push -u origin main
```

### Error: "failed to push some refs"
```powershell
git pull origin main --allow-unrelated-histories
git push -u origin main
```

### Error: "Authentication failed"
- Verifica que usaste el token (ghp_), no tu contraseña normal
- Genera un nuevo token si el anterior expiró

### Workflow falla con "Page build failed"
- Verifica que la carpeta `docs/` exista
- Verifica que `docs/index.html` exista
- Revisa el log del error en la pestaña Actions

### Sitio muestra 404 o página no encontrada
- Espera 5-10 minutos después del despliegue
- Verifica que el repositorio sea **Public**
- Limpia el caché del navegador (Ctrl + F5)

---

## ✅ CHECKLIST FINAL

Antes de empezar, verifica:
- [ ] Git instalado (ejecuta `git --version`)
- [ ] Cuenta en GitHub creada
- [ ] Carpeta del proyecto tiene archivos `docs/`, `.github/`, etc.
- [ ] API key de TMDB configurada en `docs/app.js`
- [ ] Repositorio en GitHub creado (Public)
- [ ] Token de acceso personal generado y copiado
- [ ] Git init ejecutado
- [ ] Git commit hecho
- [ ] Git remote conectado
- [ ] Git push exitoso
- [ ] GitHub Pages configurado (GitHub Actions)
- [ ] Workflow ejecutado con éxito (verde ✅)

---

## 🎯 URL FINAL DE TU SITIO

Tu sitio estará disponible en:
```
https://TU_USUARIO.github.io/ky-movies/
```

Comparte esta URL con quien quieras que vea tu catálogo de películas.

---

## 🔄 PARA ACTUALIZAR EL SITIO EN EL FUTURO

Cuando quieras hacer cambios:

1. Modifica los archivos en `docs/`
2. En PowerShell:
   ```powershell
   cd C:\Users\Admin\Documents\GitHub\TESTER
   git add .
   git commit -m "Descripción del cambio"
   git push
   ```
3. El workflow se ejecutará automáticamente
4. Tu sitio se actualizará en 1-2 minutos

---

## 📞 AYUDA ADICIONAL

Si tienes problemas:
- Revisa la documentación de GitHub Pages: https://docs.github.com/pages
- Revisa el log del workflow en la pestaña Actions
- Verifica que todos los archivos estén en la carpeta `docs/`

¡Éxito con tu despliegue! 🎉
