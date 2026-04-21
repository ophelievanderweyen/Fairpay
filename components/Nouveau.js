const NouveauPage = {
    data() {
        return {
            groups: [] // On va stocker les groupes ici
        }
    },
    template: `
        <div class="p-4">
            <div class="top-bar">
                <button class="back-btn" @click="$parent.currentPage = 'home'" style="background: none; border: none; padding: 0;">
                    <i class="bi bi-chevron-left"></i>
                </button>
                <h4 class="fw-bold mb-0 text-dark">Nouvelle dépense</h4>
            </div>

            <div class="light-card">
                <form method="POST" action="api/backend.php?action=add_depense">
                    
                    <div class="mb-3">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Dans quel groupe ?</label>
                        <select name="group_id" class="form-select" required>
                            <option value="" disabled selected>Choisir un groupe...</option>
                            <option v-for="g in groups" :key="g.id" :value="g.id">
                                {{ g.name }}
                            </option>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Motif de la dépense</label>
                        <input type="text" name="reason" class="form-control" placeholder="Ex: Billets de train" required>
                    </div>
                    
                    <div class="mb-3 row g-2">
                        <div class="col-8">
                            <label class="form-label text-muted fw-bold" style="font-size: 13px;">Montant</label>
                            <input type="number" name="amount" class="form-control" placeholder="0.00" step="0.01" required>
                        </div>
                        <div class="col-4">
                            <label class="form-label text-muted fw-bold" style="font-size: 13px;">Devise</label>
                            <input type="text" class="form-control" value="€" readonly>
                        </div>
                    </div>

                    <div class="mb-4">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Date du paiement</label>
                        <input type="date" name="expense_date" class="form-control" required>
                    </div>

                    <div class="mb-4">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Payé par</label>
                        <select name="payer_id" class="form-select" required>
                            <option value="" disabled selected>Choisir un membre...</option>
                            <option value="1">Simon</option>
                            <option value="2">Ophélie</option>
                            <option value="3">Kawthar</option>
                            <option value="4">Aurélie</option>
                        </select>
                    </div>

                    <button type="submit" class="btn btn-primary-custom mt-2" :disabled="groups.length === 0">
                        VALIDER LA DÉPENSE
                    </button>
                    <p v-if="groups.length === 0" class="text-danger small mt-2">Créez d'abord un groupe dans l'onglet "Groupes" !</p>
                </form>
            </div>
        </div>
    `,
    mounted() {
        // Dès qu'on arrive sur la page, on demande la liste des groupes à l'API
        fetch('api/backend.php?action=get_groups')
            .then(res => res.json())
            .then(data => {
                this.groups = data;
            })
            .catch(err => console.error("Erreur chargement groupes:", err));
    }
};