const EditExpensePage = {
    template: `
        <div class="container bg-white p-4 rounded-4 shadow-sm my-3" style="max-width: 450px; margin: auto;">
            <div class="d-flex align-items-center mb-4">
                <button class="btn btn-link text-dark p-0 me-3" @click="$parent.currentPage = 'home'"><i class="bi bi-chevron-left"></i></button>
                <h2 class="h5 fw-bold mb-0">Modifier la dépense</h2>
            </div>
            <form>
                <div class="mb-3">
                    <label class="form-label small fw-bold text-muted">Motif</label>
                    <input type="text" class="form-control" value="Courses Coloc">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold text-muted">Montant (€)</label>
                    <input type="number" class="form-control" value="25.50">
                </div>
                <button type="button" class="btn btn-primary w-100 rounded-pill fw-bold">ENREGISTRER</button>
            </form>
        </div>
    `
};
