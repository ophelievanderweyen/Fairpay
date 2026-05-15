/* =========================================================================
   GROUPES.JS — Composant "Mes Groupes"
   Flux traités : Flux 3  (liste groupes)
                  Flux 11 (détails groupe)      · Flux 12 (ajouter membre)
                  Flux 16 (soldes avec participants)

   TABLE DES MATIÈRES
   ──────────────────────────────────────────────────────────────────────
    1.  Data
          Flux 3     groups
          Flux 11    selectedGroup · groupExpenses · groupMembers
          Flux 16    groupBalances
    2.  Computed
          Flux 16    suggestedDebts  (algorithme glouton — qui doit quoi)
    3.  Template
          Liste des groupes  :  Flux 3 (carte cliquable)
          Panneau de détail  :  Flux 11
            └─ Dépenses du groupe
            └─ Membres
            └─ Qui doit quoi ?      Flux 16
    4.  Mounted  .....  fetchGroups (Flux 3)
    5.  Méthodes
          Flux 3    fetchGroups
          Flux 11   selectGroup
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
            groupMembers:     [],    // Liste des membres du groupe

            /* -----------------------------------------------------------------
               FLUX N°16 — Soldes nets par membre calculés avec les participants réels
               Remplace le calcul historique en parts égales
               ----------------------------------------------------------------- */
            groupBalances: []
        }
    },

    /* =========================================================================
       FLUX N°16 : QUI DOIT QUOI ? — Algorithme glouton
       Utilise groupBalances (soldes nets avec participants réels) fournis par
       get_group_balances. Associe chaque débiteur au créditeur disponible le plus grand.
       Flux : groupBalances[] → computed → v-for dans le template
       ========================================================================= */
    computed: {
        suggestedDebts() {
            if (this.groupBalances.length === 0) return [];

            // Sépare les créditeurs (solde > 0, on leur doit de l'argent)
            // des débiteurs (solde < 0, ils doivent de l'argent)
            const creditors = [], debtors = [];
            this.groupBalances.forEach(b => {
                const net = parseFloat(b.net_balance);
                if      (net >  0.01) creditors.push({ name: b.name, amount:  net });
                else if (net < -0.01) debtors.push(  { name: b.name, amount: -net });
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
            </div>

            <!-- ================================================================
                 FLUX N°11 — Panneau de détail du groupe sélectionné
                 Visible uniquement si selectedGroup n'est pas null
                 ================================================================ -->
            <div v-if="selectedGroup" class="light-card p-4 mt-4">

                <!-- En-tête du panneau : nom du groupe + bouton fermer -->
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <h5 class="fw-bold mb-1">
                            <i class="bi bi-collection-fill text-primary me-2"></i>{{ selectedGroup.name }}
                        </h5>
                        <p v-if="selectedGroup.description" class="text-muted small mb-0">{{ selectedGroup.description }}</p>
                    </div>
                    <button class="btn btn-outline-secondary btn-sm" @click="selectedGroup = null">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>

                <hr class="my-3">

                <!-- Flux n°11 — Requête 1 : Dépenses du groupe avec nom du payeur -->
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

                <!-- Flux n°11 — Requête 2 : Membres du groupe -->
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

                <hr class="my-3">

                <!-- Flux n°16 — Qui doit quoi ? (algorithme glouton sur soldes participants réels) -->
                <h6 class="section-label mb-3">Qui doit quoi ?</h6>

                <div v-if="suggestedDebts.length === 0 && groupExpenses.length > 0" class="text-success small mb-3">
                    <i class="bi bi-check-circle-fill me-1"></i>Tout est équilibré !
                </div>

                <div v-if="suggestedDebts.length > 0" class="mb-3">
                    <div v-for="(debt, i) in suggestedDebts" :key="i"
                         class="d-flex align-items-center mb-2 p-2 rounded"
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
                    </div>
                </div>

                <div v-if="groupExpenses.length === 0" class="text-muted small">
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
           FLUX N°11 : CONSULTER LES DÉTAILS D'UN GROUPE (5 requêtes ciblées)
           Flux : clic carte groupe → selectGroup(g) → vide les données précédentes
                  → 4 GET simultanés : dépenses nommées, totaux, membres, soldes
                  → 1 GET séparé : soldes avec participants (Flux 16)
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
            this.groupMembers     = [];
            this.groupBalances    = [];

            // Requête 1 — Dépenses du groupe avec le nom du payeur (JOIN users)
            fetch(`api/backend.php?action=get_group_expenses_named&group_id=${group.id}`)
                .then(res => res.json())
                .then(data => { this.groupExpenses = Array.isArray(data) ? data : []; });

            // Requête 2 — Membres du groupe (JOIN participations, id inclus pour Flux 12/16)
            fetch(`api/backend.php?action=get_group_members&group_id=${group.id}`)
                .then(res => res.json())
                .then(data => { this.groupMembers = Array.isArray(data) ? data : []; });

            // Requête 3 (Flux 16) — Soldes nets avec participants réels
            fetch(`api/backend.php?action=get_group_balances&group_id=${group.id}`)
                .then(res => res.json())
                .then(data => { this.groupBalances = Array.isArray(data) ? data : []; });
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
