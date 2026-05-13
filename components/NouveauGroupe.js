/* =========================================================================
   NOUVEAUGROUPE.JS — Composant "Créer un groupe"
   Flux traités : Flux 3 (chargement des utilisateurs)
                  Flux 4 (création de groupe + ajout de membres)

   TABLE DES MATIÈRES
   ──────────────────────────────────────────────────────────────────────
    1.  Data
          Flux 3    users  (liste des autres membres disponibles)
          Flux 4    form { name, description, members } · errors · submitting
    2.  Template  .....  Formulaire : nom · description (compteur 200 car.)
                                     membres (cases à cocher)
    3.  Mounted  .....  Chargement des utilisateurs sans soi-même (Flux 3 + 4)
    4.  Méthodes
          Flux 4    validate · submitForm
   ──────────────────────────────────────────────────────────────────────
========================================================================= */

const NouveauGroupePage = {

    /* =========================================================================
       AUCUN FLUX — Données internes du composant
       ========================================================================= */
    data() {
        return {
            // Flux 4 : champs du formulaire liés aux inputs via v-model
            form: { name: '', description: '', members: [] },
            // Flux 4 : messages d'erreur de validation affichés sous chaque champ
            errors: {},
            // Flux 4 : passe à true pendant l'envoi pour désactiver le bouton
            submitting: false,
            users: [] // Liste des autres utilisateurs
        }
    },

    /* =========================================================================
       FLUX N°3 + N°4 : CHARGEMENT DES UTILISATEURS — Préparation du formulaire
       Flux : montage → GET get_users → filtre l'utilisateur courant (soi-même)
              → users[] peuple les cases à cocher pour sélectionner les membres
              Le créateur du groupe est ajouté automatiquement côté backend (Flux 4)
       ========================================================================= */
    async mounted() {
        try {
            const res = await fetch('api/backend.php?action=get_users');
            let allUsers = await res.json();
            const myId = this.$parent.currentUser.id;
            // On retire l'utilisateur connecté : il sera ajouté automatiquement par le backend
            this.users = allUsers.filter(u => u.id !== myId);
        } catch (err) {
            console.error("Erreur chargement utilisateurs:", err);
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

                    <div class="mb-4">
                        <label class="form-label small fw-bold text-muted">AJOUTER DES MEMBRES</label>
                        <div class="border rounded p-2" style="max-height: 150px; overflow-y: auto; background: white;">
                            <div v-for="user in users" :key="user.id" class="form-check mb-1">
                                <input class="form-check-input" type="checkbox" :value="user.id" :id="'user_' + user.id" v-model="form.members">
                                <label class="form-check-label" :for="'user_' + user.id">
                                    {{ user.name }}
                                </label>
                            </div>
                            <div v-if="users.length === 0" class="text-muted small p-1">
                                Aucun autre utilisateur trouvé.
                            </div>
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
            fd.append('members',     JSON.stringify(this.form.members));
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
