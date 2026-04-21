const SelectGroupPage = {
    template: `
        <div class="container bg-white p-4 rounded-4 shadow-sm my-3" style="max-width: 450px; margin: auto;">
            <div class="d-flex align-items-center mb-4">
                <button class="btn btn-link text-dark p-0 me-3" @click="$parent.currentPage = 'home'"><i class="bi bi-chevron-left"></i></button>
                <h2 class="h5 fw-bold mb-0">Choisir un groupe</h2>
            </div>
            <form>
                <div class="list-group mb-4">
                    <label class="list-group-item d-flex gap-3">
                        <input class="form-check-input flex-shrink-0" type="radio" name="g" checked>
                        <span class="fw-bold">Voyage en Italie 🇮🇹</span>
                    </label>
                    <label class="list-group-item d-flex gap-3">
                        <input class="form-check-input flex-shrink-0" type="radio" name="g">
                        <span class="fw-bold">Coloc 🏠</span>
                    </label>
                </div>
                <button type="button" class="btn btn-primary w-100 rounded-pill fw-bold">VOIR LE GROUPE</button>
            </form>
        </div>
    `
};
