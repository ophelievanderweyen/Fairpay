/* =========================================================================
   GROUPES.JS — Composant "Mes Groupes"
   Flux traités : Flux 3 (liste) · Flux 6 (suppression) · Flux 11 (détails)
                  Flux 12 (ajouter membre) · Flux 13 (remboursement)

   TABLE DES MATIÈRES
   ──────────────────────────────────────────────────────────────────────
    1.  Data
          Flux 3     groups
          Flux 11    selectedGroup · groupExpenses · groupTotals
                     groupMembers · groupSettlements
          Flux 12    allUsers · newMemberId · showAddMember
    2.  Computed
          Flux 11/13  suggestedDebts  (algorithme glouton de répartition)
    3.  Template
          Liste des groupes  :  Flux 3 (carte cliquable) · Flux 6 (bouton supprimer)
          Panneau de détail  :  Flux 11
            └─ Totaux par membre
            └─ Dépenses du groupe
            └─ Membres + ajout      Flux 12
            └─ Remboursements       Flux 13
    4.  Mounted  .....  fetchGroups (Flux 3)
    5.  Méthodes
          Flux 3    fetchGroups
          Flux 6    deleteGroup
          Flux 11   selectGroup
          Flux 12   addMember
          Flux 13   recordSettlement
          Util      formatDate
   ──────────────────────────────────────────────────────────────────────
========================================================================= */

const GroupesPage = {

    /* =========================================================================
       AUCUN FLUX — Données internes du composant
       ========================================================================= */
    data() {
        return {
            /* -----------------------------------------------------------------
               FLUX N°3 — Liste de tous les groupes affichés dans la page
               ----------------------------------------------------------------- */
            groups: [],

            /* -----------------------------------------------------------------
               FLUX N°11 — Données du groupe sélectionné et de son panneau de détail
               ----------------------------------------------------------------- */
            selectedGroup:    null,  // Groupe actuellement ouvert (null = panneau fermé)
            groupExpenses:    [],    // Dépenses du groupe sélectionné (avec noms payeurs)
            groupTotals:      [],    // Total avancé par membre dans ce groupe
            groupMembers:     [],    // Liste des membres du groupe
            groupSettlements: [],    // Historique des remboursements enregistrés

            /* -----------------------------------------------------------------
               FLUX N°12 — Variables pour l'ajout d'un membre
               ----------------------------------------------------------------- */
            allUsers:      [],    // Tous les utilisateurs de l'appli (pour le menu déroulant)
            newMemberId:   '',    // ID de l'utilisateur sélectionné dans le menu
            showAddMember: false  // Bascule l'affichage du formulaire d'ajout
        }
    },

    /* =========================================================================
       FLUX N°11 & 13 : DÉTAILS GROUPE — Calcul des remboursements suggérés
       Algorithme glouton : calcule qui doit quoi à qui d'après les dépenses du groupe
       Flux : groupTotals[] + groupMembers[] → computed → v-for dans le template (Flux 13)
       ========================================================================= */
    computed: {
        suggestedDebts() {
            if (this.groupTotals.length === 0) return [];
            const n         = this.groupMembers.length > 0 ? this.groupMembers.length : this.groupTotals.length;
            const total     = this.groupTotals.reduce((sum, t) => sum + parseFloat(t.total_avance), 0);
            const fairShare = total / n;

            // Initialise le solde de chaque membre à -fairShare (ils "doivent" leur part)
            const balances = {};
            if (this.groupMembers.length > 0) {
                this.groupMembers.forEach(m => { balances[m.name] = -fairShare; });
            }
            // Ajoute ce que chaque personne a réellement payé
            this.groupTotals.forEach(t => {
                if (balances[t.nom_payeur] !== undefined) {
                    balances[t.nom_payeur] += parseFloat(t.total_avance);
                } else {
                    balances[t.nom_payeur] = parseFloat(t.total_avance) - fairShare;
                }
            });

            // Sépare les créditeurs (solde positif) des débiteurs (solde négatif)
            const creditors = [], debtors = [];
            Object.entries(balances).forEach(([name, net]) => {
                if (net > 0.01)   creditors.push({ name, amount: net });
                else if (net < -0.01) debtors.push({ name, amount: -net });
            });

            // Algorithme glouton : associe chaque débiteur au créditeur disponible
            const settlements = [];
            let i = 0, j = 0;
            while (i < debtors.length && j < creditors.length) {
                const amount = Math.min(debtors[i].amount, creditors[j].amount);
                settlements.push({
                    from:   debtors[i].name,
                    to:     creditors[j].name,
                    amount: Math.round(amount * 100) / 100
                });
                debtors[i].amount   -= amount;
                creditors[j].amount -= amount;
                if (debtors[i].amount   < 0.01) i++;
                if (creditors[j].amount < 0.01) j++;
            }
            return settlements;
        }
    },

    /* =========================================================================
       TEMPLATE — Interface utilisateur complète de la page Groupes
       ========================================================================= */
    template: `
        <div class="p-4">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="fw-bold mb-0">Mes Groupes</h4>
                <button class="btn btn-primary rounded-pill btn-sm" @click="$parent.currentPage = 'nouveauGroupe'">
                    <i class="bi bi-plus-lg"></i> Nouveau
                </button>
            </div>

            <!-- ================================================================
                 FLUX N°3 — Liste des groupes
                 Chaque carte est cliquable (Flux n°11) et possède un bouton supprimer (Flux n°6)
                 ================================================================ -->
            <div v-for="g in groups" :key="g.id"
                 class="light-card p-3 mb-2 d-flex justify-content-between align-items-center group-card-item"
                 :class="{ 'group-card-active': selectedGroup && selectedGroup.id === g.id }"
                 @click="selectGroup(g)">
                <div class="d-flex align-items-center" style="flex-grow: 1;">
                    <div class="group-icon-badge me-3">
                        <i class="bi bi-people-fill"></i>
                    </div>
                    <div>
                        <span class="fw-bold text-dark d-block">{{ g.name }}</span>
                        <small class="text-muted">{{ g.description || 'Pas de description' }}</small>
                    </div>
                </div>
                <!-- Flux n°6 — Bouton supprimer : .stop empêche d'ouvrir le panneau de détail -->
                <button class="btn btn-link text-danger p-0 ms-3" @click.stop="deleteGroup(g.id)">
                    <i class="bi bi-trash3"></i>
                </button>
            </div>

            <!-- ================================================================
                 FLUX N°11 — Panneau de détail du groupe sélectionné
                 Visible uniquement si selectedGroup n'est pas null
                 ================================================================ -->
            <div v-if="selectedGroup" class="light-card p-4 mt-4">

                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5 class="fw-bold mb-0">
                        <i class="bi bi-collection-fill text-primary me-2"></i>{{ selectedGroup.name }}
                    </h5>
                    <button class="btn btn-outline-secondary btn-sm" @click="selectedGroup = null">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>

                <!-- Flux n°11 — Requête 1 : Total avancé par membre -->
                <h6 class="section-label mb-3">Total avancé par membre</h6>
                <div v-if="groupTotals.length === 0" class="text-muted small mb-4">Aucune dépense enregistrée.</div>
                <div v-else class="totals-list mb-4">
                    <div v-for="t in groupTotals" :key="t.nom_payeur" class="total-row">
                        <div class="d-flex align-items-center gap-2">
                            <span class="payer-badge">{{ t.nom_payeur.charAt(0).toUpperCase() }}</span>
                            <span class="fw-bold">{{ t.nom_payeur }}</span>
                        </div>
                        <span class="fw-bold text-primary">{{ t.total_avance }} €</span>
                    </div>
                </div>

                <hr class="my-3">

                <!-- Flux n°11 — Requête 2 : Dépenses du groupe avec nom du payeur -->
                <h6 class="section-label mb-3">Dépenses du groupe</h6>
                <div v-if="groupExpenses.length === 0" class="text-muted small mb-4">Aucune dépense pour ce groupe.</div>
                <div v-else class="expenses-table-wrapper mb-4">
                    <table class="expenses-table">
                        <thead>
                            <tr>
                                <th>Motif</th>
                                <th>Payé par</th>
                                <th>Montant</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(e, i) in groupExpenses" :key="i">
                                <td class="fw-bold">{{ e.reason }}</td>
                                <td><span class="payer-badge">{{ e.payeur }}</span></td>
                                <td class="fw-bold text-primary">{{ e.amount }} €</td>
                                <td class="text-muted">{{ formatDate(e.expense_date) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <hr class="my-3">

                <!-- Flux n°11 — Requête 3 + Flux n°12 : Membres du groupe + ajout de membre -->
                <h6 class="section-label mb-3">Membres du groupe</h6>
                <div class="d-flex flex-wrap gap-2 mb-3">
                    <span v-if="groupMembers.length === 0" class="text-muted small">Aucun membre enregistré.</span>
                    <span v-for="m in groupMembers" :key="m.email"
                          class="badge bg-light text-dark border px-2 py-1" style="font-size: 13px;">
                        <span class="payer-badge me-1" style="font-size: 11px; padding: 2px 5px;">
                            {{ m.name.charAt(0).toUpperCase() }}
                        </span>{{ m.name }}
                    </span>
                </div>

                <!-- Flux n°12 — Formulaire d'ajout de membre (toggle) -->
                <div v-if="!showAddMember">
                    <button class="btn btn-outline-primary btn-sm" @click="showAddMember = true">
                        <i class="bi bi-person-plus-fill me-1"></i>Ajouter un membre
                    </button>
                </div>
                <div v-else class="d-flex gap-2 align-items-center flex-wrap mt-1">
                    <select v-model="newMemberId" class="form-select form-select-sm" style="max-width: 200px;">
                        <option value="" disabled>Choisir...</option>
                        <option v-for="u in allUsers" :key="u.id" :value="u.id">{{ u.name }}</option>
                    </select>
                    <button class="btn btn-primary btn-sm" @click="addMember" :disabled="!newMemberId">Ajouter</button>
                    <button class="btn btn-outline-secondary btn-sm" @click="showAddMember = false; newMemberId = ''">Annuler</button>
                </div>

                <hr class="my-3">

                <!-- Flux n°11 (calcul) + Flux n°13 (enregistrement) — Remboursements -->
                <h6 class="section-label mb-3">Remboursements</h6>

                <div v-if="suggestedDebts.length === 0 && groupTotals.length > 0" class="text-success small mb-3">
                    <i class="bi bi-check-circle-fill me-1"></i>Tout est équilibré !
                </div>

                <!-- Flux n°13 — Remboursements suggérés par l'algorithme glouton -->
                <div v-if="suggestedDebts.length > 0" class="mb-3">
                    <p class="text-muted small mb-2 fw-bold">Remboursements suggérés :</p>
                    <div v-for="(debt, i) in suggestedDebts" :key="i"
                         class="d-flex align-items-center justify-content-between mb-2 p-2 rounded"
                         style="background: #f8f9fa; border: 1px solid #e9ecef;">
                        <span class="small">
                            <span class="payer-badge me-1" style="font-size: 11px; padding: 2px 5px;">
                                {{ debt.from.charAt(0).toUpperCase() }}
                            </span>
                            <strong>{{ debt.from }}</strong> doit
                            <strong class="text-primary">{{ debt.amount }} €</strong> à
                            <span class="payer-badge mx-1" style="font-size: 11px; padding: 2px 5px;">
                                {{ debt.to.charAt(0).toUpperCase() }}
                            </span>
                            <strong>{{ debt.to }}</strong>
                        </span>
                        <button class="btn btn-sm btn-success ms-2"
                                @click="recordSettlement(debt.from, debt.to, debt.amount)"
                                title="Marquer comme remboursé">
                            <i class="bi bi-check2 me-1"></i>Remboursé
                        </button>
                    </div>
                </div>

                <!-- Flux n°11 — Requête 4 : Historique des remboursements enregistrés -->
                <div v-if="groupSettlements.length > 0">
                    <p class="text-muted small mb-2 fw-bold">Historique :</p>
                    <div v-for="(s, i) in groupSettlements" :key="i"
                         class="text-muted small mb-1 d-flex align-items-center gap-1">
                        <i class="bi bi-arrow-right-circle-fill text-success"></i>
                        <span>{{ s.a_paye }} → {{ s.a_recu }} :
                            <strong class="text-dark">{{ s.amount }} €</strong>
                            ({{ formatDate(s.settlement_date) }})
                        </span>
                    </div>
                </div>
                <div v-if="groupSettlements.length === 0 && groupTotals.length === 0" class="text-muted small">
                    Aucune dépense dans ce groupe.
                </div>

            </div>

            <div style="height: 80px;" class="d-lg-none"></div>
        </div>
    `,

    /* =========================================================================
       FLUX N°3 : AFFICHER LES GROUPES — Chargement initial au montage
       ========================================================================= */
    mounted() {
        this.fetchGroups();
    },

    methods: {

        /* =========================================================================
           FLUX N°3 : AFFICHER LES GROUPES — Chargement de la liste des groupes
           Flux : GET backend.php?action=get_groups → SELECT * FROM groups ORDER BY created_at DESC
                  → JSON → groups[] → v-for affiche la liste
           ========================================================================= */
        fetchGroups() {
            fetch('api/backend.php?action=get_groups')
                .then(res => res.json())
                .then(data => { this.groups = data; });
        },

        /* =========================================================================
           FLUX N°6 : SUPPRIMER UN GROUPE
           Flux : clic poubelle → confirm() → FormData → POST delete_group
                  → backend DELETE FROM groups WHERE id = :id
                  → toast + fetchGroups() rafraîchit la liste
           ========================================================================= */
        deleteGroup(id) {
            if (confirm("Supprimer ce groupe ?")) {
                const formData = new FormData();
                formData.append('id', id);
                fetch('api/backend.php?action=delete_group', { method: 'POST', body: formData })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            this.$parent.showToast('Groupe supprimé.', 'success');
                        } else {
                            this.$parent.showToast('Erreur lors de la suppression.', 'danger');
                        }
                        // Referme le panneau si c'est le groupe supprimé qui était ouvert
                        if (this.selectedGroup && this.selectedGroup.id === id) this.selectedGroup = null;
                        this.fetchGroups(); // Flux 3 : recharge la liste sans le groupe supprimé
                    })
                    .catch(() => { this.$parent.showToast('Erreur réseau.', 'danger'); });
            }
        },

        /* =========================================================================
           FLUX N°11 : CONSULTER LES DÉTAILS D'UN GROUPE (4 requêtes ciblées)
           Flux : clic carte groupe → selectGroup(g) → vide les données précédentes
                  → 4 GET simultanés : dépenses nommées, totaux, membres, remboursements
                  → panneau de détail s'affiche (v-if="selectedGroup")
           ========================================================================= */
        selectGroup(group) {
            // Referme le panneau si on reclique sur le même groupe
            if (this.selectedGroup && this.selectedGroup.id === group.id) {
                this.selectedGroup = null;
                return;
            }
            // Vide les données précédentes pour éviter d'afficher l'ancien groupe pendant le chargement
            this.selectedGroup    = group;
            this.groupExpenses    = [];
            this.groupTotals      = [];
            this.groupMembers     = [];
            this.groupSettlements = [];
            this.showAddMember    = false;
            this.newMemberId      = '';

            // Requête 1 — Dépenses du groupe avec le nom du payeur (JOIN users)
            fetch(`api/backend.php?action=get_group_expenses_named&group_id=${group.id}`)
                .then(res => res.json())
                .then(data => { this.groupExpenses = Array.isArray(data) ? data : []; });

            // Requête 2 — Total avancé par membre (SUM par payer_id)
            fetch(`api/backend.php?action=get_group_totals&group_id=${group.id}`)
                .then(res => res.json())
                .then(data => { this.groupTotals = Array.isArray(data) ? data : []; });

            // Requête 3 — Membres du groupe (JOIN participations)
            fetch(`api/backend.php?action=get_group_members&group_id=${group.id}`)
                .then(res => res.json())
                .then(data => { this.groupMembers = Array.isArray(data) ? data : []; });

            // Requête 4 — Remboursements enregistrés (double JOIN users)
            fetch(`api/backend.php?action=get_group_settlements&group_id=${group.id}`)
                .then(res => res.json())
                .then(data => { this.groupSettlements = Array.isArray(data) ? data : []; });

            // Charge tous les utilisateurs si pas encore fait (nécessaire pour Flux 12 et 13)
            if (this.allUsers.length === 0) {
                fetch('api/backend.php?action=get_users')
                    .then(res => res.json())
                    .then(data => { this.allUsers = Array.isArray(data) ? data : []; });
            }
        },

        /* =========================================================================
           FLUX N°12 : AJOUTER UN MEMBRE À UN GROUPE
           Flux : sélection utilisateur → clic "Ajouter" → FormData → POST add_member
                  → backend INSERT IGNORE INTO participations (user_id, group_id)
                  → toast + recharge groupMembers[] pour rafraîchir les badges
           ========================================================================= */
        async addMember() {
            if (!this.newMemberId) return;

            const fd = new FormData();
            fd.append('user_id',  this.newMemberId);
            fd.append('group_id', this.selectedGroup.id);
            const res  = await fetch('api/backend.php?action=add_member', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                this.$parent.showToast('Membre ajouté au groupe !', 'success');
                this.newMemberId   = '';
                this.showAddMember = false;
                // Flux retour ← recharge uniquement les membres pour mettre à jour les badges
                fetch(`api/backend.php?action=get_group_members&group_id=${this.selectedGroup.id}`)
                    .then(r => r.json())
                    .then(d => { this.groupMembers = Array.isArray(d) ? d : []; });
            } else {
                this.$parent.showToast(data.error || "Erreur lors de l'ajout.", 'danger');
            }
        },

        /* =========================================================================
           FLUX N°13 : ENREGISTRER UN REMBOURSEMENT (SETTLEMENT)
           Flux : clic "Remboursé" (dette suggérée) → traduit noms en IDs via allUsers.find()
                  → FormData → POST add_settlement
                  → backend INSERT INTO settlements avec la date du jour
                  → toast + recharge groupSettlements[] pour mettre à jour l'historique
           ========================================================================= */
        async recordSettlement(fromName, toName, amount) {
            // Traduit les noms en IDs numériques (nécessaires pour les clés étrangères en BDD)
            const sender   = this.allUsers.find(u => u.name === fromName);
            const receiver = this.allUsers.find(u => u.name === toName);
            if (!sender || !receiver) return;

            const fd = new FormData();
            fd.append('group_id',    this.selectedGroup.id);
            fd.append('sender_id',   sender.id);
            fd.append('receiver_id', receiver.id);
            fd.append('amount',      amount);
            const res  = await fetch('api/backend.php?action=add_settlement', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                this.$parent.showToast('Remboursement enregistré !', 'success');
                // Flux retour ← recharge uniquement l'historique pour mettre à jour la liste
                fetch(`api/backend.php?action=get_group_settlements&group_id=${this.selectedGroup.id}`)
                    .then(r => r.json())
                    .then(d => { this.groupSettlements = Array.isArray(d) ? d : []; });
            } else {
                this.$parent.showToast("Erreur lors de l'enregistrement.", 'danger');
            }
        },

        /* =========================================================================
           AUCUN FLUX — Utilitaire : conversion de date SQL → format lisible
           ========================================================================= */
        formatDate(dateStr) {
            if (!dateStr) return '';
            const [y, m, d] = dateStr.split('-');
            return d + '/' + m + '/' + y;
        }
    }
};
