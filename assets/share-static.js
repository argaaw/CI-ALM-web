(() => {
  const state = {
    tasks: [],
    selectedTask: null,
    selectedSampleByTask: new Map(),
    sampleListScrollTopByTask: new Map(),
    preferredAudioVariant: "original",
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);

  const QUESTION_PRIORITIES = {
    original: "Proportion: NH",
    ci_vocoded: "Proportion: CI",
  };

  function orderedQuestions(questions, variant) {
    const prioritizedName = QUESTION_PRIORITIES[variant];
    return [
      ...questions.filter((question) => question.name === prioritizedName),
      ...questions.filter((question) => question.name !== prioritizedName),
    ];
  }

  const currentTask = () => state.tasks.find((task) => task.id === state.selectedTask) || null;

  const selectedSample = () => {
    const task = currentTask();
    const selectedId = state.selectedSampleByTask.get(task?.id);
    return task?.samples.find((sample) => sample.id === selectedId) ?? task?.samples[0] ?? null;
  };

  function renderTasks() {
    document.querySelector("[data-task-list]").innerHTML = state.tasks.map((task) => `
      <button type="button" class="shared-task-toggle${task.id === state.selectedTask ? " is-active" : ""}" data-task="${escapeHtml(task.id)}" aria-pressed="${task.id === state.selectedTask}">
        <strong>${escapeHtml(task.id)}</strong><small>${task.samples.length} samples</small>
      </button>`).join("");
  }

  function renderList() {
    const target = document.querySelector("#sample-list");
    const task = currentTask();
    const samples = task?.samples || [];
    if (task && !samples.some((sample) => sample.id === state.selectedSampleByTask.get(task.id))) {
      state.selectedSampleByTask.set(task.id, samples[0]?.id ?? null);
    }
    target.innerHTML = samples.length
      ? samples.map((sample, index) => `
          <button class="sample-row${sample.id === state.selectedSampleByTask.get(task?.id) ? " is-active" : ""}" data-sample-id="${escapeHtml(sample.id)}">
            <span class="sample-icon">♪</span><span class="sample-main"><strong>${index + 1}</strong></span>
          </button>`).join("")
      : '<div class="empty-list"><strong>No included single-audio samples</strong></div>';
    target.scrollTop = state.sampleListScrollTopByTask.get(task?.id) || 0;
    renderDetail();
  }

  function responsePane(sample, variant, question, model, index) {
    const response = sample.responses?.[variant]?.[String(question.id)]?.[model.id];
    return `<div class="saved-response-pane" data-alm-pane="${variant}-${question.id}-${model.id}" ${index ? "hidden" : ""}>${response
      ? `<div class="alm-answer"><span>Answer</span><p>${escapeHtml(response.response_text)}</p></div>`
      : '<div class="placeholder-result"><strong>No saved response</strong></div>'}</div>`;
  }

  function questionPane(sample, variant, question, index) {
    const models = sample.response_models || [];
    return `<article class="alm-question-group" data-static-question-panel="${variant}" data-question-id="${question.id}" ${index ? "hidden" : ""}>
      <div class="alm-question-heading"><span>${escapeHtml(question.name)}</span></div>
      <p class="alm-question-text">${escapeHtml(question.question_text)}</p>
      <div class="alm-tabs" data-alm-tabs>${models.map((model, modelIndex) => `<button type="button" class="alm-tab${modelIndex ? "" : " is-active"}" data-alm-tab="${variant}-${question.id}-${model.id}" aria-selected="${modelIndex ? "false" : "true"}">${escapeHtml(model.label)}</button>`).join("")}</div>
      ${models.map((model, modelIndex) => responsePane(sample, variant, question, model, modelIndex)).join("")}
    </article>`;
  }

  function expectedHumanResponsePane(sample, variant) {
    const response = sample.human_responses_expected?.[variant];
    return response
      ? `<div class="saved-response-pane expected-human-response"><div class="alm-answer"><span>Human response (expected)</span><p>${escapeHtml(response)}</p></div></div>`
      : "";
  }

  function variantPane(sample, variant, selectedVariant) {
    const questions = orderedQuestions(sample.response_questions || [], variant);
    return `<div data-audio-variant-pane="${variant}" ${variant === selectedVariant ? "" : "hidden"}>
      <p class="variant-pane-label">${variant === "original" ? "Original audio" : "CI-vocoded audio"}</p>
      ${expectedHumanResponsePane(sample, variant)}
      ${questions.length ? `<label>Question type<select data-static-question-selector data-question-scope="${variant}">${questions.map((question) => `<option value="${question.id}">${escapeHtml(question.name)}</option>`).join("")}</select></label>${questions.map((question, index) => questionPane(sample, variant, question, index)).join("")}` : '<div class="placeholder-result"><strong>No questions registered</strong></div>'}
    </div>`;
  }


  function renderDetail() {
    const target = document.querySelector("#workspace");
    const sample = selectedSample();
    if (!sample) {
      target.innerHTML = '<div class="empty-state"><h2>No included samples</h2></div>';
      return;
    }
    const metrics = Object.entries(sample.display_metadata || {}).map(([label, value]) =>
      `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`,
    ).join("");
    const audioVariant = state.preferredAudioVariant === "ci_vocoded" && sample.audio.ci_vocoded
      ? "ci_vocoded"
      : "original";
    const ciButton = sample.audio.ci_vocoded
      ? `<button type="button" class="shared-audio-variant-tab${audioVariant === "ci_vocoded" ? " is-active" : ""}" data-audio-variant-tab="ci_vocoded" aria-selected="${audioVariant === "ci_vocoded"}">CI-vocoded audio</button>`
      : '<button type="button" class="shared-audio-variant-tab is-unavailable" data-audio-variant-tab="ci_vocoded" aria-selected="false" disabled>CI-vocoded audio<small>Not available</small></button>';
    const number = (currentTask()?.samples.indexOf(sample) ?? -1) + 1;
    target.innerHTML = `<div class="detail-content" data-current-sample="${escapeHtml(sample.id)}">
      <div class="detail-header"><div><p class="eyebrow">PREVIEW</p><h2>${number}</h2><p>${escapeHtml(sample.instrument)} · ${escapeHtml(sample.id)} · ${escapeHtml(sample.dataset_name)}</p></div><span class="review-badge large status-include">${escapeHtml(sample.include_task)}</span></div>
      <div class="shared-audio-variant-tabs" role="tablist"><button type="button" class="shared-audio-variant-tab${audioVariant === "original" ? " is-active" : ""}" data-audio-variant-tab="original" aria-selected="${audioVariant === "original"}">Original audio</button>${ciButton}</div>
      <section class="audio-card shared-audio-card"><audio id="main-audio" controls preload="metadata" src="${escapeHtml(sample.audio[audioVariant])}" data-original-src="${escapeHtml(sample.audio.original)}" data-ci-vocoded-src="${escapeHtml(sample.audio.ci_vocoded || "")}"></audio><div class="audio-shortcuts"><span><kbd>Space</kbd> play</span><span><kbd>J</kbd>/<kbd>K</kbd> prev/next</span></div></section>
      <section class="metadata-grid"><div><span>Dataset</span><strong>${escapeHtml(sample.dataset_id)}</strong></div><div><span>Split</span><strong>${escapeHtml(sample.split)}</strong></div><div><span>Duration</span><strong>${sample.duration == null ? "—" : `${escapeHtml(sample.duration.toFixed(1))} s`}</strong></div><div><span>Source</span><strong>${escapeHtml(sample.source_id || "—")}</strong></div></section>
      ${metrics ? `<section class="stimulus-metadata"><div class="section-title"><div><p class="eyebrow">STIMULUS METRICS</p><h3>Source metadata</h3></div></div><div class="metadata-grid stimulus-metadata-grid">${metrics}</div></section>` : ""}
      <div class="tag-row">${sample.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      <section class="alm-card saved-response-card" data-audio-variant-card><div class="section-title"><div><p class="eyebrow">ALM RESPONSES</p><h3>Questions &amp; Answers</h3></div></div>${variantPane(sample, "original", audioVariant)}${variantPane(sample, "ci_vocoded", audioVariant)}</section>
    </div>`;
  }

  function selectSample(id) {
    const list = document.querySelector("#sample-list");
    if (list) state.sampleListScrollTopByTask.set(state.selectedTask, list.scrollTop);
    state.selectedSampleByTask.set(state.selectedTask, id);
    renderList();
  }

  function selectTask(id) {
    const previousTask = currentTask();
    const list = document.querySelector("#sample-list");
    if (previousTask && list) state.sampleListScrollTopByTask.set(previousTask.id, list.scrollTop);
    state.selectedTask = id;
    const task = currentTask();
    if (task?.samples.length && !state.selectedSampleByTask.has(task.id)) {
      state.selectedSampleByTask.set(task.id, task.samples[0].id);
    }
    if (task && !state.sampleListScrollTopByTask.has(task.id)) {
      state.sampleListScrollTopByTask.set(task.id, 0);
    }
    renderTasks();
    renderList();
  }

  document.addEventListener("click", (event) => {
    const task = event.target.closest("[data-task]");
    if (task) return selectTask(task.dataset.task);
    const row = event.target.closest("[data-sample-id]");
    if (row) return selectSample(row.dataset.sampleId);
    const variantTab = event.target.closest("[data-audio-variant-tab]");
    if (variantTab && !variantTab.disabled) {
      const detail = variantTab.closest(".detail-content");
      const variant = variantTab.dataset.audioVariantTab;
      state.preferredAudioVariant = variant;
      detail.querySelectorAll("[data-audio-variant-tab]").forEach((item) => {
        const active = item === variantTab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });
      detail.querySelectorAll("[data-audio-variant-pane]").forEach((pane) => { pane.hidden = pane.dataset.audioVariantPane !== variant; });
      const audio = detail.querySelector("#main-audio");
      const source = audio.dataset[variant === "original" ? "originalSrc" : "ciVocodedSrc"];
      if (source && audio.getAttribute("src") !== source) { audio.pause(); audio.setAttribute("src", source); audio.load(); }
      return;
    }
    const tab = event.target.closest("[data-alm-tab]");
    if (tab) {
      const card = tab.closest(".saved-response-card");
      const group = tab.closest(".alm-question-group") || card;
      group.querySelectorAll("[data-alm-tab]").forEach((item) => { const active = item === tab; item.classList.toggle("is-active", active); item.setAttribute("aria-selected", String(active)); });
      group.querySelectorAll("[data-alm-pane]").forEach((pane) => { pane.hidden = pane.dataset.almPane !== tab.dataset.almTab; });
    }
  });

  document.addEventListener("change", (event) => {
    const selector = event.target.closest("[data-static-question-selector]");
    if (!selector) return;
    const detail = selector.closest(".detail-content");
    const scope = selector.dataset.questionScope;
    if (!detail || !scope) return;
    detail.querySelectorAll(`[data-static-question-panel="${scope}"]`).forEach((panel) => {
      panel.hidden = panel.dataset.questionId !== selector.value;
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, select")) return;
    const audio = document.querySelector("#main-audio");
    if (event.code === "Space" && audio) { event.preventDefault(); audio.paused ? audio.play() : audio.pause(); return; }
    const samples = currentTask()?.samples || [];
    const index = Math.max(0, samples.findIndex((sample) => sample.id === selectedSample()?.id));
    if (["ArrowDown", "k", "K"].includes(event.key) && samples[index + 1]) { event.preventDefault(); selectSample(samples[index + 1].id); }
    if (["ArrowUp", "j", "J"].includes(event.key) && samples[index - 1]) { event.preventDefault(); selectSample(samples[index - 1].id); }
  });

  async function start() {
    const response = await fetch(
      `data/samples.json?v=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(`Could not load shared samples: ${response.status}`);
    const payload = await response.json();
    state.tasks = payload.tasks;
    state.selectedTask = state.tasks[0]?.id || null;
    state.tasks.forEach((task) => {
      if (task.samples[0]) state.selectedSampleByTask.set(task.id, task.samples[0].id);
    });
    renderTasks();
    renderList();
  }

  start().catch((error) => {
    console.error(error);
    document.querySelector("#workspace").innerHTML = '<div class="empty-state"><h2>Could not load shared samples</h2></div>';
  });
})();
