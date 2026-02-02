const state = {
    token: localStorage.getItem('gh_token') || '',
    repo: localStorage.getItem('gh_repo') || '',
    issues: [],
    filter: 'open',
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
    issuesList: document.getElementById('issues-list'),
    openCount: document.getElementById('open-count'),
    closedCount: document.getElementById('closed-count'),
    filterOpen: document.getElementById('filter-open'),
    filterClosed: document.getElementById('filter-closed'),
    statusBar: document.getElementById('status-bar'),
    obsToggle: document.getElementById('obs-toggle')
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
        const url = document.getElementById('entry-url').value;
        await createIssue(title, url);
        els.addEntryForm.reset();
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
        state.obsMode = !state.obsMode;
        document.body.classList.toggle('obs-mode', state.obsMode);
        localStorage.setItem('obs_mode', state.obsMode);
    };
}

function setFilter(filter) {
    state.filter = filter;
    els.filterOpen.classList.toggle('selected', filter === 'open');
    els.filterClosed.classList.toggle('selected', filter === 'closed');
    document.getElementById('list-title').textContent = filter === 'open' ? 'Open Preparation Items' : 'Closed Preparation Items';
    renderIssues();
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

async function createIssue(title, bodyUrl) {
    showStatus('Adding entry...', 'info');
    try {
        await githubRequest('/issues', {
            method: 'POST',
            body: JSON.stringify({
                title: title,
                body: `Preparation link: ${bodyUrl}`
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
    const filtered = state.issues.filter(i => i.state === state.filter);

    if (filtered.length === 0) {
        els.issuesList.innerHTML = `
      <div class="blankslate">
        <h3 class="mb-1">No ${state.filter} items</h3>
        <p>Your preparation list is clear.</p>
      </div>
    `;
        return;
    }

    els.issuesList.innerHTML = filtered.map(issue => `
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
        <a href="${extractUrl(issue.body) || '#'}" target="_blank" class="Link--primary v-align-middle no-underline h4 js-navigation-open markdown-title">
          ${issue.title}
        </a>
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
  `).join('');
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
