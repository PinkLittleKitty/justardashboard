const state = {
    token: localStorage.getItem('gh_token') || '',
    repo: localStorage.getItem('gh_repo') || '',
    issues: [],
    filter: 'open',
    category: 'prep', // 'prep' or 'game'
    obsMode: localStorage.getItem('obs_mode') === 'true'
};

const els = {
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    settingsForm: document.getElementById('settings-form'),
    ghTokenInput: document.getElementById('gh-token'),
    ghRepoInput: document.getElementById('gh-repo'),
    addEntryForm: document.getElementById('add-entry-form'),
    formDynamicFields: document.getElementById('form-dynamic-fields'),
    formTitle: document.getElementById('form-title'),
    submitBtn: document.getElementById('submit-btn'),
    issuesList: document.getElementById('issues-list'),
    openCount: document.getElementById('open-count'),
    closedCount: document.getElementById('closed-count'),
    filterOpen: document.getElementById('filter-open'),
    filterClosed: document.getElementById('filter-closed'),
    catPrep: document.getElementById('cat-prep'),
    catGame: document.getElementById('cat-game'),
    listTitle: document.getElementById('list-title'),
    statusBar: document.getElementById('status-bar'),
    obsToggle: document.getElementById('obs-toggle'),
    exitObs: document.getElementById('exit-obs')
};

function init() {
    els.ghTokenInput.value = state.token;
    els.ghRepoInput.value = state.repo;

    if (state.obsMode) {
        document.body.classList.add('obs-mode');
    }

    if (state.token && state.repo) {
        fetchIssues();
    } else {
        showStatus('Please configure GitHub settings to start.', 'warning');
        els.settingsModal.showModal();
    }

    setupEventListeners();
}

function setupEventListeners() {
    els.settingsBtn.onclick = () => els.settingsModal.showModal();
    els.closeSettings.onclick = () => els.settingsModal.close();

    els.settingsForm.onsubmit = (e) => {
        e.preventDefault();
        state.token = els.ghTokenInput.value.trim();
        state.repo = els.ghRepoInput.value.trim();
        localStorage.setItem('gh_token', state.token);
        localStorage.setItem('gh_repo', state.repo);
        els.settingsModal.close();
        fetchIssues();
    };

    els.addEntryForm.onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('entry-title').value;
        let body = '';
        if (state.category === 'prep') {
            const url = document.getElementById('entry-url').value;
            body = `Preparation link: ${url}`;
        } else {
            body = document.getElementById('entry-desc').value;
        }
        await createIssue(title, body);
        els.addEntryForm.reset();
    };

    els.catPrep.onclick = (e) => {
        e.preventDefault();
        setCategory('prep');
    };

    els.catGame.onclick = (e) => {
        e.preventDefault();
        setCategory('game');
    };

    els.filterOpen.onclick = (e) => {
        e.preventDefault();
        setFilter('open');
    };

    els.filterClosed.onclick = (e) => {
        e.preventDefault();
        setFilter('closed');
    };

    els.obsToggle.onclick = (e) => {
        e.preventDefault();
        toggleObsMode();
    };

    els.exitObs.onclick = (e) => {
        e.preventDefault();
        toggleObsMode();
    };
}

function toggleObsMode() {
    state.obsMode = !state.obsMode;
    document.body.classList.toggle('obs-mode', state.obsMode);
    localStorage.setItem('obs_mode', state.obsMode);
}

function setFilter(filter) {
    state.filter = filter;
    els.filterOpen.classList.toggle('selected', filter === 'open');
    els.filterClosed.classList.toggle('selected', filter === 'closed');
    updateListTitle();
    renderIssues();
}

function setCategory(category) {
    state.category = category;
    els.catPrep.classList.toggle('selected', category === 'prep');
    els.catGame.classList.toggle('selected', category === 'game');
    updateFormFields();
    updateListTitle();
    renderIssues();
}

function updateListTitle() {
    const stateText = state.filter === 'open' ? 'Open' : 'Closed';
    const categoryText = state.category === 'prep' ? 'Preparation Items' : 'Free Games';
    els.listTitle.textContent = `${stateText} ${categoryText}`;
}

function updateFormFields() {
    if (state.category === 'prep') {
        els.formTitle.textContent = 'Quick Add: Preparation';
        els.submitBtn.textContent = 'Add to preparation';
        els.formDynamicFields.innerHTML = `
            <div class="form-group">
                <div class="form-group-header">
                    <label for="entry-url">URL</label>
                </div>
                <div class="form-group-body">
                    <input class="form-control input-block" type="url" id="entry-url" placeholder="https://..." required />
                </div>
            </div>
        `;
    } else {
        els.formTitle.textContent = 'Quick Add: Free Game';
        els.submitBtn.textContent = 'Add Free Game';
        els.formDynamicFields.innerHTML = `
            <div class="form-group">
                <div class="form-group-header">
                    <label for="entry-desc">Description</label>
                </div>
                <div class="form-group-body">
                    <textarea class="form-control input-block" id="entry-desc" placeholder="Game details..." required></textarea>
                </div>
            </div>
        `;
    }
}

async function githubRequest(path, options = {}) {
    const url = `https://api.github.com/repos/${state.repo}${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `token ${state.token}`,
            'Accept': 'application/vnd.github.v3+json',
            ...options.headers
        }
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'GitHub API Error');
    }

    return response.json();
}

async function fetchIssues() {
    if (!state.token || !state.repo) return;

    showStatus('Loading issues...', 'info');
    try {
        const [openIssues, closedIssues] = await Promise.all([
            githubRequest('/issues?state=open&per_page=100'),
            githubRequest('/issues?state=closed&per_page=100')
        ]);

        state.issues = [...openIssues, ...closedIssues].filter(i => !i.pull_request);

        els.openCount.textContent = openIssues.filter(i => !i.pull_request).length;
        els.closedCount.textContent = closedIssues.filter(i => !i.pull_request).length;

        renderIssues();
        hideStatus();
    } catch (err) {
        showStatus(`Error: ${err.message}`, 'error');
    }
}

async function createIssue(title, body) {
    showStatus('Adding entry...', 'info');
    try {
        const labels = state.category === 'prep' ? ['type:prep'] : ['type:free-game'];
        await githubRequest('/issues', {
            method: 'POST',
            body: JSON.stringify({
                title: title,
                body: body,
                labels: labels
            })
        });
        await fetchIssues();
        showStatus('Entry added!', 'success');
        setTimeout(hideStatus, 3000);
    } catch (err) {
        showStatus(`Error adding: ${err.message}`, 'error');
    }
}

async function closeIssue(issueNumber) {
    showStatus('Closing item...', 'info');
    try {
        await githubRequest(`/issues/${issueNumber}`, {
            method: 'PATCH',
            body: JSON.stringify({ state: 'closed' })
        });
        await fetchIssues();
        hideStatus();
    } catch (err) {
        showStatus(`Error closing: ${err.message}`, 'error');
    }
}

function renderIssues() {
    const targetLabel = state.category === 'prep' ? 'type:prep' : 'type:free-game';
    const filtered = state.issues.filter(i => {
        const hasCorrectState = i.state === state.filter;
        const hasCorrectLabel = i.labels.some(l => l.name === targetLabel);
        if (state.category === 'prep' && !i.labels.some(l => l.name.startsWith('type:'))) {
            return hasCorrectState;
        }
        return hasCorrectState && hasCorrectLabel;
    });

    if (filtered.length === 0) {
        els.issuesList.innerHTML = `
      <div class="blankslate">
        <h3 class="mb-1">No ${state.filter} ${state.category === 'prep' ? 'preparation items' : 'free games'}</h3>
        <p>Your list is clear.</p>
      </div>
    `;
        return;
    }

    els.issuesList.innerHTML = filtered.map(issue => {
        const url = extractUrl(issue.body);
        const labelsHtml = issue.labels.map(l => {
            const labelClass = l.name === 'type:prep' ? 'Label--prep' : (l.name === 'type:free-game' ? 'Label--game' : '');
            return `<span class="Label ${labelClass} mr-1">${l.name.replace('type:', '')}</span>`;
        }).join('');

        return `
    <div class="Box-row d-flex flex-items-center">
      <div class="mr-2">
        <svg class="octicon octicon-issue-opened color-fg-success" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true" style="fill: ${issue.state === 'open' ? '#3fb950' : '#8250df'}">
          ${issue.state === 'open'
                ? '<path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>'
                : '<path d="M11.28 3.97a.75.75 0 0 0-1.06-1.06L7.25 5.89 5.78 4.42a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z"></path><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"></path>'
            }
        </svg>
      </div>
      <div class="flex-auto">
        <div class="d-flex flex-items-center mb-1">
            ${labelsHtml}
            <a href="${url || '#'}" ${url ? 'target="_blank"' : ''} class="Link--primary v-align-middle no-underline h4 js-navigation-open markdown-title">
                ${issue.title}
            </a>
        </div>
        ${state.category === 'game' ? `<div class="issue-body-preview">${issue.body}</div>` : ''}
        <div class="text-small text-muted">
          #${issue.number} opened by ${issue.user.login}
        </div>
      </div>
      <div>
        ${issue.state === 'open'
                ? `<button class="btn btn-sm" onclick="window.closeIssue(${issue.number})">Close</button>`
                : ''
            }
      </div>
    </div>
  `;
    }).join('');
}

function extractUrl(body) {
    const match = body.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
}

function showStatus(msg, type) {
    els.statusBar.innerHTML = `<div class="Box-body py-2 px-3 text-small">${msg}</div>`;
    els.statusBar.className = `Box mb-3 banner-${type}`;
    els.statusBar.classList.remove('d-none');
}

function hideStatus() {
    els.statusBar.classList.add('d-none');
}

window.closeIssue = closeIssue;

init();
