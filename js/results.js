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
        // Fetch categories first
        const { data: categories } = await supabaseClient.from("categories").select("*").order("id");
        allCategories = categories || [];
        
        elements.category.innerHTML = '<option value="">Select Category</option>';
        allCategories.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat.id;
            opt.textContent = cat.name;
            elements.category.appendChild(opt);
        });

        // Preload general valid programs (published only)
        const { data: programs } = await supabaseClient
            .from("programs")
            .select("*")
            .order("program_name");
            
        allPrograms = programs || [];

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

function handleProgramChange(e) {
    const progId = e.target.value;
    
    resetDisplay();
    
    if (!progId) {
        elements.emptyState.style.display = 'block';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    elements.loaderState.style.display = 'block';
    
    // Find program
    const program = allPrograms.find(p => p.id == progId);
    currentResult = program;
    
    // Simulate slight loading feel for premium effect
    setTimeout(() => {
        elements.loaderState.style.display = 'none';
        
        if (program && program.published && program.poster_url) {
            elements.resultImage.src = program.poster_url;
            elements.imageContainer.style.display = 'block';
        } else {
            elements.pendingState.style.display = 'block';
            currentResult = null;
        }
    }, 400);
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
