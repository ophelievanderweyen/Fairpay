// EditExpense.js — Composant "Modifier une dépense"
// Flux général : montage → 3 requêtes parallèles (dépense + groupes + users) → pré-remplissage → POST update
const EditExpensePage = {
    data() {
        return {
            groups: [],
            users: [],
            loading: true,
            saving: false,
            loadError: null,
            form: {
                group_id:     0,
                payer_id:     0,
                reason:       '',
                amount:       '',
                expense_date: ''
            },
            errors: {}
        }
    },

    template: `
        <div class="p-4">
            <div class="top-bar">
                <button class="back-btn" @click="$parent.currentPage = 'home'" style="background: none; border: none; padding: 0;">
                    <i class="bi bi-chevron-left"></i>
                </button>
                <h4 class="fw-bold mb-0 text-dark">Modifier la dépense</h4>
            </div>

            <div v-if="loading" class="text-center p-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="text-muted mt-2 small">Chargement...</p>
            </div>

            <div v-else-if="loadError" class="alert alert-danger small m-4">
                <i class="bi bi-exclamation-circle-fill me-1"></i>{{ loadError }}
            </div>

            <div v-else class="light-card">
                <form @submit.prevent="saveExpense" novalidate>

                    <div class="mb-3">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Dans quel groupe ?</label>
                        <select v-model="form.group_id" class="form-select"
                                :class="{ 'is-invalid': errors.group_id }">
                            <option :value="0" disabled>Choisir un groupe...</option>
                            <option v-for="g in groups" :key="g.id" :value="parseInt(g.id)">{{ g.name }}</option>
                        </select>
                        <div v-if="errors.group_id" class="invalid-feedback">{{ errors.group_id }}</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Motif de la dépense</label>
                        <input type="text" v-model="form.reason" class="form-control"
                               :class="{ 'is-invalid': errors.reason }"
                               placeholder="Ex: Courses">
                        <div v-if="errors.reason" class="invalid-feedback">{{ errors.reason }}</div>
                    </div>

                    <div class="mb-3 row g-2">
                        <div class="col-8">
                            <label class="form-label text-muted fw-bold" style="font-size: 13px;">Montant</label>
                            <input type="number" v-model="form.amount" class="form-control"
                                   :class="{ 'is-invalid': errors.amount }"
                                   step="0.01" min="0">
                            <div v-if="errors.amount" class="invalid-feedback">{{ errors.amount }}</div>
                        </div>
                        <div class="col-4">
                            <label class="form-label text-muted fw-bold" style="font-size: 13px;">Devise</label>
                            <input type="text" class="form-control" value="€" readonly>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Date du paiement</label>
                        <input type="date" v-model="form.expense_date" class="form-control"
                               :class="{ 'is-invalid': errors.expense_date }">
                        <div v-if="errors.expense_date" class="invalid-feedback">{{ errors.expense_date }}</div>
                    </div>

                    <div class="mb-4">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Payé par</label>
                        <select v-model="form.payer_id" class="form-select"
                                :class="{ 'is-invalid': errors.payer_id }">
                            <option :value="0" disabled>Choisir un membre...</option>
                            <option v-for="u in users" :key="u.id" :value="parseInt(u.id)">{{ u.name }}</option>
                        </select>
                        <div v-if="errors.payer_id" class="invalid-feedback">{{ errors.payer_id }}</div>
                    </div>

                    <button type="submit" class="btn btn-primary-custom mt-2" :disabled="saving">
                        <span v-if="saving">
                            <span class="spinner-border spinner-border-sm me-1"></span>Enregistrement...
                        </span>
                        <span v-else>ENREGISTRER LES MODIFICATIONS</span>
                    </button>
                </form>
            </div>

            <div style="height: 80px;" class="d-lg-none"></div>
        </div>
    `,

    mounted() {
        // Récupère l'ID stocké dans app.js lors du clic sur le bouton "Modifier"
        const id = this.$parent.editExpenseId;
        if (!id) {
            this.$parent.currentPage = 'home'; // Sécurité : sans ID, on ne peut pas éditer
            return;
        }

        // Flux → 3 requêtes GET lancées en parallèle (Promise.all attend que les 3 répondent) :
        // 1. get_expense?id=  → données actuelles de la dépense (pour pré-remplir le formulaire)
        // 2. get_groups       → liste des groupes (pour le menu déroulant)
        // 3. get_users        → liste des membres (pour le menu déroulant "Payé par")
        Promise.all([
            fetch('api/backend.php?action=get_expense&id=' + id).then(r => r.json()),
            fetch('api/backend.php?action=get_groups').then(r => r.json()),
            fetch('api/backend.php?action=get_users').then(r => r.json())
        ]).then(([expense, groups, users]) => {
            if (expense.error) {
                this.loadError = expense.error;
                this.loading   = false;
                return;
            }
            // Flux retour ← les 3 JSON reçus → form{} pré-rempli → Vue re-rend le formulaire
            this.groups = groups;
            this.users  = users;
            this.form   = {
                group_id:     parseInt(expense.group_id),
                payer_id:     parseInt(expense.payer_id),
                reason:       expense.reason,
                amount:       expense.amount,
                expense_date: expense.expense_date
            };
            this.loading = false;
        }).catch(() => {
            this.loadError = 'Impossible de charger la dépense.';
            this.loading   = false;
        });
    },

    methods: {
        validate() {
            this.errors = {};
            if (!this.form.group_id || this.form.group_id === 0)
                this.errors.group_id = 'Veuillez choisir un groupe.';
            if (!this.form.reason || this.form.reason.trim().length < 2)
                this.errors.reason = 'Le motif doit contenir au moins 2 caractères.';
            if (!this.form.amount || parseFloat(this.form.amount) <= 0)
                this.errors.amount = 'Le montant doit être supérieur à 0.';
            if (!this.form.expense_date)
                this.errors.expense_date = 'Veuillez indiquer une date.';
            if (!this.form.payer_id || this.form.payer_id === 0)
                this.errors.payer_id = 'Veuillez choisir un payeur.';
            return Object.keys(this.errors).length === 0;
        },

        async saveExpense() {
            if (!this.validate()) return; // Stoppe si le formulaire contient des erreurs

            this.saving = true;

            // Flux → FormData avec l'ID de la dépense + tous les champs modifiés
            // Le backend fait UPDATE expenses SET ... WHERE id = ? (ciblage par ID)
            const fd = new FormData();
            fd.append('id',           this.$parent.editExpenseId);
            fd.append('group_id',     this.form.group_id);
            fd.append('payer_id',     this.form.payer_id);
            fd.append('reason',       this.form.reason.trim());
            fd.append('amount',       this.form.amount);
            fd.append('expense_date', this.form.expense_date);
            try {
                const res  = await fetch('api/backend.php?action=update_expense', { method: 'POST', body: fd });
                const data = await res.json();
                // Flux retour ← JSON { success: true } → toast + retour au tableau de bord
                if (data.success) {
                    this.$parent.showToast('Dépense modifiée avec succès !', 'success');
                    this.$parent.currentPage = 'home';
                } else {
                    this.$parent.showToast(data.error || 'Erreur lors de la sauvegarde.', 'danger');
                }
            } catch {
                this.$parent.showToast('Erreur réseau.', 'danger');
            }
            this.saving = false;
        }
    }
};
