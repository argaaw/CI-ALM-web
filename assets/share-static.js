(() => {
  const state = { samples: [], selectedId: null };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);

  const selectedSample = () => state.samples.find((sample) => sample.id === state.selectedId);

  function filteredSamples() {
    const task = document.querySelector("#task").value;
    const datasetId = document.querySelector("#dataset-id").value;
    const sampleType = document.querySelector("#sample-type").value;
    const query = document.querySelector("#query").value.trim().toLocaleLowerCase();
    return state.samples.filter((sample) => {
      if (task && sample.include_task !== task) return false;
      if (datasetId && sample.dataset_id !== datasetId) return false;
      if (sampleType && sample.sample_type !== sampleType) return false;
      if (!query) return true;
      return [sample.id, sample.instrument, sample.source_id]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(query));
    });
  }

  function renderDatasetOptions() {
    const task = document.querySelector("#task").value;
    const dataset = document.querySelector("#dataset-id");
    const selected = dataset.value;
    const items = [...new Map(
      state.samples
        .filter((sample) => !task || sample.include_task === task)
        .map((sample) => [sample.dataset_id, sample.dataset_name]),
    )].sort(([left], [right]) => left.localeCompare(right));
    dataset.replaceChildren(new Option("All datasets", ""));
    items.forEach(([id, name]) => dataset.add(new Option(name, id)));
    dataset.value = items.some(([id]) => id === selected) ? selected : "";
  }

  function renderList() {
    const target = document.querySelector("#sample-list");
    const samples = filteredSamples();
    if (!samples.some((sample) => sample.id === state.selectedId)) {
      state.selectedId = samples[0]?.id ?? null;
    }
    target.innerHTML = samples.length
      ? `<div class="sample-list-inner" data-sample-list>${samples.map((sample) => `
          <button class="sample-row${sample.id === state.selectedId ? " is-active" : ""}" data-sample-id="${escapeHtml(sample.id)}">
            <span class="sample-icon">♪</span><span class="sample-main"><strong>${escapeHtml(sample.instrument)}</strong><small>${escapeHtml(sample.id)} · ${escapeHtml(sample.split)}</small></span><span class="review-badge status-include">${escapeHtml(sample.include_task)}</span>
          </button>`).join("")}</div>`
      : '<div class="empty-list"><strong>No matching samples</strong><span>필터를 조정해 보세요.</span></div>';
    renderDetail();
  }

  function responsePane(sample, variant, model, index) {
    const response = sample.responses?.[variant]?.[model.id];
    return `<div class="saved-response-pane" data-alm-pane="${variant}-${model.id}" ${index ? "hidden" : ""}>${response
      ? `<div class="alm-question"><span>Question</span><p>${escapeHtml(response.prompt)}</p></div><div class="alm-answer"><span>Answer</span><p>${escapeHtml(response.response_text)}</p></div>`
      : '<div class="placeholder-result"><strong>No saved response</strong></div>'}</div>`;
  }

  function variantPane(sample, variant) {
    const models = sample.response_models || [];
    return `<div data-audio-variant-pane="${variant}" ${variant === "original" ? "" : "hidden"}>
      <p class="variant-pane-label">${variant === "original" ? "Original audio" : "CI-vocoded audio"}</p>
      <div class="alm-tabs" data-alm-tabs>${models.map((model, index) => `<button type="button" class="alm-tab${index ? "" : " is-active"}" data-alm-tab="${variant}-${model.id}" aria-selected="${index ? "false" : "true"}">${escapeHtml(model.label)}</button>`).join("")}</div>
      ${models.map((model, index) => responsePane(sample, variant, model, index)).join("")}
    </div>`;
  }


  function comparisonSourceCards(sample) {
    const sources = sample.comparison_sources || [];
    if (!sources.length) return "";
    return `<section class="comparison-sources">
      <div class="section-title"><div><p class="eyebrow">COMPARISON SOURCES</p><h3>Source metadata</h3></div><span>${escapeHtml(sample.gap_seconds)} second gap</span></div>
      ${sources.map((source) => {
        const sourceMetrics = Object.entries(source.display_metadata || {}).map(([label, value]) =>
          `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "—")}</strong></div>`,
        ).join("");
        return `<article class="comparison-source-card">
          <div class="comparison-source-heading"><strong>Audio ${escapeHtml(source.position)}</strong><span>${escapeHtml(source.id)}</span></div>
          <section class="metadata-grid"><div><span>Dataset</span><strong>${escapeHtml(source.dataset_name)}</strong></div><div><span>Instrument</span><strong>${escapeHtml(source.instrument)}</strong></div><div><span>Split</span><strong>${escapeHtml(source.split)}</strong></div><div><span>Duration</span><strong>${source.duration == null ? "—" : `${escapeHtml(source.duration.toFixed(1))} s`}</strong></div><div><span>Source</span><strong>${escapeHtml(source.source_id || "—")}</strong></div></section>
          ${sourceMetrics ? `<div class="metadata-grid stimulus-metadata-grid">${sourceMetrics}</div>` : ""}
        </article>`;
      }).join("")}
    </section>`;
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
    const ciButton = sample.audio.ci_vocoded
      ? '<button type="button" class="shared-audio-variant-tab" data-audio-variant-tab="ci_vocoded" aria-selected="false">CI-vocoded audio</button>'
      : '<button type="button" class="shared-audio-variant-tab is-unavailable" data-audio-variant-tab="ci_vocoded" aria-selected="false" disabled>CI-vocoded audio<small>Not available</small></button>';
    target.innerHTML = `<div class="detail-content" data-current-sample="${escapeHtml(sample.id)}">
      <div class="detail-header"><div><p class="eyebrow">PREVIEW</p><h2>${escapeHtml(sample.instrument)}</h2><p>${escapeHtml(sample.id)} · ${escapeHtml(sample.dataset_name)}</p></div><span class="review-badge large status-include">${escapeHtml(sample.include_task)}</span></div>
      <div class="shared-audio-variant-tabs" role="tablist"><button type="button" class="shared-audio-variant-tab is-active" data-audio-variant-tab="original" aria-selected="true">Original audio</button>${ciButton}</div>
      <section class="audio-card shared-audio-card"><audio id="main-audio" controls preload="metadata" src="${escapeHtml(sample.audio.original)}" data-original-src="${escapeHtml(sample.audio.original)}" data-ci-vocoded-src="${escapeHtml(sample.audio.ci_vocoded || "")}"></audio><div class="audio-shortcuts"><span><kbd>Space</kbd> play</span><span><kbd>J</kbd>/<kbd>K</kbd> prev/next</span></div></section>
      <section class="metadata-grid"><div><span>Dataset</span><strong>${escapeHtml(sample.dataset_id)}</strong></div><div><span>Split</span><strong>${escapeHtml(sample.split)}</strong></div><div><span>Duration</span><strong>${sample.duration == null ? "—" : `${escapeHtml(sample.duration.toFixed(1))} s`}</strong></div><div><span>Source</span><strong>${escapeHtml(sample.source_id || "—")}</strong></div></section>
      ${comparisonSourceCards(sample)}
      ${metrics ? `<section class="stimulus-metadata"><div class="section-title"><div><p class="eyebrow">STIMULUS METRICS</p><h3>Source metadata</h3></div></div><div class="metadata-grid stimulus-metadata-grid">${metrics}</div></section>` : ""}
      <div class="tag-row">${sample.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      <section class="alm-card saved-response-card" data-audio-variant-card><div class="section-title"><div><p class="eyebrow">ALM RESPONSES</p><h3>Questions &amp; Answers</h3></div></div>${variantPane(sample, "original")}${variantPane(sample, "ci_vocoded")}</section>
    </div>`;
  }

  function selectSample(id) {
    state.selectedId = id;
    renderList();
  }

  document.addEventListener("click", (event) => {
    const row = event.target.closest("[data-sample-id]");
    if (row) return selectSample(row.dataset.sampleId);
    const variantTab = event.target.closest("[data-audio-variant-tab]");
    if (variantTab && !variantTab.disabled) {
      const detail = variantTab.closest(".detail-content");
      const variant = variantTab.dataset.audioVariantTab;
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
      card.querySelectorAll("[data-alm-tab]").forEach((item) => { const active = item === tab; item.classList.toggle("is-active", active); item.setAttribute("aria-selected", String(active)); });
      card.querySelectorAll("[data-alm-pane]").forEach((pane) => { pane.hidden = pane.dataset.almPane !== tab.dataset.almTab; });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, select")) return;
    const audio = document.querySelector("#main-audio");
    if (event.code === "Space" && audio) { event.preventDefault(); audio.paused ? audio.play() : audio.pause(); return; }
    const samples = filteredSamples();
    const index = Math.max(0, samples.findIndex((sample) => sample.id === state.selectedId));
    if (["ArrowDown", "k", "K"].includes(event.key) && samples[index + 1]) { event.preventDefault(); selectSample(samples[index + 1].id); }
    if (["ArrowUp", "j", "J"].includes(event.key) && samples[index - 1]) { event.preventDefault(); selectSample(samples[index - 1].id); }
  });

  async function start() {
    const response = await fetch("data/samples.json");
    if (!response.ok) throw new Error(`Could not load shared samples: ${response.status}`);
    const payload = await response.json();
    state.samples = payload.samples;
    const task = document.querySelector("#task");
    payload.tasks.forEach((name) => task.add(new Option(name, name)));
    task.addEventListener("change", () => { renderDatasetOptions(); renderList(); });
    document.querySelector("#dataset-id").addEventListener("change", renderList);
    document.querySelector("#sample-type").addEventListener("change", renderList);
    document.querySelector("#query").addEventListener("input", renderList);
    document.querySelector("#reset-filters").addEventListener("click", () => {
      document.querySelector("#query").value = ""; task.value = ""; document.querySelector("#sample-type").value = ""; renderDatasetOptions(); renderList();
    });
    renderDatasetOptions();
    renderList();
  }

  start().catch((error) => {
    console.error(error);
    document.querySelector("#workspace").innerHTML = '<div class="empty-state"><h2>Could not load shared samples</h2></div>';
  });
})();
