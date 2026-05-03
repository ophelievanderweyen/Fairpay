// NouveauGroupe.js — Composant "Créer un groupe"
// Flux général : formulaire HTML ↔ v-model ↔ form{} → validate() → POST backend.php → toast + retour groupes
const NouveauGroupePage = {
    data() {
        return {
            form: { name: '', description: '' },
            errors: {},
            submitting: false
        }
    },

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
        validate() {
            this.errors = {};
            if (!this.form.name || this.form.name.trim().length < 2)
                this.errors.name = 'Le nom doit contenir au moins 2 caractères.';
            if (this.form.description && this.form.description.length > 200)
                this.errors.description = 'La description ne peut pas dépasser 200 caractères.';
            return Object.keys(this.errors).length === 0;
        },

        async submitForm() {
            if (!this.validate()) return; // Stoppe si le formulaire contient des erreurs

            this.submitting = true;

            // Flux → FormData envoyé en POST vers backend.php?action=add_group
            // Le backend INSERT dans groups, puis INSERT dans participations pour le créateur
            const fd = new FormData();
            fd.append('name',        this.form.name.trim());
            fd.append('description', this.form.description.trim());
            try {
                const res  = await fetch('api/backend.php?action=add_group', { method: 'POST', body: fd });
                const data = await res.json();
                // Flux retour ← JSON { success: true } → toast + retour à la page Groupes
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
