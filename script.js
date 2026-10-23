const form = document.getElementById("taskForm");
const input = document.getElementById("taskInput");
const categoryInput = document.getElementById("taskCategory");
const priorityInput = document.getElementById("taskPriority");
const dueDateInput = document.getElementById("taskDueDate");

const list = document.getElementById("taskList");
const filter = document.getElementById("taskFilter");
const categoryFilter = document.getElementById("categoryFilter");
const priorityFilter = document.getElementById("priorityFilter");
const sortSelect = document.getElementById("sortTasks");
const searchInput = document.getElementById("taskSearch");

const submitButton = document.getElementById("submitTaskBtn");
const cancelButton = document.getElementById("cancelEditBtn");
const themeToggle = document.getElementById("themeToggle");

const STORAGE_KEY = "taskflow-tasks";
const SETTINGS_KEY = "taskflow-settings";

const priorities = { High: 3, Medium: 2, Low: 1 };
const validCategories = ["Work", "Personal", "Study", "Other"];
const validPriorities = ["High", "Medium", "Low"];

let tasks = loadTasks();
let editingId = null;
let draggedId = null;

function makeId() {
  if (typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadTasks() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    if (!Array.isArray(data)) return [];

    return data
      .filter(task =>
        task &&
        typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.completed === "boolean"
      )
      .map((task, index) => ({
        id: task.id,
        title: task.title,
        completed: task.completed,
        category: validCategories.includes(task.category)
          ? task.category
          : "Study",
        priority: validPriorities.includes(task.priority)
          ? task.priority
          : "Medium",
        dueDate: typeof task.dueDate === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)
          ? task.dueDate
          : "",
        createdAt: typeof task.createdAt === "string"
          ? task.createdAt
          : new Date().toISOString(),
        order: Number.isFinite(task.order) ? task.order : index
      }))
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch {
    alert("Unable to save tasks. Please check your browser storage.");
    return false;
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) return "No due date";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function isOverdue(task) {
  return Boolean(
    task.dueDate &&
    task.dueDate < localDateString() &&
    !task.completed
  );
}

function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const pending = total - completed;
  const overdue = tasks.filter(isOverdue).length;
  const percentage = total === 0 ? 0 : Math.round(completed / total * 100);

  document.getElementById("totalCount").textContent = total;
  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("completedCount").textContent = completed;
  document.getElementById("overdueCount").textContent = overdue;

  document.getElementById("progressPercent").textContent = `${percentage}%`;

  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `${percentage}%`;

  const progressTrack = document.getElementById("progressTrack");
  progressTrack.setAttribute("aria-valuenow", percentage);

  const message = document.getElementById("progressMessage");

  if (total === 0) {
    message.textContent = "Your progress starts with one task.";
  } else if (percentage === 100) {
    message.textContent = "Amazing! You've completed every task.";
  } else if (percentage >= 60) {
    message.textContent = "Great progress! Keep it going.";
  } else if (percentage > 0) {
    message.textContent = "Good start. Every task counts.";
  } else {
    message.textContent = "Choose a task and get started.";
  }
}

function getVisibleTasks() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedPriority = priorityFilter.value;

  const result = tasks.filter(task => {
    const matchesStatus =
      filter.value === "all" ||
      (filter.value === "pending" && !task.completed) ||
      (filter.value === "completed" && task.completed);

    const matchesCategory =
      selectedCategory === "all" ||
      task.category === selectedCategory;

    const matchesPriority =
      selectedPriority === "all" ||
      task.priority === selectedPriority;

    const matchesSearch =
      task.title.toLowerCase().includes(query) ||
      task.category.toLowerCase().includes(query) ||
      task.priority.toLowerCase().includes(query);

    return matchesStatus &&
      matchesCategory &&
      matchesPriority &&
      matchesSearch;
  });

  const sortMode = sortSelect.value;

  if (sortMode === "priority") {
    result.sort((a, b) =>
      priorities[b.priority] - priorities[a.priority] ||
      a.order - b.order
    );
  } else if (sortMode === "dueDate") {
    result.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return a.order - b.order;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate) || a.order - b.order;
    });
  } else if (sortMode === "newest") {
    result.sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  } else if (sortMode === "oldest") {
    result.sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  } else if (sortMode === "alphabetical") {
    result.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    result.sort((a, b) => a.order - b.order);
  }

  return result;
}

function renderTasks() {
  updateStats();

  const visibleTasks = getVisibleTasks();

  document.getElementById("visibleCount").textContent =
    `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;

  list.setAttribute("aria-busy", "true");

  if (visibleTasks.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <span class="empty-icon" aria-hidden="true">✓</span>
        <h3>No tasks found</h3>
        <p>Try changing your filters or adding a task.</p>
      </div>
    `;
    list.setAttribute("aria-busy", "false");
    return;
  }

  list.innerHTML = visibleTasks.map(task => {
    const overdue = isOverdue(task);

    return `
      <article class="task-item ${task.completed ? "completed" : ""} ${overdue ? "overdue" : ""}"
        data-task-id="${escapeHTML(task.id)}"
        draggable="${sortSelect.value === "manual"}">

        <button class="drag-handle" type="button"
          aria-label="Drag handle for ${escapeHTML(task.title)}"
          title="Drag to reorder">⠿</button>

        <label class="check-wrap">
          <input
            class="task-check"
            type="checkbox"
            data-action="toggle"
            data-id="${escapeHTML(task.id)}"
            aria-label="Complete ${escapeHTML(task.title)}"
            ${task.completed ? "checked" : ""}
          >
          <span class="custom-check" aria-hidden="true"></span>
        </label>

        <div class="task-content">
          <h3>${escapeHTML(task.title)}</h3>

          <div class="task-meta">
            <span class="category-badge category-${task.category.toLowerCase()}">
              ${escapeHTML(task.category)}
            </span>

            <span class="priority-badge priority-${task.priority.toLowerCase()}">
              ${escapeHTML(task.priority)} priority
            </span>

            <span class="due-date ${overdue ? "overdue-label" : ""}">
              ${overdue ? "⚠ Overdue · " : "📅 "}
              ${escapeHTML(formatDate(task.dueDate))}
            </span>
          </div>

          <p class="task-status">
            ${task.completed ? "Completed ✓" : "In progress"}
          </p>
        </div>

        <div class="task-actions">
          <button type="button" class="edit-btn"
            data-action="edit" data-id="${escapeHTML(task.id)}">Edit</button>

          <button type="button" class="delete-btn"
            data-action="delete" data-id="${escapeHTML(task.id)}">Delete</button>
        </div>
      </article>
    `;
  }).join("");

  list.setAttribute("aria-busy", "false");
}

function resetForm() {
  form.reset();
  editingId = null;

  categoryInput.value = "Study";
  priorityInput.value = "Medium";

  document.getElementById("formHeading").textContent = "Create a task";
  submitButton.textContent = "+ Add Task";
  cancelButton.hidden = true;
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const title = input.value.trim();

  if (!title) {
    input.focus();
    return;
  }

  const category = categoryInput.value;
  const priority = priorityInput.value;
  const dueDate = dueDateInput.value;

  if (!validCategories.includes(category) ||
      !validPriorities.includes(priority)) {
    alert("Please select a valid category and priority.");
    return;
  }

  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    alert("Please choose a valid due date.");
    return;
  }

  const previousTasks = tasks.map(task => ({ ...task }));

  if (editingId) {
    tasks = tasks.map(task =>
      task.id === editingId
        ? { ...task, title, category, priority, dueDate }
        : task
    );
  } else {
    const nextOrder = tasks.length
      ? Math.max(...tasks.map(task => task.order)) + 1
      : 0;

    tasks.unshift({
      id: makeId(),
      title,
      category,
      priority,
      dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
      order: nextOrder
    });
  }

  if (!saveTasks()) {
    tasks = previousTasks;
    return;
  }

  resetForm();
  filter.value = "all";
  categoryFilter.value = "all";
  priorityFilter.value = "all";
  sortSelect.value = "manual";
  searchInput.value = "";

  renderTasks();
  input.focus();
});

list.addEventListener("change", event => {
  const checkbox = event.target.closest('[data-action="toggle"]');
  if (!checkbox) return;

  const previousTasks = tasks.map(task => ({ ...task }));

  tasks = tasks.map(task =>
    task.id === checkbox.dataset.id
      ? { ...task, completed: checkbox.checked }
      : task
  );

  if (!saveTasks()) {
    tasks = previousTasks;
    renderTasks();
    return;
  }

  renderTasks();

    if (checkbox.checked) {
    const completedCard = list.querySelector(
        `[data-task-id="${CSS.escape(checkbox.dataset.id)}"]`
    );

    if (completedCard) {
        completedCard.classList.add("just-completed");
    }
    }
});

list.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const task = tasks.find(item => item.id === button.dataset.id);
  if (!task) return;

  if (button.dataset.action === "edit") {
    editingId = task.id;

    input.value = task.title;
    categoryInput.value = task.category;
    priorityInput.value = task.priority;
    dueDateInput.value = task.dueDate;

    document.getElementById("formHeading").textContent = "Edit your task";
    submitButton.textContent = "Save Changes";
    cancelButton.hidden = false;

    input.focus();

    form.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    return;
  }

  if (button.dataset.action === "delete") {
    if (!confirm(`Delete "${task.title}"?`)) return;

    const previousTasks = tasks.map(item => ({ ...item }));
    tasks = tasks.filter(item => item.id !== task.id);

    if (!saveTasks()) {
      tasks = previousTasks;
      return;
    }

    if (editingId === task.id) resetForm();

    renderTasks();
  }
});

cancelButton.addEventListener("click", resetForm);

filter.addEventListener("change", renderTasks);
categoryFilter.addEventListener("change", renderTasks);
priorityFilter.addEventListener("change", renderTasks);
sortSelect.addEventListener("change", renderTasks);
searchInput.addEventListener("input", renderTasks);

// Drag-and-drop ordering is enabled in Custom order mode.
list.addEventListener("dragstart", event => {
  const card = event.target.closest(".task-item");

  if (!card || sortSelect.value !== "manual") {
    event.preventDefault();
    return;
  }

  draggedId = card.dataset.taskId;
  card.classList.add("dragging");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedId);
  }
});

list.addEventListener("dragover", event => {
  if (!draggedId || sortSelect.value !== "manual") return;

  const target = event.target.closest(".task-item");
  if (!target || target.dataset.taskId === draggedId) return;

  event.preventDefault();

  const rect = target.getBoundingClientRect();
  const insertAfter = event.clientY > rect.top + rect.height / 2;


  const draggedCard = list.querySelector(
    `[data-task-id="${CSS.escape(draggedId)}"]`
  );

  if (!draggedCard) return;

  target.parentNode.insertBefore(
    draggedCard,
    insertAfter ? target.nextSibling : target
  );
});

list.addEventListener("drop", event => {
  if (!draggedId) return;

  event.preventDefault();

  const visibleCards = [...list.querySelectorAll(".task-item")];
  const visibleIds = visibleCards.map(card => card.dataset.taskId);
  const visibleSet = new Set(visibleIds);

  const orderedVisibleTasks = visibleIds
    .map(id => tasks.find(task => task.id === id))
    .filter(Boolean);

  let index = 0;

  tasks = tasks.map(task =>
    visibleSet.has(task.id)
      ? { ...orderedVisibleTasks[index++], order: 0 }
      : task
  );

  tasks.forEach((task, i) => {
    task.order = i;
  });

  saveTasks();
  draggedId = null;
  renderTasks();
});

list.addEventListener("dragend", event => {
  const card = event.target.closest(".task-item");
  if (card) card.classList.remove("dragging");

  draggedId = null;
});

// Persist the selected light/dark theme.
function applyTheme(theme) {
  const dark = theme === "dark";

  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.getElementById("themeIcon").textContent = dark ? "☀" : "☾";
  document.getElementById("themeLabel").textContent =
    dark ? "Light mode" : "Dark mode";

  themeToggle.setAttribute(
    "aria-label",
    dark ? "Switch to light mode" : "Switch to dark mode"
  );

  document.querySelector('meta[name="theme-color"]').content =
    dark ? "#111827" : "#f5f7fb";
}

function loadTheme() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return settings.theme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme }));
  } catch {
    // Theme still works for this page even if storage is unavailable.
  }
}

themeToggle.addEventListener("click", () => {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";

  applyTheme(nextTheme);
  saveTheme(nextTheme);
});

applyTheme(loadTheme());

document.getElementById("todayDate").textContent =
  new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });

renderTasks();