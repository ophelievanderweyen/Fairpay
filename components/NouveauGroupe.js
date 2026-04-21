const NouveauGroupePage = {
    template: `
        <div class="p-4">
            <div class="top-bar mb-4">
                <button class="back-btn" @click="$parent.currentPage = 'groupes'" style="background:none; border:none;"><i class="bi bi-chevron-left"></i></button>
                <h4 class="fw-bold mb-0">Créer un groupe</h4>
            </div>
            <div class="light-card">
                <form method="POST" action="api/backend.php?action=add_group">
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted">NOM DU GROUPE</label>
                        <input type="text" name="name" class="form-control" placeholder="Ex: Coloc 2026" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted">DESCRIPTION</label>
                        <textarea name="description" class="form-control" rows="3"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary-custom">CRÉER</button>
                </form>
            </div>
        </div>
    `
};