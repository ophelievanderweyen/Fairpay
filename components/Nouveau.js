/* =========================================================================
   NOUVEAU.JS — Composant "Nouvelle dépense"
   Flux traités : Flux 3  (groupes et utilisateurs)
                  Flux 5  (ajout dépense)

   TABLE DES MATIÈRES
   ──────────────────────────────────────────────────────────────────────
    1.  Data
          Flux 3    groups · users
          Flux 5    form { group_id, reason, amount, expense_date, payer_id }
                    errors · submitting
    2.  Template  .....  Formulaire : groupe · motif · montant · date · payeur
    3.  Mounted  ......  Chargement parallèle  get_groups + get_users  (Flux 3)
    4.  Méthodes
          Flux 5    validate · submitForm
   ──────────────────────────────────────────────────────────────────────
========================================================================= */

const NouveauPage = {

    /* =========================================================================
       AUCUN FLUX — Données internes du composant
       ========================================================================= */
    data() {
        return {
            // Flux 3 : liste des groupes pour le menu déroulant (chargée au montage)
            groups: [],
            // Flux 5 : liste des utilisateurs pour le menu "Payé par" (chargée au montage)
            users: [],
            // Flux 5 : champs du formulaire liés aux inputs via v-model
            form: {
                group_id:     '',
                reason:       '',
                amount:       '',
                expense_date: '',
                payer_id:     ''
            },
            // Flux 5 : messages d'erreur de validation affichés sous chaque champ
            errors: {},
            // Flux 5 : passe à true pendant l'envoi pour désactiver le bouton
            submitting: false
        }
    },

    /* =========================================================================
       FLUX N°5 : AJOUTER UNE DÉPENSE — Template (interface utilisateur)
       Les menus déroulants "Groupe" et "Payé par" sont peuplés dynamiquement
       depuis la base de données (Flux 3), pas en dur dans le code
       ========================================================================= */
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

                    <!-- Flux n°3 : groupes chargés depuis get_groups au montage -->
                    <div class="mb-3">
                        <label class="form-label text-muted fw-bold" style="font-size: 13px;">Dans quel groupe ?</label>
                        <select v-model="form.group_id" class="form-select"
                                :class="{ 'is-invalid': errors.group_id }">
                            <option value="" disabled>Choisir un groupe...</option>
                            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                        </select>
                        <div v-if="errors.group_id" class="invalid-feedback">{{ errors.group_id }}</div>
                    </div>

                    <!-- Flux n°5 : champs de la dépense -->
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

                    <!-- Flux n°3 : utilisateurs chargés depuis get_users au montage (plus de noms hardcodés) -->
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

    /* =========================================================================
       FLUX N°3 : AFFICHER LES GROUPES — Chargement des groupes au montage
       FLUX N°5 : AJOUTER UNE DÉPENSE — Chargement des utilisateurs au montage
       Flux : montage du composant → deux GET simultanés
              → get_groups → groups[] (menu "Dans quel groupe ?")
              → get_users  → users[]  (menu "Payé par")
       ========================================================================= */
    mounted() {
        // Flux 3 : charge les groupes pour le menu déroulant
        fetch('api/backend.php?action=get_groups')
            .then(res => res.json())
            .then(data => { this.groups = Array.isArray(data) ? data : []; })
            .catch(() => {});

        // Flux 5 : charge les utilisateurs pour le menu déroulant "Payé par"
        fetch('api/backend.php?action=get_users')
            .then(res => res.json())
            .then(data => { this.users = Array.isArray(data) ? data : []; })
            .catch(() => {});
    },

    methods: {

        /* =========================================================================
           FLUX N°5 : AJOUTER UNE DÉPENSE — Validation du formulaire
           Vérifie chaque champ avant l'envoi et stocke les erreurs dans errors{}
           ========================================================================= */
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

        /* =========================================================================
           FLUX N°5 : AJOUTER UNE DÉPENSE — Envoi du formulaire
           Flux : @submit.prevent → validate() → FormData → POST add_depense
                  → backend INSERT INTO expenses + expense_participants (Flux 16)
                  → JSON { success: true } → toast + retour 'home' (déclenche Flux n°9)
           ========================================================================= */
        async submitForm() {
            if (!this.validate()) return;
            this.submitting = true;

            const fd = new FormData();
            fd.append('group_id',     this.form.group_id);
            fd.append('payer_id',     this.form.payer_id);
            fd.append('amount',       this.form.amount);
            fd.append('reason',       this.form.reason.trim());
            fd.append('expense_date', this.form.expense_date);
            try {
                const res  = await fetch('api/backend.php?action=add_depense', { method: 'POST', body: fd });
                const data = await res.json();
                // Flux retour ← succès → retour 'home' relance automatiquement le Flux n°9 (Dashboard)
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
