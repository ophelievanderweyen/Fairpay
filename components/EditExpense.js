/* =========================================================================
   EDITEXPENSE.JS — Composant "Modifier une dépense"
   Flux traités : Flux 14 (lecture + modification d'une dépense)
                  Flux 15 (suppression d'une dépense)

   TABLE DES MATIÈRES
   ──────────────────────────────────────────────────────────────────────
    1.  Data
          Flux 14   groups · users · loading · saving · loadError
                    form { group_id, payer_id, reason, amount, expense_date }
                    errors
          Flux 15   deleting
    2.  Template  .....  Spinner · Message d'erreur · Formulaire pré-rempli · Bouton supprimer
    3.  Mounted  ......  Promise.all : get_expense + get_groups + get_users
    4.  Méthodes
          Flux 14   validate · saveExpense
          Flux 15   deleteExpense
   ──────────────────────────────────────────────────────────────────────
========================================================================= */

const EditExpensePage = {

    /* =========================================================================
       AUCUN FLUX — Données internes du composant
       ========================================================================= */
    data() {
        return {
            // Flux 14 : listes pour les menus déroulants (chargées en parallèle au montage)
            groups:    [],
            users:     [],
            // Flux 14 : états d'affichage
            loading:   true,   // true = spinner affiché pendant le chargement initial
            saving:    false,  // true = spinner affiché pendant l'envoi de la modification
            loadError: null,   // Message d'erreur si la dépense est introuvable
            // Flux 15 : état pendant la suppression
            deleting:  false,  // true = bouton supprimer désactivé pendant la requête DELETE
            // Flux 14 : champs du formulaire pré-remplis avec les valeurs actuelles de la dépense
            form: {
                group_id:     0,
                payer_id:     0,
                reason:       '',
                amount:       '',
                expense_date: ''
            },
            // Flux 14 : messages d'erreur de validation affichés sous chaque champ
            errors: {}
        }
    },

    /* =========================================================================
       FLUX N°14 : MODIFIER UNE DÉPENSE — Template (interface utilisateur)
       Affiche un spinner pendant le chargement, une erreur si introuvable,
       sinon le formulaire pré-rempli prêt à être modifié
       ========================================================================= */
    template: `
        <div class="p-4">
            <div class="top-bar">
                <button class="back-btn" @click="$parent.currentPage = 'home'" style="background: none; border: none; padding: 0;">
                    <i class="bi bi-chevron-left"></i>
                </button>
                <h4 class="fw-bold mb-0 text-dark">Modifier la dépense</h4>
            </div>

            <!-- Spinner pendant le chargement parallèle des données (Promise.all) -->
            <div v-if="loading" class="text-center p-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="text-muted mt-2 small">Chargement...</p>
            </div>

            <!-- Message d'erreur si la dépense est introuvable (ID invalide ou supprimée) -->
            <div v-else-if="loadError" class="alert alert-danger small m-4">
                <i class="bi bi-exclamation-circle-fill me-1"></i>{{ loadError }}
            </div>

            <!-- Formulaire de modification pré-rempli avec les valeurs actuelles -->
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

                    <button type="submit" class="btn btn-primary-custom mt-2" :disabled="saving || deleting">
                        <span v-if="saving">
                            <span class="spinner-border spinner-border-sm me-1"></span>Enregistrement...
                        </span>
                        <span v-else>ENREGISTRER LES MODIFICATIONS</span>
                    </button>

                    <!-- Flux 15 — Bouton supprimer la dépense -->
                    <button type="button" class="btn btn-outline-danger mt-2 ms-2" :disabled="saving || deleting" @click="deleteExpense">
                        <span v-if="deleting">
                            <span class="spinner-border spinner-border-sm me-1"></span>Suppression...
                        </span>
                        <span v-else><i class="bi bi-trash3 me-1"></i>Supprimer la dépense</span>
                    </button>
                </form>
            </div>

            <div style="height: 80px;" class="d-lg-none"></div>
        </div>
    `,

    /* =========================================================================
       FLUX N°14 : MODIFIER UNE DÉPENSE — Chargement initial en parallèle
       Flux : montage → Promise.all lance 3 requêtes GET simultanément
              1. get_expense?id=  → données actuelles de la dépense (pré-remplissage)
              2. get_groups       → liste des groupes (menu déroulant)
              3. get_users        → liste des membres (menu déroulant "Payé par")
       ========================================================================= */
    mounted() {
        // Récupère l'ID stocké dans app.js lors du clic sur le crayon (Accueil.js → editExpense)
        const id = this.$parent.editExpenseId;
        // Sécurité : sans ID, retour immédiat à l'accueil
        if (!id) {
            this.$parent.currentPage = 'home';
            return;
        }

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
            // Flux retour ← 3 JSON reçus → form{} pré-rempli → Vue re-rend le formulaire
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

        /* =========================================================================
           FLUX N°14 : MODIFIER UNE DÉPENSE — Validation du formulaire
           ========================================================================= */
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

        /* =========================================================================
           FLUX N°14 : MODIFIER UNE DÉPENSE — Envoi de la modification
           Flux : @submit.prevent → validate() → FormData → POST update_expense
                  → backend UPDATE expenses SET ... WHERE id = :id
                  → JSON { success: true } → toast + retour Dashboard (déclenche Flux n°9)
           ========================================================================= */
        async saveExpense() {
            if (!this.validate()) return;

            this.saving = true;

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
        },

        /* =========================================================================
           FLUX N°15 : SUPPRIMER UNE DÉPENSE
           Flux : clic "Supprimer" → confirm() → FormData → POST delete_expense
                  → backend DELETE FROM expenses WHERE id = :id
                  → toast + retour Dashboard (déclenche Flux n°9)
           ========================================================================= */
        async deleteExpense() {
            if (!confirm('Supprimer définitivement cette dépense ?')) return;

            this.deleting = true;
            const fd = new FormData();
            fd.append('id', this.$parent.editExpenseId);
            try {
                const res  = await fetch('api/backend.php?action=delete_expense', { method: 'POST', body: fd });
                const data = await res.json();
                if (data.success) {
                    this.$parent.showToast('Dépense supprimée.', 'success');
                    this.$parent.currentPage = 'home';
                } else {
                    this.$parent.showToast(data.error || 'Erreur lors de la suppression.', 'danger');
                }
            } catch {
                this.$parent.showToast('Erreur réseau.', 'danger');
            }
            this.deleting = false;
        }
    }
};
