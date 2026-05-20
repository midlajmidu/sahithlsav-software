// js/admin-score.js — SSF Team Score Admin Management
// Full CRUD for score_updates + score_details via Supabase. Zero hardcoded data.

let selectedUpdateId = null;
let teamRows = []; // live state of team edits for selected update

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth(true);
    await loadUpdates();
    bindEvents();
});

// ══════════════════════════════════
// EVENT BINDINGS
// ══════════════════════════════════

function bindEvents() {
    // Toggle create form
    document.getElementById('btnToggleCreate').addEventListener('click', toggleCreateForm);

    // Submit create form
    document.getElementById('createForm').addEventListener('submit', handleCreateUpdate);

    // Update selector
    document.getElementById('updateSelect').addEventListener('change', handleUpdateSelect);

    // Save scores
    document.getElementById('btnSave').addEventListener('click', handleSaveScores);

    // Publish / Unpublish
    document.getElementById('btnPublish').addEventListener('click', handlePublish);

    // Delete
    document.getElementById('btnDelete').addEventListener('click', handleDelete);

    // Add team
    document.getElementById('btnAddTeam').addEventListener('click', handleAddTeam);
}

// ══════════════════════════════════
// LOAD ALL UPDATES INTO DROPDOWN
// ══════════════════════════════════

async function loadUpdates() {
    const select = document.getElementById('updateSelect');
    select.innerHTML = '<option value="">Select an update…</option>';

    try {
        const { data: updates, error } = await supabaseClient
            .from('score_updates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!updates || updates.length === 0) {
            select.innerHTML = '<option value="">No updates yet. Create one above.</option>';
            clearEditor();
            return;
        }

        updates.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = `${u.title}${u.published ? ' ✅ Published' : ' 📝 Draft'}`;
            select.appendChild(opt);
        });

        // If we had a previously selected update, re-select it
        if (selectedUpdateId) {
            select.value = selectedUpdateId;
            if (select.value) {
                await loadScoresForUpdate(selectedUpdateId);
            } else {
                selectedUpdateId = null;
                clearEditor();
            }
        }

    } catch (err) {
        console.error('Failed to load updates:', err);
        showToast('Failed to load updates', 'error');
    }
}

// ══════════════════════════════════
// CREATE UPDATE
// ══════════════════════════════════

function toggleCreateForm() {
    const panel = document.getElementById('createFormPanel');
    panel.classList.toggle('visible');
    const btn = document.getElementById('btnToggleCreate');
    if (panel.classList.contains('visible')) {
        btn.textContent = '✕ Cancel';
    } else {
        btn.textContent = '+ Create Update';
    }
}

async function handleCreateUpdate(e) {
    e.preventDefault();

    const title = document.getElementById('inputTitle').value.trim();
    const count = parseInt(document.getElementById('inputCount').value) || 0;
    const desc = document.getElementById('inputDesc').value.trim();

    if (!title) {
        showToast('Title is required', 'error');
        return;
    }

    const submitBtn = document.getElementById('btnSubmitCreate');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';

    try {
        // 1. Insert the new score_update
        const { data: newUpdate, error: insertErr } = await supabaseClient
            .from('score_updates')
            .insert({
                title,
                results_count: count,
                description: desc,
                published: false
            })
            .select()
            .single();

        if (insertErr) throw insertErr;

        // 2. Copy teams from the most recent existing update (if any)
        await copyTeamsFromPrevious(newUpdate.id);

        // 3. Log activity
        if (typeof logActivity === 'function') {
            await logActivity('create_score_update', 'team_scores', { title, id: newUpdate.id });
        }

        showToast('Update created successfully', 'success');

        // 4. Reset form & close
        document.getElementById('createForm').reset();
        document.getElementById('createFormPanel').classList.remove('visible');
        document.getElementById('btnToggleCreate').textContent = '+ Create Update';

        // 5. Reload updates and select the new one
        selectedUpdateId = newUpdate.id;
        await loadUpdates();

    } catch (err) {
        console.error('Create update failed:', err);
        showToast('Failed to create update: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Update';
    }
}

/**
 * Copy team names + logos from the most recent update into a new update with 0 points.
 */
async function copyTeamsFromPrevious(newUpdateId) {
    try {
        // Get the most recent update BEFORE this one
        const { data: prevUpdates } = await supabaseClient
            .from('score_updates')
            .select('id')
            .neq('id', newUpdateId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (!prevUpdates || prevUpdates.length === 0) return; // No previous update

        const prevId = prevUpdates[0].id;

        // Get teams from previous
        const { data: prevTeams } = await supabaseClient
            .from('score_details')
            .select('team_name, team_logo')
            .eq('update_id', prevId);

        if (!prevTeams || prevTeams.length === 0) return;

        // Insert copied teams into new update
        const newTeams = prevTeams.map((t, idx) => ({
            update_id: newUpdateId,
            team_name: t.team_name,
            team_logo: t.team_logo || '',
            points: 0,
            position: idx + 1
        }));

        await supabaseClient.from('score_details').insert(newTeams);

    } catch (err) {
        console.warn('Could not copy teams from previous update:', err);
    }
}

// ══════════════════════════════════
// SELECT & LOAD UPDATE
// ══════════════════════════════════

async function handleUpdateSelect() {
    const id = document.getElementById('updateSelect').value;
    if (!id) {
        selectedUpdateId = null;
        clearEditor();
        return;
    }
    selectedUpdateId = id;
    await loadScoresForUpdate(id);
}

async function loadScoresForUpdate(updateId) {
    const editor = document.getElementById('editorPanel');
    const empty = document.getElementById('editorEmpty');
    const teamList = document.getElementById('teamEditList');

    editor.style.display = 'block';
    empty.style.display = 'none';

    // Fetch update details for status badge
    const { data: updateData } = await supabaseClient
        .from('score_updates')
        .select('*')
        .eq('id', updateId)
        .single();

    if (updateData) {
        renderUpdateStatus(updateData);
    }

    // Fetch teams
    try {
        const { data: teams, error } = await supabaseClient
            .from('score_details')
            .select('*')
            .eq('update_id', updateId)
            .order('position', { ascending: true });

        if (error) throw error;

        teamRows = teams || [];
        renderTeamEditRows();

    } catch (err) {
        console.error('Failed to load scores:', err);
        showToast('Failed to load team scores', 'error');
    }
}

function renderUpdateStatus(update) {
    const badge = document.getElementById('updateStatusBadge');
    if (!badge) return;
    badge.className = `update-status-badge ${update.published ? 'published' : 'draft'}`;
    badge.textContent = update.published ? '✅ Published' : '📝 Draft';

    const publishBtn = document.getElementById('btnPublish');
    if (update.published) {
        publishBtn.textContent = '📤 Unpublish';
        publishBtn.className = 'btn-admin btn-outline';
    } else {
        publishBtn.textContent = '🚀 Publish';
        publishBtn.className = 'btn-admin btn-green';
    }
}

function renderTeamEditRows() {
    const list = document.getElementById('teamEditList');
    list.innerHTML = '';

    if (teamRows.length === 0) {
        list.innerHTML = `
            <div class="admin-empty">
                <div class="empty-icon">📋</div>
                <p>No teams yet. Add teams below.</p>
            </div>
        `;
        return;
    }

    // Sort by position for editing
    teamRows.sort((a, b) => (a.position || 999) - (b.position || 999));

    teamRows.forEach((team, idx) => {
        const row = document.createElement('div');
        row.className = 'team-edit-row';
        row.dataset.index = idx;
        row.innerHTML = `
            <div class="team-rank-num">${idx + 1}</div>
            <div class="team-edit-name">${escapeHTML(team.team_name)}</div>
            <input type="number" class="points-input" value="${team.points || 0}" min="0" data-index="${idx}" placeholder="Pts">
            <button class="btn-remove-team" data-index="${idx}" title="Remove Team">✕</button>
        `;
        list.appendChild(row);
    });

    // Bind points change
    list.querySelectorAll('.points-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const i = parseInt(e.target.dataset.index);
            teamRows[i].points = parseInt(e.target.value) || 0;
        });
    });

    // Bind remove
    list.querySelectorAll('.btn-remove-team').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const i = parseInt(e.target.dataset.index);
            if (confirm(`Remove "${teamRows[i].team_name}"?`)) {
                teamRows.splice(i, 1);
                renderTeamEditRows();
            }
        });
    });
}

// ══════════════════════════════════
// ADD TEAM
// ══════════════════════════════════

function handleAddTeam() {
    const nameInput = document.getElementById('newTeamName');
    const name = nameInput.value.trim();

    if (!name) {
        showToast('Enter a team name', 'error');
        nameInput.focus();
        return;
    }

    // Check duplicate
    if (teamRows.some(t => t.team_name.toLowerCase() === name.toLowerCase())) {
        showToast('Team already exists', 'error');
        return;
    }

    teamRows.push({
        update_id: selectedUpdateId,
        team_name: name,
        team_logo: '',
        points: 0,
        position: teamRows.length + 1
    });

    nameInput.value = '';
    renderTeamEditRows();
    showToast('Team added', 'success');
}

// ══════════════════════════════════
// SAVE SCORES
// ══════════════════════════════════

async function handleSaveScores() {
    if (!selectedUpdateId) return;

    const btn = document.getElementById('btnSave');
    btn.disabled = true;
    btn.textContent = '💾 Saving…';

    try {
        // 1. Sort by points descending to assign positions
        const sorted = [...teamRows].sort((a, b) => b.points - a.points);
        sorted.forEach((team, idx) => { team.position = idx + 1; });

        // 2. Delete existing score_details for this update
        const { error: delErr } = await supabaseClient
            .from('score_details')
            .delete()
            .eq('update_id', selectedUpdateId);

        if (delErr) throw delErr;

        // 3. Insert fresh rows
        if (sorted.length > 0) {
            const insertData = sorted.map(t => ({
                update_id: selectedUpdateId,
                team_name: t.team_name,
                team_logo: t.team_logo || '',
                points: t.points || 0,
                position: t.position
            }));

            const { error: insErr } = await supabaseClient
                .from('score_details')
                .insert(insertData);

            if (insErr) throw insErr;
        }

        // 4. Log
        if (typeof logActivity === 'function') {
            await logActivity('save_scores', 'team_scores', {
                update_id: selectedUpdateId,
                team_count: sorted.length
            });
        }

        showToast('Scores saved successfully', 'success');

        // Reload to get fresh IDs
        await loadScoresForUpdate(selectedUpdateId);

    } catch (err) {
        console.error('Save failed:', err);
        showToast('Save failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Save Scores';
    }
}

// ══════════════════════════════════
// PUBLISH / UNPUBLISH
// ══════════════════════════════════

async function handlePublish() {
    if (!selectedUpdateId) return;

    // Check current state
    const { data: current } = await supabaseClient
        .from('score_updates')
        .select('published')
        .eq('id', selectedUpdateId)
        .single();

    if (!current) return;

    const isPublished = current.published;
    const action = isPublished ? 'unpublish' : 'publish';

    if (!confirm(`Are you sure you want to ${action} this update?`)) return;

    const btn = document.getElementById('btnPublish');
    btn.disabled = true;

    try {
        const { error } = await supabaseClient
            .from('score_updates')
            .update({ published: !isPublished })
            .eq('id', selectedUpdateId);

        if (error) throw error;

        if (typeof logActivity === 'function') {
            await logActivity(`${action}_score_update`, 'team_scores', { update_id: selectedUpdateId });
        }

        showToast(`Update ${action}ed successfully`, 'success');
        await loadUpdates();

    } catch (err) {
        console.error(`${action} failed:`, err);
        showToast(`Failed to ${action}: ` + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// ══════════════════════════════════
// DELETE
// ══════════════════════════════════

async function handleDelete() {
    if (!selectedUpdateId) return;

    if (!confirm('⚠️ Delete this update and all its team scores?\n\nThis action cannot be undone.')) return;

    const btn = document.getElementById('btnDelete');
    btn.disabled = true;
    btn.textContent = '🗑 Deleting…';

    try {
        // 1. Delete score_details first (child records)
        const { error: detailErr } = await supabaseClient
            .from('score_details')
            .delete()
            .eq('update_id', selectedUpdateId);

        if (detailErr) throw detailErr;

        // 2. Delete the score_update
        const { error: updateErr } = await supabaseClient
            .from('score_updates')
            .delete()
            .eq('id', selectedUpdateId);

        if (updateErr) throw updateErr;

        if (typeof logActivity === 'function') {
            await logActivity('delete_score_update', 'team_scores', { update_id: selectedUpdateId });
        }

        showToast('Update deleted successfully', 'success');
        selectedUpdateId = null;
        clearEditor();
        await loadUpdates();

    } catch (err) {
        console.error('Delete failed:', err);
        showToast('Delete failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🗑 Delete';
    }
}

// ══════════════════════════════════
// UI HELPERS
// ══════════════════════════════════

function clearEditor() {
    const editor = document.getElementById('editorPanel');
    const empty = document.getElementById('editorEmpty');
    if (editor) editor.style.display = 'none';
    if (empty) empty.style.display = 'block';
    teamRows = [];
}

function showToast(message, type = 'info') {
    if (typeof SessionGuard !== 'undefined' && SessionGuard.notify) {
        SessionGuard.notify.show(message, type);
    } else if (typeof ui !== 'undefined' && ui.toast) {
        ui.toast(message, type);
    } else {
        // Fallback inline toast
        let container = document.getElementById('admin-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'admin-toast-container';
            container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
        toast.style.cssText = `padding:0.85rem 1.25rem;background:#fff;border-radius:0.5rem;box-shadow:0 4px 12px rgba(0,0,0,0.15);border-left:4px solid ${colors[type] || colors.info};font-size:0.9rem;animation:slideIn 0.3s ease forwards;`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
    }
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
