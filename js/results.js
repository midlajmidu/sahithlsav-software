// js/index.js

let allCategories = [];
let allPrograms = [];

const elements = {
    category: document.getElementById('categorySelect'),
    program: document.getElementById('programSelect'),
    emptyState: document.getElementById('emptyState'),
    pendingState: document.getElementById('pendingState'),
    loaderState: document.getElementById('loaderState'),
    imageContainer: document.getElementById('imageContainer'),
    resultImage: document.getElementById('resultImage'),
    modalProgramName: document.getElementById('modalProgramName'),
    modalFullImage: document.getElementById('modalFullImage'),
    fullscreenModal: document.getElementById('fullscreenModal')
};

let currentResult = null;

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Fetch categories with caching (1 hour TTL)
        allCategories = await getCachedData('cat_cache', async () => {
            const { data } = await supabaseClient.from("categories").select("id, name").order("id");
            return data || [];
        }, 60);
        
        elements.category.innerHTML = '<option value="">Select Category</option>';
        allCategories.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat.id;
            opt.textContent = cat.name;
            elements.category.appendChild(opt);
        });

        // Preload valid programs list (published only, minimal fields) - 15 min TTL
        allPrograms = await getCachedData('prog_list_cache', async () => {
            const { data } = await supabaseClient
                .from("programs")
                .select("id, program_name, category_id, published") // No poster_url here to keep payload small
                .order("program_name");
            return data || [];
        }, 15);

    } catch (err) {
        console.error("Error loading initial data", err);
        elements.category.innerHTML = '<option value="">Error loading categories</option>';
    }

    
    // Listeners
    elements.category.addEventListener("change", handleCategoryChange);
    elements.program.addEventListener("change", handleProgramChange);
});

function handleCategoryChange(e) {
    const catId = e.target.value;
    
    resetDisplay();
    
    if (!catId) {
        elements.program.innerHTML = '<option value="">Select a category first</option>';
        elements.program.disabled = true;
        return;
    }
    
    // Filter programs by category
    const categoryPrograms = allPrograms.filter(p => p.category_id == catId);
    
    elements.program.innerHTML = '<option value="">Select Program</option>';
    
    if (categoryPrograms.length === 0) {
        elements.program.innerHTML = '<option value="">No programs in this category</option>';
        elements.program.disabled = true;
        return;
    }
    
    categoryPrograms.forEach(prog => {
        const opt = document.createElement("option");
        opt.value = prog.id;
        opt.textContent = prog.program_name;
        elements.program.appendChild(opt);
    });
    
    elements.program.disabled = false;
}

async function handleProgramChange(e) {
    const progId = e.target.value;
    
    resetDisplay();
    
    if (!progId) {
        elements.emptyState.style.display = 'block';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    elements.loaderState.style.display = 'block';
    
    // Fetch full detail for the specific program on-demand (poster_url is heavy)
    try {
        const { data: program, error } = await supabaseClient
            .from("programs")
            .select("id, program_name, poster_url, published")
            .eq('id', progId)
            .single();

        elements.loaderState.style.display = 'none';
        
        if (!error && program && program.published && program.poster_url) {
            elements.resultImage.src = program.poster_url;
            elements.imageContainer.style.display = 'block';
            currentResult = program;
        } else {
            elements.pendingState.style.display = 'block';
            currentResult = null;
        }
    } catch (e) {
        elements.loaderState.style.display = 'none';
        elements.pendingState.style.display = 'block';
    }
}


function resetDisplay() {
    elements.emptyState.style.display = 'none';
    elements.pendingState.style.display = 'none';
    elements.imageContainer.style.display = 'none';
    elements.loaderState.style.display = 'none';
    elements.resultImage.src = '';
    
    currentResult = null;
}

// Actions
async function downloadPoster() {
    if (!currentResult || !currentResult.poster_url) return;
    
    const url = currentResult.poster_url;
    const title = currentResult.program_name;
    
    try {
        const btn = document.querySelector('.btn-outline');
        const origHtml = btn.innerHTML;
        btn.innerHTML = 'Downloading...';
        
        const response = await fetch(url);
        const blob = await response.blob();
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${title.replace(/\s+/g, "_")}.webp`;
        link.click();
        
        URL.revokeObjectURL(link.href);
        btn.innerHTML = origHtml;
    } catch (e) {
        alert("Failed to download image.");
    }
}

function openFullscreen() {
    if (!currentResult || !currentResult.poster_url) return;
    
    elements.modalProgramName.textContent = currentResult.program_name;
    elements.modalFullImage.src = currentResult.poster_url;
    elements.fullscreenModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeFullscreen() {
    elements.fullscreenModal.classList.remove('active');
    document.body.style.overflow = '';
}
