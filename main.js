const menuItems = document.querySelectorAll('.menu-item')
const nav = document.querySelector('.nav-lateral nav') // nuevo: referencia al nav
// preferir el contenedor interno `#content` si existe, para no reemplazar el <main> entero
const mainEl = document.getElementById('content') || document.querySelector('main')

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
        // parsear y extraer solo el contenido útil para inyectar en #content
        try {
            const tmp = document.createElement('div')
            tmp.innerHTML = html
            // preferir el elemento con id "content" dentro del fragmento, luego <main>, luego <body>
            const fragment = tmp.querySelector('#content') || tmp.querySelector('main') || tmp.querySelector('body') || tmp
            mainEl.innerHTML = fragment.innerHTML
        } catch (e) {
            mainEl.innerHTML = html
        }
        console.log(`Página cargada: pages/${page}.html`)
        runPageScripts(page)
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
        runPageScripts(page)
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

function runPageScripts(page) {
    if (!page) return
    if (page === 'tareas' && typeof initTareas === 'function') {
        try { initTareas() } catch (e) { console.error('Error iniciando tareas:', e) }
    }
    if (page === 'dashboard' && typeof initDashboard === 'function') {
        try { initDashboard() } catch (e) { console.error('Error iniciando dashboard:', e) }
    }
    if (page === 'proyectos' && typeof initProyectos === 'function') {
        try { initProyectos() } catch (e) { console.error('Error iniciando proyectos:', e) }
    }
    if (page === 'notas' && typeof initNotas === 'function') {
        try { initNotas() } catch (e) { console.error('Error iniciando notas:', e) }
    }
    if (page === 'objetivos' && typeof initObjetivos === 'function') {
        try { initObjetivos() } catch (e) { console.error('Error iniciando objetivos:', e) }
    }
    // render objectives summary in dashboard if present
    if (page === 'dashboard' && typeof renderObjectivesSummary === 'function') {
        try { renderObjectivesSummary() } catch (e) { console.error('Error renderizando objetivos en dashboard:', e) }
    }
    if (page === 'pomodoro' && typeof initPomodoro === 'function') {
        try { initPomodoro() } catch (e) { console.error('Error iniciando pomodoro:', e) }
    }

    // actualizar estadísticas cuando se cargue dashboard o estadisticas
    if (page === 'dashboard' && typeof renderDashboardStats === 'function') {
        try { renderDashboardStats() } catch (e) { console.error('Error renderizando stats dashboard:', e) }
    }
    if (page === 'estadisticas' && typeof renderStatisticsPage === 'function') {
        try { renderStatisticsPage() } catch (e) { console.error('Error renderizando estadisticas:', e) }
    }
}

// Inicializador de la funcionalidad de Tareas (creación / edición)
function initTareas() {
    const STORAGE_KEY = 'tareas-list'
    const PROJECTS_KEY = 'projects-list'
    const app = document.getElementById('tareas-app')
    if (!app) return

    const input = app.querySelector('#new-task-input')
    const dateInput = app.querySelector('#new-task-date')
    const addBtn = app.querySelector('#add-task-btn')
    const list = app.querySelector('#task-list')

    function save(tasks) { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)) }
    function load() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
    function loadProjects() { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') }
    function saveProjects(projects) { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)) }

    function findProjectName(pid, spid) {
        if (!pid) return ''
        const projects = loadProjects()
        const p = projects.find(x => x.id === pid)
        if (!p) return ''
        if (spid) {
            const sp = (p.subprojects || []).find(s => s.id === spid)
            if (sp) return `${p.name} / ${sp.name}`
        }
        return p.name
    }

    function removeTaskFromProjects(taskId) {
        const projects = loadProjects()
        let changed = false
        projects.forEach(pr => {
            pr.tasks = (pr.tasks || []).filter(t => {
                if (t.id === taskId) { changed = true; return false }
                return true
            })
            (pr.subprojects || []).forEach(sp => {
                sp.tasks = (sp.tasks || []).filter(t => {
                    if (t.id === taskId) { changed = true; return false }
                    return true
                })
            })
        })
        if (changed) saveProjects(projects)
    }

    function syncTaskCompletionToProjects(taskId, completed) {
        const projects = loadProjects()
        let changed = false
        projects.forEach(pr => {
            (pr.tasks || []).forEach(t => { if (t.id === taskId) { t.completed = completed; changed = true } })
            (pr.subprojects || []).forEach(sp => (sp.tasks || []).forEach(t => { if (t.id === taskId) { t.completed = completed; changed = true } }))
        })
        if (changed) saveProjects(projects)
    }

    function moveTaskBetweenProjects(taskId, oldPid, oldSpid, newPid, newSpid, taskObj) {
        const projects = loadProjects()
        // remove from old
        projects.forEach(pr => {
            pr.tasks = (pr.tasks || []).filter(t => t.id !== taskId)
            (pr.subprojects || []).forEach(sp => { sp.tasks = (sp.tasks || []).filter(t => t.id !== taskId) })
        })
        // add to new
        if (newPid) {
            const target = projects.find(p => p.id === newPid)
            if (target) {
                if (newSpid) {
                    const sp = (target.subprojects || []).find(s => s.id === newSpid)
                    if (sp) { sp.tasks = sp.tasks || []; sp.tasks.push(taskObj) }
                } else {
                    target.tasks = target.tasks || []; target.tasks.push(taskObj)
                }
            }
        }
        saveProjects(projects)
    }

    function render() {
        const tasks = load()
        list.innerHTML = ''
        const projects = loadProjects()
        tasks.forEach((t, idx) => {
            const li = document.createElement('li')
            li.className = 'task-item'

            // build checkbox structure expected by the SASS styles:
            // <input type="checkbox" class="task-checkbox" id="..."> + <label class="checkbox-label" for="..."> ... </label>
            const checkbox = document.createElement('input')
            checkbox.type = 'checkbox'
            checkbox.className = 'task-checkbox'
            const cbId = `task-cb-${t.id}`
            checkbox.id = cbId
            checkbox.checked = !!t.completed

            const label = document.createElement('label')
            label.className = 'checkbox-label'
            label.htmlFor = cbId

            const box = document.createElement('div')
            box.className = 'checkbox-box'
            const fill = document.createElement('div')
            fill.className = 'checkbox-fill'
            const checkmark = document.createElement('span')
            checkmark.className = 'checkmark'
            // inline SVG for check icon
            checkmark.innerHTML = '<svg class="check-icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>'
            const ripple = document.createElement('span')
            ripple.className = 'success-ripple'
            box.appendChild(fill)
            box.appendChild(checkmark)
            box.appendChild(ripple)

            const textSpan = document.createElement('span')
            textSpan.className = 'checkbox-text'
            textSpan.textContent = t.name

            label.appendChild(box)
            label.appendChild(textSpan)

            const nameSpan = textSpan
            nameSpan.classList.add('task-name')
            if (t.completed) nameSpan.style.textDecoration = 'line-through'

            const projectSpan = document.createElement('small')
            projectSpan.className = 'task-project'
            projectSpan.textContent = findProjectName(t.projectId, t.subprojectId)

            const dateSpan = document.createElement('small')
            dateSpan.className = 'task-date'
            dateSpan.textContent = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ''
            dateSpan.style.opacity = t.completed ? '0.6' : '1'

            const editBtn = document.createElement('button')
            editBtn.textContent = 'Editar'
            editBtn.className = 'btn-edit'

            const delBtn = document.createElement('button')
            delBtn.textContent = 'Eliminar'
            delBtn.className = 'btn-delete'

            editBtn.addEventListener('click', () => startEdit(li, idx))
            delBtn.addEventListener('click', () => {
                const tasks = load()
                const removed = tasks.splice(idx, 1)[0]
                save(tasks)
                // eliminar de proyectos
                removeTaskFromProjects(removed.id)
                render()
            })

            checkbox.addEventListener('change', () => {
                const tasks = load()
                tasks[idx].completed = checkbox.checked
                save(tasks)
                syncTaskCompletionToProjects(tasks[idx].id, checkbox.checked)
                render()
            })

            li.appendChild(checkbox)
            li.appendChild(label)
            li.appendChild(nameSpan)
            li.appendChild(projectSpan)
            li.appendChild(dateSpan)
            li.appendChild(editBtn)
            li.appendChild(delBtn)
            list.appendChild(li)
        })
    }

    function startEdit(li, idx) {
        const tasks = load()
        const current = tasks[idx]
        li.innerHTML = ''
        const inputEdit = document.createElement('input')
        inputEdit.type = 'text'
        inputEdit.value = current.name
        inputEdit.className = 'edit-input'

        const dateEdit = document.createElement('input')
        dateEdit.type = 'date'
        dateEdit.value = current.dueDate ? current.dueDate.split('T')[0] : ''
        dateEdit.className = 'edit-date'

        // project selector
        const projSelect = document.createElement('select')
        const emptyOpt = document.createElement('option')
        emptyOpt.value = ''
        emptyOpt.textContent = 'Sin proyecto'
        projSelect.appendChild(emptyOpt)
        const projects = loadProjects()
        projects.forEach(p => {
            const opt = document.createElement('option')
            opt.value = `${p.id}`
            opt.textContent = p.name
            projSelect.appendChild(opt)
            (p.subprojects || []).forEach(sp => {
                const opt2 = document.createElement('option')
                opt2.value = `${p.id}::${sp.id}`
                opt2.textContent = `  └ ${p.name} / ${sp.name}`
                projSelect.appendChild(opt2)
            })
        })
        // set current selection
        if (current.projectId && current.subprojectId) projSelect.value = `${current.projectId}::${current.subprojectId}`
        else if (current.projectId) projSelect.value = `${current.projectId}`
        else projSelect.value = ''

        const saveBtn = document.createElement('button')
        saveBtn.textContent = 'Guardar'
        const cancelBtn = document.createElement('button')
        cancelBtn.textContent = 'Cancelar'

        saveBtn.addEventListener('click', () => {
            const val = inputEdit.value.trim()
            if (!val) return
            const oldProjectId = current.projectId
            const oldSubId = current.subprojectId
            const sel = projSelect.value
            let newPid = null, newSpid = null
            if (sel) {
                if (sel.includes('::')) {
                    const parts = sel.split('::')
                    newPid = parts[0]; newSpid = parts[1]
                } else {
                    newPid = sel; newSpid = null
                }
            }
            // update global task
            tasks[idx].name = val
            tasks[idx].dueDate = dateEdit.value ? new Date(dateEdit.value).toISOString() : null
            tasks[idx].projectId = newPid || null
            tasks[idx].subprojectId = newSpid || null
            save(tasks)
            // move between projects if needed
            if (oldProjectId !== newPid || oldSubId !== newSpid) {
                const taskObj = { id: tasks[idx].id, name: tasks[idx].name, dueDate: tasks[idx].dueDate, completed: tasks[idx].completed }
                moveTaskBetweenProjects(tasks[idx].id, oldProjectId, oldSubId, newPid, newSpid, taskObj)
            } else {
                // update name/date in projects if exists
                const projects = loadProjects()
                projects.forEach(pr => {
                    (pr.tasks || []).forEach(t => { if (t.id === tasks[idx].id) { t.name = tasks[idx].name; t.dueDate = tasks[idx].dueDate } })
                    (pr.subprojects || []).forEach(sp => (sp.tasks || []).forEach(t => { if (t.id === tasks[idx].id) { t.name = tasks[idx].name; t.dueDate = tasks[idx].dueDate } }))
                })
                saveProjects(projects)
            }
            render()
        })
        cancelBtn.addEventListener('click', () => render())

        li.appendChild(inputEdit)
        li.appendChild(dateEdit)
        li.appendChild(projSelect)
        li.appendChild(saveBtn)
        li.appendChild(cancelBtn)
        inputEdit.focus()
    }

    addBtn.addEventListener('click', () => {
        const val = input.value.trim()
        if (!val) return
        const tasks = load()
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6)
        const due = dateInput && dateInput.value ? new Date(dateInput.value).toISOString() : null
        const newTask = { id, name: val, dueDate: due, completed: false, projectId: null, subprojectId: null }
        tasks.push(newTask)
        save(tasks)
        input.value = ''
        if (dateInput) dateInput.value = ''
        render()
    })

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click() })

    render()
}

function initDashboard() {
    const STORAGE_KEY = 'tareas-list'
    const el = document.getElementById('dashboard-tasks')
    if (!el) return
    const allTasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    // Excluir tareas completadas para el listado de próximas tareas
    const tasks = allTasks.filter(t => !t.completed)
    el.innerHTML = ''
    if (!tasks.length) {
        el.innerHTML = '<li>No hay tareas.</li>'
        return
    }
    // ordenar por fecha próxima (sin fecha al final)
    tasks.sort((a,b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate) - new Date(b.dueDate)
    })
    const today = new Date()
    tasks.forEach(t => {
        const li = document.createElement('li')
        li.className = 'dashboard-task'
        const name = document.createElement('span')
        name.textContent = t.name
        const info = document.createElement('small')
        if (t.dueDate) {
            const d = new Date(t.dueDate)
            info.textContent = d.toLocaleDateString()
            if (d < today) info.style.color = 'crimson'
        } else {
            info.textContent = ''
        }
        // marcar visualmente si está completada
        if (t.completed) {
            name.style.textDecoration = 'line-through'
            name.style.opacity = '0.6'
            info.style.opacity = '0.6'
        }
        li.appendChild(name)
        li.appendChild(info)
        el.appendChild(li)
    })
}

// Inicializador para Proyectos, subproyectos y tareas dentro de proyectos
function initProyectos() {
    const STORAGE_KEY = 'projects-list'
    const app = document.getElementById('projects-app')
    if (!app) return

    const projectsListEl = app.querySelector('#projects-list')
    const detailsEl = app.querySelector('#project-details')
    const newProjectInput = app.querySelector('#new-project-name')
    const addProjectBtn = app.querySelector('#add-project-btn')

    const GLOBAL_TASKS_KEY = 'tareas-list'
    function save(projects) { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)) }
    function load() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
    function loadGlobalTasks() { return JSON.parse(localStorage.getItem(GLOBAL_TASKS_KEY) || '[]') }
    function saveGlobalTasks(tasks) { localStorage.setItem(GLOBAL_TASKS_KEY, JSON.stringify(tasks)) }
    function createId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6) }

    let selectedProjectId = null

    function renderProjectsList() {
        const projects = load()
        projectsListEl.innerHTML = ''
        projects.forEach(p => {
            const li = document.createElement('li')
            li.className = 'project-item'
            const btn = document.createElement('button')
            btn.textContent = p.name
            btn.addEventListener('click', () => {
                selectedProjectId = p.id
                renderProjectDetails(p.id)
            })

            const del = document.createElement('button')
            del.textContent = 'Eliminar'
            del.className = 'btn-delete'
            del.addEventListener('click', () => {
                const projects = load()
                const idx = projects.findIndex(x => x.id === p.id)
                if (idx > -1) {
                    // eliminar tareas asociadas en la lista global
                    const projectToRemove = projects[idx]
                    const idsToRemove = []
                    ;(projectToRemove.tasks || []).forEach(t => idsToRemove.push(t.id))
                    ;(projectToRemove.subprojects || []).forEach(sp => (sp.tasks || []).forEach(t => idsToRemove.push(t.id)))
                    if (idsToRemove.length) {
                        const g = loadGlobalTasks().filter(x => !idsToRemove.includes(x.id))
                        saveGlobalTasks(g)
                    }
                    projects.splice(idx,1)
                    save(projects)
                    if (selectedProjectId === p.id) {
                        selectedProjectId = null
                        detailsEl.innerHTML = '<p>Selecciona un proyecto para ver detalles.</p>'
                    }
                    renderProjectsList()
                }
            })

            li.appendChild(btn)
            li.appendChild(del)
            projectsListEl.appendChild(li)
        })
    }

    function renderProjectDetails(projectId) {
        const projects = load()
        const project = projects.find(p => p.id === projectId)
        if (!project) return
        detailsEl.innerHTML = ''

        const title = document.createElement('h2')
        title.textContent = project.name

        // Add subproject UI
        const subCreate = document.createElement('div')
        const subInput = document.createElement('input')
        subInput.placeholder = 'Nuevo subproyecto'
        const subBtn = document.createElement('button')
        subBtn.textContent = 'Crear subproyecto'
        subCreate.appendChild(subInput)
        subCreate.appendChild(subBtn)

        // Add task to project UI
        const taskCreate = document.createElement('div')
        const taskInput = document.createElement('input')
        taskInput.placeholder = 'Nueva tarea (proyecto)'
        const taskDate = document.createElement('input')
        taskDate.type = 'date'
        const taskBtn = document.createElement('button')
        taskBtn.textContent = 'Añadir tarea al proyecto'
        taskCreate.appendChild(taskInput)
        taskCreate.appendChild(taskDate)
        taskCreate.appendChild(taskBtn)

        // Subprojects list
        const subList = document.createElement('ul')
        subList.className = 'subprojects-list'
        project.subprojects = project.subprojects || []
        project.subprojects.forEach(sp => {
            const li = document.createElement('li')
            const name = document.createElement('span')
            name.textContent = sp.name
            const openBtn = document.createElement('button')
            openBtn.textContent = 'Ver'
            openBtn.addEventListener('click', () => renderSubproject(projectId, sp.id))
            const delSp = document.createElement('button')
            delSp.textContent = 'Eliminar'
            delSp.addEventListener('click', () => {
                const projects = load()
                const pr = projects.find(x => x.id === projectId)
                const idx = pr.subprojects.findIndex(s => s.id === sp.id)
                if (idx > -1) {
                    // eliminar tareas del subproyecto también de la lista global
                    const tasksIds = (pr.subprojects[idx].tasks || []).map(t => t.id)
                    if (tasksIds.length) {
                        const g = loadGlobalTasks().filter(x => !tasksIds.includes(x.id))
                        saveGlobalTasks(g)
                    }
                    pr.subprojects.splice(idx,1)
                }
                save(projects)
                renderProjectDetails(projectId)
                renderProjectsList()
            })
            li.appendChild(name)
            li.appendChild(openBtn)
            li.appendChild(delSp)
            subList.appendChild(li)
        })

        // Tasks list for project (not subprojects)
        const tasksTitle = document.createElement('h3')
        tasksTitle.textContent = 'Tareas del proyecto'
        const tasksList = document.createElement('ul')
        tasksList.className = 'project-tasks'
        project.tasks = project.tasks || []
        project.tasks.forEach(tsk => {
            const li = document.createElement('li')
            const chk = document.createElement('input')
            chk.type = 'checkbox'
            chk.checked = !!tsk.completed
            chk.addEventListener('change', () => {
                const projects = load()
                const pr = projects.find(x => x.id === projectId)
                const t = pr.tasks.find(x => x.id === tsk.id)
                if (t) {
                    t.completed = chk.checked
                    save(projects)
                    // sincronizar con lista global
                    const g = loadGlobalTasks()
                    const gt = g.find(x => x.id === tsk.id)
                    if (gt) { gt.completed = chk.checked; saveGlobalTasks(g) }
                    renderProjectDetails(projectId)
                }
            })
            const span = document.createElement('span')
            span.textContent = tsk.name + (tsk.dueDate ? ` — ${new Date(tsk.dueDate).toLocaleDateString()}` : '')
            if (tsk.completed) span.style.textDecoration = 'line-through'
            const del = document.createElement('button')
            del.textContent = 'Eliminar'
            del.addEventListener('click', () => {
                const projects = load()
                const pr = projects.find(x => x.id === projectId)
                pr.tasks = pr.tasks.filter(x => x.id !== tsk.id)
                save(projects)
                // eliminar de la lista global
                const g = loadGlobalTasks().filter(x => x.id !== tsk.id)
                saveGlobalTasks(g)
                renderProjectDetails(projectId)
            })
            li.appendChild(chk)
            li.appendChild(span)
            li.appendChild(del)
            tasksList.appendChild(li)
        })

        detailsEl.appendChild(title)
        detailsEl.appendChild(subCreate)
        detailsEl.appendChild(subList)
        detailsEl.appendChild(taskCreate)
        detailsEl.appendChild(tasksTitle)
        detailsEl.appendChild(tasksList)

        // Handlers
        subBtn.addEventListener('click', () => {
            const name = subInput.value.trim()
            if (!name) return
            const projects = load()
            const pr = projects.find(x => x.id === projectId)
            pr.subprojects = pr.subprojects || []
            pr.subprojects.push({ id: createId(), name, tasks: [] })
            save(projects)
            renderProjectDetails(projectId)
            renderProjectsList()
        })

        taskBtn.addEventListener('click', () => {
            const name = taskInput.value.trim()
            if (!name) return
            const projects = load()
            const pr = projects.find(x => x.id === projectId)
            pr.tasks = pr.tasks || []
            const tid = createId()
            const due = taskDate.value ? new Date(taskDate.value).toISOString() : null
            pr.tasks.push({ id: tid, name, dueDate: due, completed: false })
            save(projects)
            // añadir también a la lista global de tareas
            const g = loadGlobalTasks()
            g.push({ id: tid, name, dueDate: due, completed: false, projectId: projectId, subprojectId: null })
            saveGlobalTasks(g)
            renderProjectDetails(projectId)
        })
    }

    function renderSubproject(projectId, subId) {
        const projects = load()
        const project = projects.find(p => p.id === projectId)
        if (!project) return
        const sub = project.subprojects.find(s => s.id === subId)
        if (!sub) return
        detailsEl.innerHTML = ''
        const title = document.createElement('h3')
        title.textContent = `${project.name} / ${sub.name}`

        const taskCreate = document.createElement('div')
        const taskInput = document.createElement('input')
        taskInput.placeholder = 'Nueva tarea (subproyecto)'
        const taskDate = document.createElement('input')
        taskDate.type = 'date'
        const taskBtn = document.createElement('button')
        taskBtn.textContent = 'Añadir tarea al subproyecto'
        taskCreate.appendChild(taskInput)
        taskCreate.appendChild(taskDate)
        taskCreate.appendChild(taskBtn)

        const tasksList = document.createElement('ul')
        sub.tasks = sub.tasks || []
        sub.tasks.forEach(tsk => {
            const li = document.createElement('li')
            const chk = document.createElement('input')
            chk.type = 'checkbox'
            chk.checked = !!tsk.completed
            chk.addEventListener('change', () => {
                const projects = load()
                const pr = projects.find(x => x.id === projectId)
                const sp = pr.subprojects.find(x => x.id === subId)
                const t = sp.tasks.find(x => x.id === tsk.id)
                if (t) {
                    t.completed = chk.checked
                    save(projects)
                    // sincronizar con lista global
                    const g = loadGlobalTasks()
                    const gt = g.find(x => x.id === tsk.id)
                    if (gt) { gt.completed = chk.checked; saveGlobalTasks(g) }
                    renderSubproject(projectId, subId)
                }
            })
            const span = document.createElement('span')
            span.textContent = tsk.name + (tsk.dueDate ? ` — ${new Date(tsk.dueDate).toLocaleDateString()}` : '')
            if (tsk.completed) span.style.textDecoration = 'line-through'
            const del = document.createElement('button')
            del.textContent = 'Eliminar'
            del.addEventListener('click', () => {
                const projects = load()
                const pr = projects.find(x => x.id === projectId)
                const sp = pr.subprojects.find(x => x.id === subId)
                sp.tasks = sp.tasks.filter(x => x.id !== tsk.id)
                save(projects)
                // eliminar de la lista global
                const g = loadGlobalTasks().filter(x => x.id !== tsk.id)
                saveGlobalTasks(g)
                renderSubproject(projectId, subId)
            })
            li.appendChild(chk)
            li.appendChild(span)
            li.appendChild(del)
            tasksList.appendChild(li)
        })

        taskBtn.addEventListener('click', () => {
            const name = taskInput.value.trim()
            if (!name) return
            const projects = load()
            const pr = projects.find(x => x.id === projectId)
            const sp = pr.subprojects.find(x => x.id === subId)
            sp.tasks = sp.tasks || []
            const tid = createId()
            const due = taskDate.value ? new Date(taskDate.value).toISOString() : null
            sp.tasks.push({ id: tid, name, dueDate: due, completed: false })
            save(projects)
            // añadir también a la lista global de tareas
            const g = loadGlobalTasks()
            g.push({ id: tid, name, dueDate: due, completed: false, projectId: projectId, subprojectId: subId })
            saveGlobalTasks(g)
            renderSubproject(projectId, subId)
        })

        detailsEl.appendChild(title)
        detailsEl.appendChild(taskCreate)
        detailsEl.appendChild(tasksList)
    }

    // Add project
    addProjectBtn.addEventListener('click', () => {
        const name = newProjectInput.value.trim()
        if (!name) return
        const projects = load()
        projects.push({ id: createId(), name, subprojects: [], tasks: [] })
        save(projects)
        newProjectInput.value = ''
        renderProjectsList()
    })

    renderProjectsList()
}

// Inicializador de Notas (crear/editar/borrar)
function initNotas() {
    const STORAGE_KEY = 'notas-list'
    const app = document.getElementById('notas-app')
    if (!app) return

    const titleInput = app.querySelector('#new-note-title')
    const bodyInput = app.querySelector('#new-note-body')
    const addBtn = app.querySelector('#add-note-btn')
    const list = app.querySelector('#notes-list')

    function save(notes) { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)) }
    function load() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
    function createId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6) }

    function render() {
        const notes = load()
        list.innerHTML = ''
        notes.forEach((n, idx) => {
            const li = document.createElement('li')
            li.className = 'note-item'
            const h = document.createElement('h4')
            h.textContent = n.title
            const p = document.createElement('p')
            p.textContent = n.body
            const edit = document.createElement('button')
            edit.textContent = 'Editar'
            const del = document.createElement('button')
            del.textContent = 'Eliminar'

            edit.addEventListener('click', () => startEdit(li, idx))
            del.addEventListener('click', () => {
                const notes = load()
                notes.splice(idx,1)
                save(notes)
                render()
            })

            li.appendChild(h)
            li.appendChild(p)
            li.appendChild(edit)
            li.appendChild(del)
            list.appendChild(li)
        })
    }

    function startEdit(li, idx) {
        const notes = load()
        const current = notes[idx]
        li.innerHTML = ''
        const titleEdit = document.createElement('input')
        titleEdit.type = 'text'
        titleEdit.value = current.title
        const bodyEdit = document.createElement('textarea')
        bodyEdit.value = current.body
        const saveBtn = document.createElement('button')
        saveBtn.textContent = 'Guardar'
        const cancelBtn = document.createElement('button')
        cancelBtn.textContent = 'Cancelar'

        saveBtn.addEventListener('click', () => {
            const t = titleEdit.value.trim()
            if (!t) return
            current.title = t
            current.body = bodyEdit.value
            save(notes)
            render()
        })
        cancelBtn.addEventListener('click', () => render())

        li.appendChild(titleEdit)
        li.appendChild(bodyEdit)
        li.appendChild(saveBtn)
        li.appendChild(cancelBtn)
        titleEdit.focus()
    }

    addBtn.addEventListener('click', () => {
        const t = titleInput.value.trim()
        if (!t) return
        const notes = load()
        notes.push({ id: createId(), title: t, body: bodyInput.value })
        save(notes)
        titleInput.value = ''
        bodyInput.value = ''
        render()
    })

    titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click() })
    render()
}

// Inicializador de Objetivos con subtareas tipo checklist
function initObjetivos() {
    const STORAGE_KEY = 'objetivos-list'
    const app = document.getElementById('objetivos-app')
    if (!app) return

    const titleInput = app.querySelector('#new-obj-title')
    const addBtn = app.querySelector('#add-obj-btn')
    const list = app.querySelector('#objectives-list')

    function save(objs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(objs)) }
    function load() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
    function createId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6) }

    function calcProgress(obj) {
        const items = obj.items || []
        if (!items.length) return 0
        const done = items.filter(i => i.checked).length
        return Math.round((done / items.length) * 100)
    }

    function render() {
        const objs = load()
        list.innerHTML = ''
        objs.forEach((o, idx) => {
            const li = document.createElement('li')
            li.className = 'objective-item'
            const header = document.createElement('div')
            header.className = 'obj-header'
            const h = document.createElement('h4')
            h.textContent = o.title
            const perc = document.createElement('span')
            perc.textContent = `${calcProgress(o)}%`
            perc.className = 'obj-percent'
            const del = document.createElement('button')
            del.textContent = 'Eliminar'
            del.addEventListener('click', () => {
                const arr = load()
                arr.splice(idx,1)
                save(arr)
                render()
            })
            header.appendChild(h)
            header.appendChild(perc)
            header.appendChild(del)

            const itemsList = document.createElement('ul')
            itemsList.className = 'obj-items'
            o.items = o.items || []
            o.items.forEach((it, iidx) => {
                const ili = document.createElement('li')
                const chk = document.createElement('input')
                chk.type = 'checkbox'
                chk.checked = !!it.checked
                chk.addEventListener('change', () => {
                    const arr = load()
                    arr[idx].items[iidx].checked = chk.checked
                    save(arr)
                    render()
                })
                const span = document.createElement('span')
                span.textContent = it.text
                const delIt = document.createElement('button')
                delIt.textContent = 'x'
                delIt.addEventListener('click', () => {
                    const arr = load()
                    arr[idx].items.splice(iidx,1)
                    save(arr)
                    render()
                })
                ili.appendChild(chk)
                ili.appendChild(span)
                ili.appendChild(delIt)
                itemsList.appendChild(ili)
            })

            const itemAdd = document.createElement('div')
            const itemInput = document.createElement('input')
            itemInput.placeholder = 'Nueva subtarea'
            const itemBtn = document.createElement('button')
            itemBtn.textContent = 'Agregar'
            itemBtn.addEventListener('click', () => {
                const val = itemInput.value.trim()
                if (!val) return
                const arr = load()
                arr[idx].items = arr[idx].items || []
                arr[idx].items.push({ id: createId(), text: val, checked: false })
                save(arr)
                itemInput.value = ''
                render()
            })
            itemAdd.appendChild(itemInput)
            itemAdd.appendChild(itemBtn)

            li.appendChild(header)
            li.appendChild(itemsList)
            li.appendChild(itemAdd)
            list.appendChild(li)
        })
    }

    addBtn.addEventListener('click', () => {
        const t = titleInput.value.trim()
        if (!t) return
        const arr = load()
        arr.push({ id: createId(), title: t, items: [] })
        save(arr)
        titleInput.value = ''
        render()
    })

    titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click() })
    render()
}

// Render summary of objectives (name + percentage) in Dashboard
function renderObjectivesSummary() {
    const el = document.getElementById('dashboard-objectives')
    if (!el) return
    const objs = JSON.parse(localStorage.getItem('objetivos-list') || '[]')
    el.innerHTML = ''
    if (!objs.length) {
        el.innerHTML = '<li>No hay objetivos.</li>'
        return
    }
    objs.forEach(o => {
        const li = document.createElement('li')
        li.className = 'dashboard-objective'
        const name = document.createElement('span')
        name.textContent = o.title
        const items = o.items || []
        const perc = items.length ? Math.round((items.filter(i=>i.checked).length / items.length)*100) : 0
        const p = document.createElement('small')
        p.textContent = `${perc}%`
        li.appendChild(name)
        li.appendChild(p)
        el.appendChild(li)
    })
}

// Inicializador Pomodoro: cuenta regresiva vinculada a una tarea y acumula tiempo en la tarea seleccionada
function initPomodoro() {
    const app = document.getElementById('pomodoro-app')
    if (!app) return

    const minutesInput = app.querySelector('#pomodoro-minutes')
    const taskSelect = app.querySelector('#pomodoro-task-select')
    const display = app.querySelector('#pomodoro-timer-display')
    const startBtn = app.querySelector('#pomodoro-start')
    const pauseBtn = app.querySelector('#pomodoro-pause')
    const resetBtn = app.querySelector('#pomodoro-reset')
    const accumEl = app.querySelector('#pomodoro-accum')

    const TASKS_KEY = 'tareas-list'
    const PROJECTS_KEY = 'projects-list'
    const SESSIONS_KEY = 'pomodoro-sessions'

    function loadTasks() { return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]') }
    function saveTasks(t) { localStorage.setItem(TASKS_KEY, JSON.stringify(t)) }
    function loadProjects() { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') }
    function saveProjects(p) { localStorage.setItem(PROJECTS_KEY, JSON.stringify(p)) }
    function loadSessions() { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') }
    function saveSessions(s) { localStorage.setItem(SESSIONS_KEY, JSON.stringify(s)) }

    function formatTime(s) { const m = Math.floor(s/60); const sec = s%60; return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` }
    function fmtAccum(sec) { if (!sec) return '0m'; const m = Math.floor(sec/60); return `${m}m` }

    let initialSeconds = parseInt(minutesInput.value || '25', 10) * 60
    let remaining = initialSeconds
    let intervalId = null
    let running = false
    let elapsedThisSession = 0
    let lastTick = null

    function populateTasks() {
        const tasks = loadTasks()
        taskSelect.innerHTML = '<option value="">Sin tarea</option>'
        tasks.forEach(t => {
            const opt = document.createElement('option')
            opt.value = t.id
            opt.textContent = `${t.name}${t.projectId ? ' (' + (t.projectId) + ')' : ''}`
            taskSelect.appendChild(opt)
        })
        updateAccumDisplay()
    }

    function updateAccumDisplay() {
        const tid = taskSelect.value
        if (!tid) { accumEl.textContent = '0m'; return }
        const tasks = loadTasks()
        const t = tasks.find(x => x.id === tid)
        accumEl.textContent = fmtAccum(t?.focusTimeSeconds || 0)
    }

    function saveFocusToTask(taskId, seconds) {
        if (!taskId || !seconds) return
        const tasks = loadTasks()
        const t = tasks.find(x => x.id === taskId)
        if (t) { t.focusTimeSeconds = (t.focusTimeSeconds || 0) + seconds; saveTasks(tasks) }
        // also update in projects
        const projects = loadProjects()
        let changed = false
        projects.forEach(p => {
            (p.tasks || []).forEach(tt => { if (tt.id === taskId) { tt.focusTimeSeconds = (tt.focusTimeSeconds || 0) + seconds; changed = true } })
            ;(p.subprojects || []).forEach(sp => (sp.tasks || []).forEach(tt => { if (tt.id === taskId) { tt.focusTimeSeconds = (tt.focusTimeSeconds || 0) + seconds; changed = true } }))
        })
        if (changed) saveProjects(projects)
        // also persist a session record so we can build time-series (timestamp in ms)
        try {
            const sessions = loadSessions()
            sessions.push({ taskId: taskId, seconds: seconds, timestamp: Date.now() })
            saveSessions(sessions)
        } catch (e) {
            console.error('Error saving pomodoro session', e)
        }
    }

    function tick() {
        const now = Date.now()
        const delta = Math.floor((now - lastTick) / 1000)
        if (delta <= 0) return
        lastTick += delta * 1000
        remaining -= delta
        elapsedThisSession += delta
        if (remaining <= 0) {
            // finish
            clearInterval(intervalId)
            intervalId = null
            running = false
            display.textContent = '00:00'
            const tid = taskSelect.value
            saveFocusToTask(tid, elapsedThisSession)
            elapsedThisSession = 0
            updateAccumDisplay()
            return
        }
        display.textContent = formatTime(remaining)
    }

    function startTimer() {
        if (running) return
        running = true
        lastTick = Date.now()
        intervalId = setInterval(tick, 500)
    }
    function pauseTimer() {
        if (!running) return
        running = false
        clearInterval(intervalId)
        intervalId = null
        const tid = taskSelect.value
        saveFocusToTask(tid, elapsedThisSession)
        elapsedThisSession = 0
        updateAccumDisplay()
    }
    function resetTimer() {
        pauseTimer()
        initialSeconds = parseInt(minutesInput.value || '25', 10) * 60
        remaining = initialSeconds
        display.textContent = formatTime(remaining)
    }

    // events
    minutesInput.addEventListener('change', () => {
        initialSeconds = parseInt(minutesInput.value || '25', 10) * 60
        remaining = initialSeconds
        display.textContent = formatTime(remaining)
    })
    taskSelect.addEventListener('change', updateAccumDisplay)
    startBtn.addEventListener('click', startTimer)
    pauseBtn.addEventListener('click', pauseTimer)
    resetBtn.addEventListener('click', resetTimer)

    // init
    display.textContent = formatTime(initialSeconds)
    populateTasks()
    // --- Integración con controles de la nueva UI (si existen) ---
    const workMinusBtn = app.querySelector('#workMinus')
    const workPlusBtn = app.querySelector('#workPlus')
    const workValEl = app.querySelector('#workTime')
    const breakMinusBtn = app.querySelector('#breakMinus')
    const breakPlusBtn = app.querySelector('#breakPlus')
    const breakValEl = app.querySelector('#breakTime')
    const longBreakMinusBtn = app.querySelector('#longBreakMinus')
    const longBreakPlusBtn = app.querySelector('#longBreakPlus')
    const longBreakValEl = app.querySelector('#longBreakTime')

    function setWorkMinutes(v) {
        if (workValEl) workValEl.textContent = String(v)
        if (minutesInput) {
            minutesInput.value = String(v)
            const ev = new Event('change')
            minutesInput.dispatchEvent(ev)
        }
    }

    // inicializar valores visuales si están presentes
    if (workValEl) {
        const cur = parseInt(workValEl.textContent || minutesInput.value || '25', 10)
        setWorkMinutes(cur)
    }

    if (workMinusBtn) workMinusBtn.addEventListener('click', () => { const v = Math.max(1, (parseInt(workValEl.textContent,10) || 25) - 1); setWorkMinutes(v) })
    if (workPlusBtn) workPlusBtn.addEventListener('click', () => { const v = (parseInt(workValEl.textContent,10) || 25) + 1; setWorkMinutes(v) })

    // break/long break solo actualizan la UI (no cambian el temporizador por defecto)
    if (breakMinusBtn && breakValEl) breakMinusBtn.addEventListener('click', () => { const v = Math.max(1, (parseInt(breakValEl.textContent,10) || 5) - 1); breakValEl.textContent = String(v) })
    if (breakPlusBtn && breakValEl) breakPlusBtn.addEventListener('click', () => { const v = (parseInt(breakValEl.textContent,10) || 5) + 1; breakValEl.textContent = String(v) })
    if (longBreakMinusBtn && longBreakValEl) longBreakMinusBtn.addEventListener('click', () => { const v = Math.max(1, (parseInt(longBreakValEl.textContent,10) || 15) - 1); longBreakValEl.textContent = String(v) })
    if (longBreakPlusBtn && longBreakValEl) longBreakPlusBtn.addEventListener('click', () => { const v = (parseInt(longBreakValEl.textContent,10) || 15) + 1; longBreakValEl.textContent = String(v) })

}

// Estadísticas: cálculo y render
function secsToHuman(sec) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return `${h}h ${m}m`
}

function computeStats() {
    const tasks = JSON.parse(localStorage.getItem('tareas-list') || '[]')
    const projects = JSON.parse(localStorage.getItem('projects-list') || '[]')
    const totalSeconds = tasks.reduce((s, t) => s + (t.focusTimeSeconds || 0), 0)
    const tasksCompleted = tasks.filter(t => t.completed).length
    // time per project
    const perProject = {}
    tasks.forEach(t => {
        const pid = t.projectId || 'Sin proyecto'
        perProject[pid] = (perProject[pid] || 0) + (t.focusTimeSeconds || 0)
    })
    // top tasks
    const topTasks = tasks.slice().sort((a,b) => (b.focusTimeSeconds||0) - (a.focusTimeSeconds||0)).slice(0,5)
    return { totalSeconds, tasksCompleted, perProject, topTasks, projects }
}

function renderDashboardStats() {
    const elHours = document.getElementById('hours-focus-value')
    const elTasksCompleted = document.getElementById('tasks-completed-value')
    if (!elHours && !elTasksCompleted) return
    const stats = computeStats()
    if (elHours) elHours.textContent = secsToHuman(stats.totalSeconds)
    if (elTasksCompleted) elTasksCompleted.textContent = String(stats.tasksCompleted)
    try { renderPomodoroChart() } catch (e) { /* chart may not be present */ }
}

function renderStatisticsPage() {
    const totalEl = document.getElementById('stats-total-focus')
    const completedEl = document.getElementById('stats-tasks-completed')
    const topList = document.getElementById('stats-top-tasks-list')
    const byProject = document.getElementById('stats-by-project-list')
    if (!totalEl || !completedEl || !topList || !byProject) return
    const stats = computeStats()
    totalEl.textContent = secsToHuman(stats.totalSeconds)
    completedEl.textContent = String(stats.tasksCompleted)
    topList.innerHTML = ''
    stats.topTasks.forEach(t => {
        const li = document.createElement('li')
        li.textContent = `${t.name} — ${secsToHuman(t.focusTimeSeconds || 0)}`
        topList.appendChild(li)
    })
    byProject.innerHTML = ''
    // resolve project names
    Object.keys(stats.perProject).forEach(pid => {
        const seconds = stats.perProject[pid]
        const li = document.createElement('li')
        let label = pid
        if (pid !== 'Sin proyecto') {
            const p = stats.projects.find(x => x.id === pid)
            if (p) label = p.name
        }
        li.textContent = `${label} — ${secsToHuman(seconds)}`
        byProject.appendChild(li)
    })
}

// Chart: agregación de sesiones de pomodoro por día o semana
let pomodoroChart = null
function formatDateLabel(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth()+1).padStart(2,'0')
    const day = String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${day}`
}

function getPomodoroAggregation(period = 'day', units = 14) {
    const sessions = JSON.parse(localStorage.getItem('pomodoro-sessions') || '[]')
    const map = {}
    const now = new Date()
    if (period === 'day') {
        // last `units` days
        for (let i = units-1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
            const key = formatDateLabel(d)
            map[key] = 0
        }
        sessions.forEach(s => {
            const d = new Date(s.timestamp)
            const key = formatDateLabel(d)
            if (key in map) map[key] += (s.seconds || 0)
        })
        const labels = Object.keys(map)
        const data = labels.map(k => +(map[k] / 3600).toFixed(2))
        return { labels, data }
    } else {
        // week aggregation: last `units` weeks (ISO week starting Monday)
        function weekKey(d) {
            const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
            const dayNum = copy.getUTCDay() || 7
            copy.setUTCDate(copy.getUTCDate() - dayNum + 1)
            const year = copy.getUTCFullYear()
            const weekStart = formatDateLabel(new Date(Date.UTC(copy.getUTCFullYear(), copy.getUTCMonth(), copy.getUTCDate())))
            return `${year}-W-${weekStart}`
        }
        // prepare keys for last N weeks
        for (let i = units-1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i*7)
            const key = weekKey(d)
            map[key] = 0
        }
        sessions.forEach(s => {
            const d = new Date(s.timestamp)
            const key = weekKey(d)
            if (key in map) map[key] += (s.seconds || 0)
        })
        const labels = Object.keys(map)
        const data = labels.map(k => +(map[k] / 3600).toFixed(2))
        return { labels, data }
    }
}

function renderPomodoroChart() {
    const canvas = document.getElementById('pomodoroChart')
    if (!canvas) return
    const periodSel = document.getElementById('pomodoro-period')
    const period = periodSel ? periodSel.value : 'day'
    const units = period === 'day' ? 14 : 12
    const agg = getPomodoroAggregation(period, units)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // simple canvas renderer (no Chart.js) — draws axes, grid, labels and a line with area
    function drawSimpleLineChart(ctx, labels, data) {
        const dpr = window.devicePixelRatio || 1
        const width = canvas.clientWidth || canvas.width
        const height = canvas.clientHeight || canvas.height
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, width, height)

        const padding = { left: 48, right: 16, top: 24, bottom: 40 }
        const plotW = width - padding.left - padding.right
        const plotH = height - padding.top - padding.bottom

        // compute y scale
        const maxY = Math.max(1, Math.max(...data))
        const minY = 0

        // grid lines
        ctx.strokeStyle = '#e6e6e6'
        ctx.lineWidth = 1
        const yTicks = 4
        for (let i = 0; i <= yTicks; i++) {
            const y = padding.top + (plotH * i / yTicks)
            ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(padding.left + plotW, y); ctx.stroke()
        }

        // axes
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(padding.left, padding.top); ctx.lineTo(padding.left, padding.top + plotH); ctx.lineTo(padding.left + plotW, padding.top + plotH); ctx.stroke()

        // y labels
        ctx.fillStyle = '#333'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right'
        for (let i = 0; i <= yTicks; i++) {
            const v = maxY - (maxY - minY) * (i / yTicks)
            const y = padding.top + (plotH * i / yTicks)
            ctx.fillText(v.toFixed(1), padding.left - 8, y + 4)
        }

        // x labels and points
        const n = Math.max(1, labels.length)
        const stepX = plotW / Math.max(1, n - 1)
        const points = data.map((val, i) => {
            const x = padding.left + i * stepX
            const y = padding.top + plotH - ((val - minY) / (maxY - minY || 1)) * plotH
            return { x, y }
        })

        // area under curve
        ctx.beginPath()
        if (points.length) {
            ctx.moveTo(points[0].x, padding.top + plotH)
            points.forEach(p => ctx.lineTo(p.x, p.y))
            ctx.lineTo(padding.left + plotW, padding.top + plotH)
            ctx.closePath()
            const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH)
            grad.addColorStop(0, 'rgba(54,162,235,0.15)')
            grad.addColorStop(1, 'rgba(54,162,235,0)')
            ctx.fillStyle = grad
            ctx.fill()
        }

        // line
        ctx.beginPath(); ctx.strokeStyle = 'rgba(54,162,235,1)'; ctx.lineWidth = 2
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
        ctx.stroke()

        // points
        ctx.fillStyle = 'rgba(54,162,235,1)'
        points.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill() })

        // x labels
        ctx.fillStyle = '#333'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
        const labelEvery = Math.ceil(n / 8)
        labels.forEach((lab, i) => {
            if (i % labelEvery === 0 || i === labels.length - 1) {
                const x = padding.left + i * stepX
                ctx.fillText(lab, x, padding.top + plotH + 18)
            }
        })
    }

    drawSimpleLineChart(ctx, agg.labels, agg.data)

    if (periodSel) {
        periodSel.onchange = () => renderPomodoroChart()
    }
}

// Dev helper: insertar sesiones de ejemplo y renderizar (usar ?seedPomodoro=1)
function seedPomodoroSample(days = 14) {
    try {
        const key = 'pomodoro-sessions'
        const existing = JSON.parse(localStorage.getItem(key) || '[]')
        if (existing.length) return
        const now = new Date()
        const sessions = []
        for (let d = 0; d < days; d++) {
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d)
            const sessionsCount = Math.floor(Math.random() * 3) // 0..2
            for (let s = 0; s < sessionsCount; s++) {
                const secs = (15 + Math.floor(Math.random() * 36)) * 60 // 15-50 minutes
                // spread within the day
                const ts = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(Math.random()*24), Math.floor(Math.random()*60)).getTime()
                sessions.push({ taskId: 'demo', seconds: secs, timestamp: ts })
            }
        }
        localStorage.setItem(key, JSON.stringify(sessions))
        console.info('Seeded pomodoro sessions:', sessions.length)
        renderPomodoroChart()
    } catch (e) { console.error('Error seeding sessions', e) }
}

// auto-seed when requested via querystring
try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('seedPomodoro') === '1') seedPomodoroSample(14)
} catch (e) {}