/* =========================================================================
   ACCUEIL.JS — Composant "Tableau de bord"
   Flux traités : Flux 9 (Dashboard)

   TABLE DES MATIÈRES
   ──────────────────────────────────────────────────────────────────────
    1.  Props  .......  currentUser  { id, pseudo, nom, heure }
    2.  Data
          Flux 9        groups · recentExpenses · balance · loading
    3.  Template
          Spinner    (pendant fetchDashboard)
          Bannière · Soldes · Groupes · Dépenses récentes
    4.  Mounted  .....  fetchDashboard (Flux 9)
    5.  Méthodes
          Utilitaires   formatDate · groupColor
          Flux 9  .....  fetchDashboard
   ──────────────────────────────────────────────────────────────────────
========================================================================= */

const AccueilPage = {

    /* =========================================================================
       AUCUN FLUX — Prop reçue depuis app.js via index.html (:current-user)
       Contient les infos de l'utilisateur connecté (id, pseudo, nom, heure)
       ========================================================================= */
    props: ['currentUser'],

    data() {
        return {
            /* -----------------------------------------------------------------
               FLUX N°9 — Données du tableau de bord reçues depuis get_dashboard
               ----------------------------------------------------------------- */
            groups:         [],
            recentExpenses: [],
            balance:        { je_dois: 0, on_me_doit: 0 },
            loading:        true
        }
    },

    /* =========================================================================
       TEMPLATE — Interface utilisateur complète du tableau de bord
       ========================================================================= */
    template: `
        <div>

            <!-- ================================================================
                 AUCUN FLUX — Spinner de chargement
                 Affiché pendant que fetchDashboard() attend la réponse du serveur
                 ================================================================ -->
            <div v-if="loading" class="text-center p-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="text-muted mt-2 small">Chargement...</p>
            </div>

            <!-- ================================================================
                 FLUX N°9 + N°10 — Grille principale du tableau de bord
                 1 colonne sur mobile, 2 colonnes sur desktop (CSS dashboard-grid)
                 ================================================================ -->
            <div v-else class="dashboard-grid">

                <!-- ============================================================
                     COLONNE GAUCHE — Contenu principal (Flux n°9)
                     ============================================================ -->
                <div class="dashboard-main">

                    <!-- AUCUN FLUX — Bannière de bienvenue -->
                    <div class="welcome-card mb-4">
                        <div class="welcome-text">
                            <h4 class="fw-bold mb-1">Bonjour, {{ currentUser.pseudo }} !</h4>
                            <p class="mb-3" style="font-size:14px; opacity:0.85;">
                                Voici le résumé de vos dépenses partagées.
                            </p>
                            <button class="btn-welcome" @click="$parent.currentPage = 'nouveau'">
                                Ajouter une dépense
                            </button>
                        </div>
                        <i class="bi bi-wallet2 welcome-icon"></i>
                    </div>

                    <!-- FLUX N°9 — Cartes de solde global
                         balance.je_dois et balance.on_me_doit calculés par la formule n-parts côté PHP -->
                    <div class="balance-row mb-4">
                        <div class="balance-card balance-owe">
                            <div class="balance-label">Je dois</div>
                            <div class="balance-amount">{{ balance.je_dois }} €</div>
                            <i class="bi bi-arrow-up-circle balance-icon"></i>
                        </div>
                        <div class="balance-card balance-owed">
                            <div class="balance-label">On me doit</div>
                            <div class="balance-amount">{{ balance.on_me_doit }} €</div>
                            <i class="bi bi-arrow-down-circle balance-icon"></i>
                        </div>
                    </div>

                    <!-- FLUX N°9 — Section groupes
                         groups[] reçu du backend → v-for génère une carte colorée par groupe -->
                    <div class="section-header mb-3">
                        <h6 class="fw-bold text-dark mb-0">Groupes</h6>
                        <a href="#" @click.prevent="$parent.currentPage = 'groupes'" class="section-link">Voir tout</a>
                    </div>

                    <div v-if="groups.length === 0" class="empty-state">
                        <i class="bi bi-collection"></i>
                        <p>Aucun groupe pour le moment.</p>
                    </div>

                    <div class="groups-scroll mb-4" v-if="groups.length > 0">
                        <div v-for="(g, i) in groups" :key="g.id"
                             class="group-card-pc"
                             :style="{ background: groupColor(i) }">
                            <div class="group-card-name">{{ g.name }}</div>
                            <div class="group-card-desc">{{ g.description }}</div>
                            <i class="bi bi-people-fill group-card-icon"></i>
                        </div>
                    </div>

                    <!-- FLUX N°9 — Tableau des dépenses récentes
                         recentExpenses[] contient group_name et payer_name issus des LEFT JOIN SQL -->
                    <div class="section-header mb-3">
                        <h6 class="fw-bold text-dark mb-0">Dépenses récentes</h6>
                    </div>

                    <div v-if="recentExpenses.length === 0" class="empty-state">
                        <i class="bi bi-receipt"></i>
                        <p>Aucune dépense enregistrée.</p>
                    </div>

                    <div v-else class="expenses-table-wrapper">
                        <table class="expenses-table">
                            <thead>
                                <tr>
                                    <th>Motif</th>
                                    <th>Groupe</th>
                                    <th>Payé par</th>
                                    <th>Montant</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="item in recentExpenses" :key="item.id">
                                    <td class="fw-bold">{{ item.reason }}</td>
                                    <td class="text-muted">{{ item.group_name || '—' }}</td>
                                    <td>
                                        <span class="payer-badge">{{ item.payer_name || '—' }}</span>
                                    </td>
                                    <td class="fw-bold text-primary">{{ item.amount }} €</td>
                                    <td class="text-muted">{{ formatDate(item.expense_date) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>

            </div>

            <!-- AUCUN FLUX — Espace sous le contenu pour la barre de navigation mobile -->
            <div class="d-lg-none" style="height: 80px;"></div>

        </div>
    `,

    /* =========================================================================
       FLUX N°9 — Montage du composant
       ========================================================================= */
    mounted() {
        this.fetchDashboard();
    },

    methods: {

        /* =========================================================================
           AUCUN FLUX — Fonctions utilitaires internes
           ========================================================================= */

        // Convertit une date SQL "YYYY-MM-DD" en format lisible "DD/MM/YYYY"
        formatDate(dateStr) {
            if (!dateStr) return '';
            const [y, m, d] = dateStr.split('-');
            return d + '/' + m + '/' + y;
        },

        // Retourne un dégradé CSS différent selon l'index pour colorier les cartes de groupes
        groupColor(index) {
            const couleurs = [
                '#D4889A',
                '#D4A020',
                '#D09060',
                '#C8A8B0'
            ];
            return couleurs[index % couleurs.length];
        },

        /* =========================================================================
           FLUX N°9 : DASHBOARD COMPLET — Chargement des données
           Flux : GET backend.php?action=get_dashboard
                  → backend exécute 4 requêtes SQL (groupes, dépenses, soldes, total)
                  → JSON { groups, expenses, balance } → Vue met à jour l'interface
           ========================================================================= */
        fetchDashboard() {
            fetch('api/backend.php?action=get_dashboard')
                .then(res => res.json())
                .then(data => {
                    this.groups         = data.groups   || [];
                    this.recentExpenses = data.expenses || [];
                    this.balance        = data.balance  || { je_dois: 0, on_me_doit: 0 };
                    this.loading        = false;
                })
                .catch(err => {
                    console.error('Erreur tableau de bord :', err);
                    this.loading = false;
                });
        },

    }

};
