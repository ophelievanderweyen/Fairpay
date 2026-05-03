// Nouveau.js — Composant "Nouvelle dépense"
// Flux général : formulaire HTML ↔ v-model ↔ form{} → validate() → POST backend.php → toast + retour home
const NouveauPage = {
    data() {
        return {
            groups: [],
            users: [],
            form: {
                group_id:     '',
                reason:       '',
                amount:       '',
                expense_date: '',
                payer_id:     ''
            },
            errors: {},
            submitting: false
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
                <form @submit.prevent="submitForm" novalidate>

                    <div class="mb-3">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Dans quel groupe ?</label>
                        <select v-model="form.group_id" class="form-select"
                                :class="{ 'is-invalid': errors.group_id }">
                            <option value="" disabled>Choisir un groupe...</option>
                            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                        </select>
                        <div v-if="errors.group_id" class="invalid-feedback">{{ errors.group_id }}</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Motif de la dépense</label>
                        <input type="text" v-model="form.reason" class="form-control"
                               :class="{ 'is-invalid': errors.reason }"
                               placeholder="Ex: Billets de train">
                        <div v-if="errors.reason" class="invalid-feedback">{{ errors.reason }}</div>
                    </div>

                    <div class="mb-3 row g-2">
                        <div class="col-8">
                            <label class="form-label text-muted fw-bold" style="font-size: 13px;">Montant</label>
                            <input type="number" v-model="form.amount" class="form-control"
                                   :class="{ 'is-invalid': errors.amount }"
                                   placeholder="0.00" step="0.01" min="0">
                            <div v-if="errors.amount" class="invalid-feedback">{{ errors.amount }}</div>
                        </div>
                        <div class="col-4">
                            <label class="form-label text-muted fw-bold" style="font-size: 13px;">Devise</label>
                            <input type="text" class="form-control" value="€" readonly>
                        </div>
                    </div>

                    <div class="mb-4">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Date du paiement</label>
                        <input type="date" v-model="form.expense_date" class="form-control"
                               :class="{ 'is-invalid': errors.expense_date }">
                        <div v-if="errors.expense_date" class="invalid-feedback">{{ errors.expense_date }}</div>
                    </div>

                    <div class="mb-4">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Payé par</label>
                        <select v-model="form.payer_id" class="form-select"
                                :class="{ 'is-invalid': errors.payer_id }">
                            <option value="" disabled>Choisir un membre...</option>
                            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
                        </select>
                        <div v-if="errors.payer_id" class="invalid-feedback">{{ errors.payer_id }}</div>
                    </div>

                    <button type="submit" class="btn btn-primary-custom mt-2"
                            :disabled="groups.length === 0 || submitting">
                        <span v-if="submitting">
                            <span class="spinner-border spinner-border-sm me-1"></span>Enregistrement...
                        </span>
                        <span v-else>VALIDER LA DÉPENSE</span>
                    </button>
                    <p v-if="groups.length === 0" class="text-danger small mt-2">
                        Créez d'abord un groupe dans l'onglet "Groupes" !
                    </p>

                </form>
            </div>

            <div style="height: 80px;" class="d-lg-none"></div>
        </div>
    `,

    mounted() {
        // Flux → deux requêtes GET au chargement du composant :
        // get_groups : remplit le menu déroulant "Dans quel groupe ?"
        // get_users  : remplit le menu déroulant "Payé par"
        // Flux retour ← tableaux JSON → Vue peuple les <option> via v-for
        fetch('api/backend.php?action=get_groups')
            .then(res => res.json())
            .then(data => { this.groups = Array.isArray(data) ? data : []; })
            .catch(() => {});

        fetch('api/backend.php?action=get_users')
            .then(res => res.json())
            .then(data => { this.users = Array.isArray(data) ? data : []; })
            .catch(() => {});
    },

    methods: {
        validate() {
            this.errors = {};
            if (!this.form.group_id)
                this.errors.group_id = 'Veuillez choisir un groupe.';
            if (!this.form.reason || this.form.reason.trim().length < 2)
                this.errors.reason = 'Le motif doit contenir au moins 2 caractères.';
            if (!this.form.amount || parseFloat(this.form.amount) <= 0)
                this.errors.amount = 'Le montant doit être supérieur à 0.';
            if (!this.form.expense_date)
                this.errors.expense_date = 'Veuillez indiquer une date.';
            if (!this.form.payer_id)
                this.errors.payer_id = 'Veuillez choisir un payeur.';
            return Object.keys(this.errors).length === 0;
        },

        async submitForm() {
            if (!this.validate()) return; // Stoppe si le formulaire contient des erreurs
            this.submitting = true;

            // Flux → FormData envoyé en POST vers backend.php?action=add_depense
            // Le backend vérifie la session, nettoie chaque champ, puis INSERT INTO expenses
            const fd = new FormData();
            fd.append('group_id',     this.form.group_id);
            fd.append('payer_id',     this.form.payer_id);
            fd.append('amount',       this.form.amount);
            fd.append('reason',       this.form.reason.trim());
            fd.append('expense_date', this.form.expense_date);
            try {
                const res  = await fetch('api/backend.php?action=add_depense', { method: 'POST', body: fd });
                const data = await res.json();
                // Flux retour ← JSON { success: true } → toast de succès + retour au tableau de bord
                if (data.success) {
                    this.$parent.showToast('Dépense ajoutée avec succès !', 'success');
                    this.$parent.currentPage = 'home';
                } else {
                    this.$parent.showToast(data.error || "Erreur lors de l'ajout.", 'danger');
                }
            } catch {
                this.$parent.showToast('Erreur réseau.', 'danger');
            }
            this.submitting = false;
        }
    }
};
