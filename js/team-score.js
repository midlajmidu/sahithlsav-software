// js/team-score.js — SSF Team Standings Public Page
// Fetches live data from Supabase. Zero hardcoded data.

let currentUpdateId = null;
let allPublishedUpdates = [];

// Pagination for updates pills
const UPDATE_PAGE_SIZE = 12;
let currentUpdatePage = 1;


document.addEventListener('DOMContentLoaded', init);

async function init() {
    showLoading();
    try {
        // 1. Fetch ALL published updates (for the Previous Updates pills)
        const { data: updates, error: updErr } = await supabaseClient
            .from('score_updates')
            .select('*')
            .eq('published', true)
            .order('created_at', { ascending: false });

        if (updErr) throw updErr;

        allPublishedUpdates = updates || [];

        if (allPublishedUpdates.length === 0) {
            showEmpty('No standings have been published yet.');
            renderPreviousUpdates([]);
            return;
        }

        // 2. Select the latest published update
        const latestUpdate = allPublishedUpdates[0];
        currentUpdateId = latestUpdate.id;

        // 3. Load and display standings for the latest update
        await loadStandings(latestUpdate);

        // 4. Render the previous-updates pills
        renderPreviousUpdates(allPublishedUpdates);

    } catch (err) {
        console.error('Error loading standings:', err);
        showEmpty('Failed to load standings. Please try again.');
    }
}

/**
 * Fetch score_details for a given update and render team cards
 */
async function loadStandings(update) {
    showLoading();
    currentUpdateId = update.id;

    try {
        const { data: teams, error } = await supabaseClient
            .from('score_details')
            .select('*')
            .eq('update_id', update.id)
            .order('points', { ascending: false });

        if (error) throw error;

        if (!teams || teams.length === 0) {
            showEmpty('No team scores available for this update.');
            renderUpdateInfo(update);
            highlightActivePill(update.id);
            return;
        }

        // Sort by points descending (already sorted from query, but enforce)
        teams.sort((a, b) => b.points - a.points);

        // Calculate average points to use as a dynamic baseline
        const totalPoints = teams.reduce((sum, t) => sum + (t.points || 0), 0);
        const avgPoints = teams.length > 0 ? (totalPoints / teams.length) : 1;
        
        // We use (average * 2) as the "full bar" reference.
        // This ensures that if everyone is equal, bars are 50% full.
        // If a team is double the average, they hit 100%.
        const maxDisplayPoints = Math.max(avgPoints * 2, 1);

        // Render
        renderUpdateInfo(update);
        renderTeamCards(teams, maxDisplayPoints);
        highlightActivePill(update.id);

    } catch (err) {
        console.error('Error loading team scores:', err);
        showEmpty('Error loading team scores.');
    }
}

/**
 * Render the current update info strip
 */
function renderUpdateInfo(update) {
    const container = document.getElementById('updateInfo');
    if (!container) return;

    const date = new Date(update.created_at);
    const formattedDate = date.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit'
    });

    container.innerHTML = `
        <div class="update-title">📊 ${escapeHTML(update.title)}</div>
        <div class="update-meta">
            ${update.results_count ? `After ${update.results_count} Results · ` : ''}${formattedDate} ${formattedTime}
        </div>
    `;
    container.style.display = 'flex';
}

/**
 * Render team standing cards
 */
function renderTeamCards(teams, maxPoints) {
    const list = document.getElementById('teamList');
    if (!list) return;

    list.innerHTML = '';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';

    teams.forEach((team, index) => {
        const rank = index + 1;
        let rankClass = '';
        let rankIcon = rank;

        if (rank === 1) { rankClass = 'rank-gold'; rankIcon = '🥇'; }
        else if (rank === 2) { rankClass = 'rank-silver'; rankIcon = '🥈'; }
        else if (rank === 3) { rankClass = 'rank-bronze'; rankIcon = '🥉'; }

        const barWidth = maxPoints > 0 ? Math.min(Math.round((team.points / maxPoints) * 100), 100) : 0;

        const logoHTML = team.team_logo
            ? `<img src="${escapeHTML(team.team_logo)}" alt="" class="team-logo-img">`
            : '';

        const card = document.createElement('div');
        card.className = `team-card ${rankClass}`;
        card.innerHTML = `
            <div class="rank-badge">${rankIcon}</div>
            <div class="team-info">
                <div class="team-name">${logoHTML}${escapeHTML(team.team_name)}</div>
                <div class="score-bar-wrap">
                    <div class="score-bar" style="width: 0%;" data-width="${barWidth}"></div>
                </div>
            </div>
            <div class="team-points">${team.points}<small> pts</small></div>
        `;
        list.appendChild(card);
    });

    // Animate progress bars after a slight delay
    requestAnimationFrame(() => {
        setTimeout(() => {
            list.querySelectorAll('.score-bar').forEach(bar => {
                bar.style.width = bar.dataset.width + '%';
            });
        }, 200);
    });
}

/**
 * Render previous updates pills
 */
function renderPreviousUpdates(updates) {
    const grid = document.getElementById('updatesGrid');
    const section = document.getElementById('updatesSection');
    if (!grid || !section) return;

    if (updates.length <= 1) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    
    // Paginate updates
    const start = (currentUpdatePage - 1) * UPDATE_PAGE_SIZE;
    const end = start + UPDATE_PAGE_SIZE;
    const pageUpdates = updates.slice(start, end);

    grid.innerHTML = '';

    pageUpdates.forEach(update => {
        const pill = document.createElement('button');
        pill.className = `update-pill${update.id === currentUpdateId ? ' active' : ''}`;
        pill.textContent = update.title;
        pill.dataset.id = update.id;
        pill.addEventListener('click', () => {
            loadStandings(update);
        });
        grid.appendChild(pill);
    });

    // Add pagination controls if needed
    renderUpdatesPagination(updates.length);
}

function renderUpdatesPagination(total) {
    const totalPages = Math.ceil(total / UPDATE_PAGE_SIZE);
    if (totalPages <= 1) {
        const existing = document.getElementById('updatesPagination');
        if (existing) existing.remove();
        return;
    }

    let pagContainer = document.getElementById('updatesPagination');
    if (!pagContainer) {
        pagContainer = document.createElement('div');
        pagContainer.id = 'updatesPagination';
        pagContainer.className = 'pagination-container';
        pagContainer.style.marginTop = '1.5rem';
        pagContainer.style.justifyContent = 'center';
        document.getElementById('updatesSection').appendChild(pagContainer);
    }

    pagContainer.innerHTML = '';

    const prev = document.createElement('button');
    prev.textContent = '◀';
    prev.disabled = currentUpdatePage === 1;
    prev.onclick = () => { if (currentUpdatePage > 1) { currentUpdatePage--; renderPreviousUpdates(allPublishedUpdates); } };
    pagContainer.appendChild(prev);

    const info = document.createElement('span');
    info.textContent = `Page ${currentUpdatePage} of ${totalPages}`;
    info.style.padding = '0 1rem';
    info.style.fontSize = '0.9rem';
    pagContainer.appendChild(info);

    const next = document.createElement('button');
    next.textContent = '▶';
    next.disabled = currentUpdatePage === totalPages;
    next.onclick = () => { if (currentUpdatePage < totalPages) { currentUpdatePage++; renderPreviousUpdates(allPublishedUpdates); } };
    pagContainer.appendChild(next);
}


/**
 * Highlight the active pill
 */
function highlightActivePill(activeId) {
    document.querySelectorAll('.update-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.id == activeId);
    });
}

// ── UI Helpers ──────────────────────────────────

function showLoading() {
    const loading = document.getElementById('loadingState');
    const empty = document.getElementById('emptyState');
    const list = document.getElementById('teamList');
    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    if (list) list.innerHTML = '';
}

function showEmpty(message) {
    const loading = document.getElementById('loadingState');
    const empty = document.getElementById('emptyState');
    const list = document.getElementById('teamList');
    if (loading) loading.style.display = 'none';
    if (list) list.innerHTML = '';
    if (empty) {
        empty.style.display = 'block';
        empty.querySelector('p').textContent = message;
    }
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
