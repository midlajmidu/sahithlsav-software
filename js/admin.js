// js/admin.js

let categoryMap = {};
let allPrograms = [];
// State for upload
let currentUploadProgramId = null;
let optimizedFileToUpload = null;
let currentOldPosterUrl = null;

// Pagination state
const PAGE_SIZE = 10;
let currentPage = 1;
let filteredPrograms = [];


document.addEventListener("DOMContentLoaded", async () => {
    const session = await checkAuth(true);
    if (!session) return;

    await loadFilters();
    await loadPrograms();

    setupEventListeners();
});

async function loadFilters() {
    // Admin always needs fresh categories for accurate mapping
    const categories = await supabaseClient.from("categories").select("id, name").order("id");
    const data = categories.data || [];
    
    // We update the cache too so frontend stays synced
    CacheManager.set('cat_cache', data, 5);


    const filter = document.getElementById("categoryFilter");
    
    if (data) {
        data.forEach(c => {
            categoryMap[c.id] = c.name;
            const option = document.createElement("option");
            option.value = c.id;
            option.textContent = c.name;
            filter.appendChild(option);
        });
    }
}



async function loadPrograms() {
    showLoader("Loading programs...");
    try {
        // ALWAYS fetch fresh in Admin
        const { data, error } = await supabaseClient
            .from("programs")
            .select("id, program_name, category_id, published, poster_url")
            .order("id");
            
        if (error) throw error;
        allPrograms = data || [];
        
        // Sync cache
        CacheManager.set('prog_cache', allPrograms, 5);
        
        applyFilters(); // Setup filtered list and render first page

    } catch (err) {
        ui.toast(err.message, "error");
    } finally {
        hideLoader();
    }
}

function applyFilters() {
    const searchTerm = document.getElementById("searchInput").value.toLowerCase();
    const catFilter = document.getElementById("categoryFilter").value;

    filteredPrograms = allPrograms.filter(p => {
        let matchName = p.program_name.toLowerCase().includes(searchTerm);
        let matchCat = catFilter ? p.category_id == catFilter : true;
        return matchName && matchCat;
    });

    currentPage = 1;
    renderTable();
}


function renderTable() {
    const tbody = document.getElementById("programsTableBody");
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pageData = filteredPrograms.slice(startIndex, endIndex);

    tbody.innerHTML = "";

    if (filteredPrograms.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No programs found</td></tr>`;
        updateTableInfo(0, 0, 0);
        renderPagination(0);
        return;
    }

    pageData.forEach(p => {
        const hasPoster = !!p.poster_url;
        const statusBadge = hasPoster 
            ? (p.published ? '<span class="badge badge-success">Published</span>' : '<span class="badge badge-warning">Uploaded (Unpublished)</span>')
            : '<span class="badge">Pending</span>';

        const escapedName = p.program_name.replace(/'/g, "\\'");

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input type="checkbox" class="program-checkbox" value="${p.id}"></td>
            <td><strong>${p.program_name}</strong></td>
            <td>${categoryMap[p.category_id] || 'Unknown'}</td>
            <td>${statusBadge}</td>
            <td>
                ${hasPoster ? `<img src="${p.poster_url}" style="height:40px; width:40px; object-fit:cover; border-radius:4px; border:1px solid var(--border);">` : '-'}
            </td>
            <td>
                <button onclick="openUploadModal(${p.id}, '${escapedName}', '${p.poster_url || ''}')" class="icon-btn" title="Upload/Replace Poster">📁</button>
                ${hasPoster ? `
                    <button onclick="togglePublish(${p.id}, ${!p.published})" class="icon-btn" title="${p.published ? 'Unpublish' : 'Publish'}">${p.published ? '🚫' : '✅'}</button>
                    ` : ''}
                <button onclick="handleDeleteProgram(${p.id}, '${escapedName}')" class="icon-btn" title="Delete" style="color:var(--danger)">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateTableInfo(startIndex + 1, Math.min(endIndex, filteredPrograms.length), filteredPrograms.length);
    renderPagination(filteredPrograms.length);
}

function updateTableInfo(start, end, total) {
    const info = document.getElementById("tableInfo");
    if (total === 0) {
        info.textContent = "Showing 0 to 0 of 0 entries";
    } else {
        info.textContent = `Showing ${start} to ${end} of ${total} entries`;
    }
}

function renderPagination(totalEntries) {
    const totalPages = Math.ceil(totalEntries / PAGE_SIZE);
    const container = document.getElementById("pagination");
    container.innerHTML = "";

    if (totalPages <= 1) return;

    // Previous button
    const prevBtn = document.createElement("button");
    prevBtn.innerHTML = "◀";
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
    container.appendChild(prevBtn);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const btn = document.createElement("button");
            btn.textContent = i;
            if (i === currentPage) btn.classList.add("active");
            btn.onclick = () => { currentPage = i; renderTable(); };
            container.appendChild(btn);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const dot = document.createElement("span");
            dot.textContent = "...";
            dot.style.padding = "0 0.5rem";
            container.appendChild(dot);
        }
    }

    // Next button
    const nextBtn = document.createElement("button");
    nextBtn.innerHTML = "▶";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); } };
    container.appendChild(nextBtn);
}


function setupEventListeners() {
    document.getElementById("searchInput").addEventListener("input", applyFilters);
    document.getElementById("categoryFilter").addEventListener("change", applyFilters);

    
    document.getElementById("selectAll").addEventListener("change", (e) => {
        document.querySelectorAll(".program-checkbox").forEach(cb => {
            cb.checked = e.target.checked;
        });
    });

    // Upload zone interactions
    const uploadZone = document.getElementById("uploadZone");
    const fileInput = document.getElementById("posterFile");

    uploadZone.addEventListener("click", () => fileInput.click());
    
    uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.classList.add("dragover");
    });
    
    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("dragover");
    });
    
    uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.classList.remove("dragover");
        if (e.dataTransfer.files.length) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length) {
            handleFileSelection(e.target.files[0]);
        }
    });

    document.getElementById("confirmUploadBtn").addEventListener("click", uploadFinalPoster);
    
    // Add Delete icon handling in renderTable or similar
}

async function handleDeleteProgram(id, name) {
    const isConfirmed = await SessionGuard.confirmAction('Delete Program', `Are you sure you want to permanently delete "${name}"? This cannot be undone.`);
    if (!isConfirmed) return;

    showLoader("Deleting program...");
    try {
        const { error } = await supabaseClient.from("programs").delete().eq("id", id);
        
        if (error) throw error;
        
        if (typeof logActivity === 'function') {
            await logActivity('delete', 'results', { program_id: id, name: name });
        }
        
        SessionGuard.notify('Program deleted permanently.', 'success');
        CacheManager.invalidate(['program']); // Invalidate cache
        await loadPrograms();

    } catch (e) {
        ui.toast(e.message, "error");
    } finally {
        hideLoader();
    }
}

// Bulk Actions
function toggleBulk() {
    const menu = document.getElementById("bulkMenu");
    menu.style.display = menu.style.display === "none" || !menu.style.display ? "flex" : "none";
}

document.addEventListener("click", (e) => {
    if (!e.target.closest('.dropdown')) {
        const menu = document.getElementById("bulkMenu");
        if(menu) menu.style.display = "none";
    }
});

async function bulkAction(action) {
    toggleBulk();
    const selected = Array.from(document.querySelectorAll(".program-checkbox:checked")).map(cb => cb.value);
    
    if (selected.length === 0) {
        ui.toast("No programs selected", "warning");
        return;
    }
    
    showLoader("Applying bulk action...");
    try {
        const publishState = action === 'publish';
        for (const id of selected) {
            await supabaseClient.from("programs").update({ published: publishState }).eq("id", id);
        }
        ui.toast("Bulk action completed.");
        CacheManager.invalidate(['program']);
        await loadPrograms();

    } catch (e) {
        ui.toast("Bulk action failed.", "error");
    } finally {
        hideLoader();
    }
}

async function togglePublish(id, newState) {
    showLoader("Updating status...");
    try {
        const { error } = await supabaseClient.from("programs").update({ published: newState }).eq("id", id);
        if (error) throw error;
        ui.toast("Program status updated.");
        CacheManager.invalidate(['program']);

        
        // update local state
        const p = allPrograms.find(p => p.id == id);
        if (p) p.published = newState;
        
        renderTable();
    } catch (e) {
        ui.toast(e.message, "error");
    } finally {
        hideLoader();
    }
}

// Modal & Upload Flow
function openUploadModal(programId, progName, oldUrl) {
    currentUploadProgramId = programId;
    currentOldPosterUrl = oldUrl;
    
    document.getElementById("uploadModalProgramName").textContent = progName;
    document.getElementById("uploadModal").classList.add("active");
    
    // reset UI
    optimizedFileToUpload = null;
    document.getElementById("posterFile").value = "";
    document.getElementById("previewArea").style.display = "none";
    document.getElementById("confirmUploadBtn").disabled = true;
    document.getElementById("uploadProgressContainer").style.display = "none";
    document.getElementById("uploadProgressBar").style.width = "0%";
}

function closeUploadModal() {
    document.getElementById("uploadModal").classList.remove("active");
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

async function handleFileSelection(file) {
    if (!file) return;
    
    if (!file.type.match(/image.*/)) {
        ui.toast("Please select an image file", "error");
        return;
    }

    try {
        const result = await ImageProcessor.optimizeImage(file);
        
        optimizedFileToUpload = result.blob;
        optimizedFileToUpload.name = result.fileName;
        
        document.getElementById("previewImg").src = URL.createObjectURL(result.blob);
        document.getElementById("origSize").textContent = result.stats.original;
        document.getElementById("optSize").textContent = result.stats.compressed;
        document.getElementById("reductionRatio").textContent = result.stats.reduction;
        
        document.getElementById("previewArea").style.display = "block";
        document.getElementById("confirmUploadBtn").disabled = false;
        
    } catch (err) {
        ui.toast(err.message, "error");
    } finally {
        hideLoader();
    }
}

async function uploadFinalPoster() {
    if (!optimizedFileToUpload || !currentUploadProgramId) return;

    const btn = document.getElementById("confirmUploadBtn");
    btn.disabled = true;
    
    const progressContainer = document.getElementById("uploadProgressContainer");
    const progressBar = document.getElementById("uploadProgressBar");
    
    progressContainer.style.display = "block";
    progressBar.style.width = "10%"; // Simulated initial progress
    
    try {
        // Delete old if exists
        if (currentOldPosterUrl) {
            try {
                // extract path from url
                const oldPath = currentOldPosterUrl.split('/').pop();
                await supabaseClient.storage.from("results-posters").remove([oldPath]);
            } catch (e) {
                console.warn("Could not delete old image", e);
            }
        }
        
        progressBar.style.width = "30%";
        
        // Upload new file
        const uniqueFilename = `${Date.now()}-${optimizedFileToUpload.name}`;
        
        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from("results-posters")
            .upload(uniqueFilename, optimizedFileToUpload, {
                cacheControl: '3600',
                upsert: false
            });
            
        if (uploadError) throw uploadError;
        
        progressBar.style.width = "80%";
        
        // Retrieve public URL
        const { data: { publicUrl } } = supabaseClient
            .storage
            .from("results-posters")
            .getPublicUrl(uniqueFilename);
            
        // Update Database
        const { error: dbError } = await supabaseClient
            .from("programs")
            .update({ poster_url: publicUrl, published: true })
            .eq("id", currentUploadProgramId);
            
        if (dbError) throw dbError;
        
        progressBar.style.width = "100%";
        
        ui.toast("Uploaded successfully!");
        CacheManager.invalidate(['results']); 

        setTimeout(() => {
            closeUploadModal();
            loadPrograms(); // refresh
        }, 500);

    } catch (e) {
        ui.toast(e.message, "error");
        btn.disabled = false;
        progressBar.style.width = "0%";
    }
}