const menuItems = document.querySelectorAll('.menu-item')
const nav = document.querySelector('.nav-lateral nav') // nuevo: referencia al nav
const mainEl = document.querySelector('main') || document.getElementById('content')

if (!mainEl) {
    console.error('No se encontró <main> ni #content. Añade un elemento <main> en index.html.')
}

const indicator = document.createElement('div')
indicator.className = 'menu-indicator'
nav.appendChild(indicator)

function updateIndicator(item) {
    if (!item) return
    const offsetTop = item.offsetTop
    const height = item.offsetHeight
    const width = item.offsetWidth
    indicator.style.transform = `translateY(${offsetTop}px)`
    indicator.style.height = `${height}px`
    indicator.style.width = `${width}px`
}


function setActive(item) {
    menuItems.forEach(i => i.classList.remove('active'))
    item.classList.add('active')
    updateIndicator(item)
}

async function loadPage(page) {
    if (!page) return
    try {
        const res = await fetch(`pages/${page}.html`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const html = await res.text()
        mainEl.innerHTML = html
        console.log(`Página cargada: pages/${page}.html`)
        return
    } catch (err) {
        console.warn(`No se pudo cargar pages/${page}.html — usando fallback.`, err)
        const templates = {
            dashboard: `<h1>Dashboard</h1><p>Resumen rápido.</p>`,
            tareas: `<h1>Tareas</h1><p>Lista de tareas (pendiente).</p>`,
            proyectos: `<h1>Proyectos</h1><p>Proyectos activos.</p>`,
            notas: `<h1>Notas</h1><p>Notas rápidas.</p>`,
            objetivos: `<h1>Objetivos</h1><p>Progreso y metas.</p>`,
            pomodoro: `<h1>Pomodoro</h1><p>Temporizador.</p>`,
            estadisticas: `<h1>Estadísticas</h1><p>Métricas.</p>`,
            configuracion: `<h1>Configuración</h1><p>Ajustes.</p>`
        }
        mainEl.innerHTML = templates[page] || `<h1>${page}</h1>`
    }
}

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        setActive(item)
        const page = item.dataset.page
        loadPage(page)
    })
})


const active = document.querySelector('.menu-item.active')
const startPage = active?.dataset.page || 'dashboard'
loadPage(startPage)

setTimeout(() => updateIndicator(document.querySelector('.menu-item.active')), 0)

window.addEventListener('resize', () => {
    updateIndicator(document.querySelector('.menu-item.active'))
})