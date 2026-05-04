// NouveauGroupe.js — Composant "Créer un groupe"
// Contient : Flux n°4 (Ajouter un groupe)

const NouveauGroupePage = {

    /* =========================================================================
       AUCUN FLUX — Données internes du composant
       ========================================================================= */
    data() {
        return {
            // Flux 4 : champs du formulaire liés aux inputs via v-model
            form: { name: '', description: '' },
            // Flux 4 : messages d'erreur de validation affichés sous chaque champ
            errors: {},
            // Flux 4 : passe à true pendant l'envoi pour désactiver le bouton
            submitting: false
        }
    },

    /* =========================================================================
       FLUX N°4 : AJOUTER UN GROUPE — Template (interface utilisateur)
       Flux : saisie du formulaire → @submit.prevent="submitForm"
              → validate() → POST add_group → toast + retour page Groupes
       ========================================================================= */
    template: `
        <div class="p-4">
            <div class="top-bar mb-4">
                <button class="back-btn" @click="$parent.currentPage = 'groupes'" style="background:none; border:none;">
                    <i class="bi bi-chevron-left"></i>
                </button>
                <h4 class="fw-bold mb-0">Créer un groupe</h4>
            </div>
            <div class="light-card">
                <form @submit.prevent="submitForm" novalidate>

                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted">NOM DU GROUPE</label>
                        <input type="text" v-model="form.name" class="form-control"
                               :class="{ 'is-invalid': errors.name }"
                               placeholder="Ex: Coloc 2026">
                        <div v-if="errors.name" class="invalid-feedback">{{ errors.name }}</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted">DESCRIPTION</label>
                        <textarea v-model="form.description" class="form-control"
                                  :class="{ 'is-invalid': errors.description }"
                                  rows="3" placeholder="Optionnel..."></textarea>
                        <div v-if="errors.description" class="invalid-feedback">{{ errors.description }}</div>
                        <div class="form-text text-end small"
                             :class="form.description.length > 180 ? 'text-danger' : 'text-muted'">
                            {{ form.description.length }}/200
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary-custom" :disabled="submitting">
                        <span v-if="submitting">
                            <span class="spinner-border spinner-border-sm me-1"></span>Création...
                        </span>
                        <span v-else>CRÉER</span>
                    </button>

                </form>
            </div>
        </div>
    `,

    methods: {

        /* =========================================================================
           FLUX N°4 : AJOUTER UN GROUPE — Validation du formulaire
           Vérifie les règles métier avant d'envoyer la requête au serveur
           ========================================================================= */
        validate() {
            this.errors = {};
            if (!this.form.name || this.form.name.trim().length < 2)
                this.errors.name = 'Le nom doit contenir au moins 2 caractères.';
            if (this.form.description && this.form.description.length > 200)
                this.errors.description = 'La description ne peut pas dépasser 200 caractères.';
            return Object.keys(this.errors).length === 0;
        },

        /* =========================================================================
           FLUX N°4 : AJOUTER UN GROUPE — Envoi du formulaire
           Flux : validate() OK → FormData → POST backend.php?action=add_group
                  → backend INSERT INTO groups + INSERT INTO participations (créateur)
                  → JSON { success: true } → toast + retour page Groupes
           ========================================================================= */
        async submitForm() {
            if (!this.validate()) return;

            this.submitting = true;

            const fd = new FormData();
            fd.append('name',        this.form.name.trim());
            fd.append('description', this.form.description.trim());
            try {
                const res  = await fetch('api/backend.php?action=add_group', { method: 'POST', body: fd });
                const data = await res.json();
                if (data.success) {
                    this.$parent.showToast('Groupe créé avec succès !', 'success');
                    this.$parent.currentPage = 'groupes';
                } else {
                    this.$parent.showToast(data.error || 'Erreur lors de la création.', 'danger');
                }
            } catch {
                this.$parent.showToast('Erreur réseau.', 'danger');
            }
            this.submitting = false;
        }
    }
};
