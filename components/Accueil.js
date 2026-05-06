/* =========================================================================
   ACCUEIL.JS — Composant "Tableau de bord"
   Flux traités : Flux 9 (Dashboard) · Flux 10 (Calendrier / solde mensuel)
                  Flux 14 (déclenchement de la modification d'une dépense)

   TABLE DES MATIÈRES
   ──────────────────────────────────────────────────────────────────────
    1.  Props  .......  currentUser  { id, pseudo, nom, heure }
    2.  Data
          État          loading · currentDate
          Flux 9        groups · recentExpenses · balance
          Flux 10       calendarYear · calendarMonth · monthBalance
    3.  Watch  .......  calendarMonth · calendarYear  →  fetchMonthBalance
    4.  Computed
          Flux 10       monthName  (nom du mois en français)
                        calendarCells  (cases du calendrier avec décalage lundi)
    5.  Template
          Topbar desktop  (recherche + date du jour)
          Spinner         (pendant fetchDashboard)
          Col. gauche     Bannière · Soldes (Flux 9) · Groupes (Flux 9) · Dépenses (Flux 9)
          Col. droite     Profil · Calendrier + mini-soldes (Flux 10)
    6.  Mounted  .....  fetchDashboard (Flux 9) · fetchMonthBalance (Flux 10)
    7.  Méthodes
          Utilitaires   formatDate · formatTodayDate · groupColor · initials
          Flux 9  .....  fetchDashboard
          Flux 10  ....  prevMonth · nextMonth · isToday · hasExpense · fetchMonthBalance
          Flux 14  ....  editExpense
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
               AUCUN FLUX — Date du jour affichée dans la barre supérieure desktop
               ----------------------------------------------------------------- */
            currentDate: '',

            /* -----------------------------------------------------------------
               FLUX N°9 — Données du tableau de bord reçues depuis get_dashboard
               Remplies par fetchDashboard() au montage du composant
               ----------------------------------------------------------------- */
            groups:         [],                                          // 5 groupes les plus récents
            recentExpenses: [],                                          // 5 dernières dépenses (avec JOIN)
            balance:        { je_dois: 0, on_me_doit: 0, total_mois: 0 }, // Soldes globaux
            loading:        true,                                        // Affiche le spinner pendant le chargement

            /* -----------------------------------------------------------------
               FLUX N°10 — Données du calendrier et du solde mensuel filtré
               ----------------------------------------------------------------- */
            calendarYear:  new Date().getFullYear(),  // Année affichée dans le mini-calendrier
            calendarMonth: new Date().getMonth(),      // Mois affiché (0 = janvier, 11 = décembre)
            monthBalance:  { je_dois: 0, on_me_doit: 0 } // Soldes recalculés pour le mois affiché
        }
    },

    /* =========================================================================
       FLUX N°10 : SOLDE MENSUEL — Observateurs (watch)
       Flux : clic flèche calendrier → calendarMonth ou calendarYear change
              → watch détecte le changement → fetchMonthBalance() relancée automatiquement
       ========================================================================= */
    watch: {
        calendarMonth() { this.fetchMonthBalance(); },
        calendarYear()  { this.fetchMonthBalance(); }
    },

    /* =========================================================================
       FLUX N°10 : SOLDE MENSUEL — Propriétés calculées (computed)
       Recalculées automatiquement par Vue dès que calendarYear ou calendarMonth change
       ========================================================================= */
    computed: {
        // Retourne le nom du mois en français selon calendarMonth (0-11)
        monthName() {
            const mois = ['Janvier','Février','Mars','Avril','Mai','Juin',
                          'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
            return mois[this.calendarMonth];
        },

        // Génère le tableau des cases du calendrier : null = case vide, nombre = jour du mois
        // Flux : calendarYear + calendarMonth → calcul JS → v-for dans le template
        calendarCells() {
            const firstDay = new Date(this.calendarYear, this.calendarMonth, 1).getDay();
            const nbJours  = new Date(this.calendarYear, this.calendarMonth + 1, 0).getDate();
            const decalage = (firstDay + 6) % 7; // Convertit dimanche=0 en lundi=0 (format européen)
            const cells = [];
            for (let i = 0; i < decalage; i++) cells.push(null); // Cases vides avant le 1er
            for (let d = 1; d <= nbJours; d++) cells.push(d);
            return cells;
        }
    },

    /* =========================================================================
       TEMPLATE — Interface utilisateur complète du tableau de bord
       ========================================================================= */
    template: `
        <div>

            <!-- ================================================================
                 AUCUN FLUX — Barre supérieure desktop (recherche + date du jour)
                 Visible uniquement sur desktop via d-none d-lg-flex
                 ================================================================ -->
            <div class="desktop-topbar d-none d-lg-flex">
                <div class="topbar-search">
                    <i class="bi bi-search topbar-search-icon"></i>
                    <input type="text" class="topbar-search-input" placeholder="Rechercher une dépense ou un groupe...">
                </div>
                <span class="topbar-date">{{ currentDate }}</span>
            </div>

            <!-- ================================================================
                 AUCUN FLUX — Spinner de chargement
                 Affiché pendant que fetchDashboard() attend la réponse du serveur
                 ================================================================ -->
            <div v-if="loading" class="text-center p-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="text-muted mt-2 small">Chargement...</p>
            </div>

            <!-- ================================================================
                 FLUX N°9 + N°11 — Grille principale du tableau de bord
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

                    <div class="groups-scroll mb-4">
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
                                    <th></th>
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
                                    <!-- Flux n°14 — Bouton crayon : stocke l'ID et ouvre EditExpense.js -->
                                    <td>
                                        <button class="btn btn-link text-primary p-0" @click="editExpense(item.id)" title="Modifier">
                                            <i class="bi bi-pencil-fill" style="font-size: 13px;"></i>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>

                <!-- ============================================================
                     COLONNE DROITE — Profil + Calendrier (desktop uniquement)
                     ============================================================ -->
                <div class="dashboard-right">

                    <!-- AUCUN FLUX — Carte profil utilisateur -->
                    <div class="right-card mb-3 text-center">
                        <div class="profile-avatar">{{ initials(currentUser.pseudo) }}</div>
                        <h6 class="fw-bold mt-3 mb-0">{{ currentUser.pseudo }}</h6>
                        <p class="text-muted small mb-3">{{ currentUser.nom }}</p>
                        <button class="btn btn-outline-primary btn-sm w-100"
                                @click="$parent.currentPage = 'profil'">
                            Mon profil
                        </button>
                    </div>

                    <!-- FLUX N°10 — Mini calendrier avec navigation par mois -->
                    <div class="right-card">

                        <!-- Navigation : flèches ← / → modifient calendarMonth → watch déclenche fetchMonthBalance -->
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <button class="cal-nav-btn" @click="prevMonth">
                                <i class="bi bi-chevron-left"></i>
                            </button>
                            <span class="fw-bold small">{{ monthName }} {{ calendarYear }}</span>
                            <button class="cal-nav-btn" @click="nextMonth">
                                <i class="bi bi-chevron-right"></i>
                            </button>
                        </div>

                        <!-- En-têtes des jours (semaine commence le lundi) -->
                        <div class="cal-grid mb-1">
                            <span v-for="(j, i) in ['L','M','M','J','V','S','D']"
                                  :key="'h'+i" class="cal-header">{{ j }}</span>
                        </div>

                        <!-- FLUX N°10 — Cellules du calendrier
                             calendarCells (computed) génère les cases ; isToday et hasExpense ajoutent les classes CSS -->
                        <div class="cal-grid">
                            <span v-for="(day, i) in calendarCells" :key="i"
                                  class="cal-day"
                                  :class="{
                                      'cal-today':       isToday(day),
                                      'cal-has-expense': hasExpense(day)
                                  }">
                                {{ day || '' }}
                            </span>
                        </div>

                        <!-- FLUX N°9 — Total payé par moi (tous mois, depuis balance.total_mois) -->
                        <div class="cal-total mt-3">
                            <span class="text-muted small">Total payé par moi</span>
                            <span class="fw-bold">{{ balance.total_mois }} €</span>
                        </div>

                        <!-- FLUX N°10 — Mini-soldes du mois affiché dans le calendrier
                             Recalculés à chaque navigation : watch → fetchMonthBalance → monthBalance mis à jour -->
                        <div class="mini-balance-row mt-3">
                            <div class="mini-balance-card">
                                <span class="mini-balance-label">Je dois</span>
                                <span class="mini-balance-amount">{{ monthBalance.je_dois }} €</span>
                            </div>
                            <div class="mini-balance-card mini-balance-owed">
                                <span class="mini-balance-label">On me doit</span>
                                <span class="mini-balance-amount">{{ monthBalance.on_me_doit }} €</span>
                            </div>
                        </div>

                    </div>

                </div>
            </div>

            <!-- AUCUN FLUX — Espace sous le contenu pour la barre de navigation mobile -->
            <div class="d-lg-none" style="height: 80px;"></div>

        </div>
    `,

    /* =========================================================================
       FLUX N°9 + N°11 — Montage du composant
       Initialise la date affichée, puis lance les deux requêtes vers le backend
       ========================================================================= */
    mounted() {
        this.currentDate = this.formatTodayDate();   // Aucun flux : date du jour pour la topbar
        this.fetchDashboard();                        // Flux 9 : charge groupes + dépenses + soldes
        this.fetchMonthBalance();                     // Flux 10 : charge les soldes du mois courant
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

        // Génère la date du jour en français pour la barre supérieure desktop
        formatTodayDate() {
            const now  = new Date();
            const jours = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
            const mois  = ['Janvier','Février','Mars','Avril','Mai','Juin',
                           'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
            return jours[now.getDay()] + ' ' + now.getDate() + ' ' + mois[now.getMonth()] + ' ' + now.getFullYear();
        },

        // Retourne un dégradé CSS différent selon l'index pour colorier les cartes de groupes
        groupColor(index) {
            const couleurs = [
                'linear-gradient(135deg, #4361ee, #7c85ff)',
                'linear-gradient(135deg, #6d28d9, #4361ee)',
                'linear-gradient(135deg, #3a86ff, #4361ee)',
                'linear-gradient(135deg, #2d3272, #4361ee)'
            ];
            return couleurs[index % couleurs.length];
        },

        // Extrait la première lettre du pseudo en majuscule pour l'avatar généré
        initials(pseudo) {
            return pseudo ? pseudo.charAt(0).toUpperCase() : '?';
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
                    this.balance        = data.balance  || { je_dois: 0, on_me_doit: 0, total_mois: 0 };
                    this.loading        = false;
                })
                .catch(err => {
                    console.error('Erreur tableau de bord :', err);
                    this.loading = false;
                });
        },

        /* =========================================================================
           FLUX N°10 : SOLDE MENSUEL — Navigation dans le calendrier
           Flux : clic flèche → prevMonth/nextMonth → calendarMonth change
                  → watch détecte le changement → fetchMonthBalance() appelée
           ========================================================================= */
        prevMonth() {
            if (this.calendarMonth === 0) { this.calendarMonth = 11; this.calendarYear--; }
            else { this.calendarMonth--; }
        },
        nextMonth() {
            if (this.calendarMonth === 11) { this.calendarMonth = 0; this.calendarYear++; }
            else { this.calendarMonth++; }
        },

        // Retourne true si le numéro de jour correspond à aujourd'hui dans le mois affiché
        isToday(day) {
            if (!day) return false;
            const today = new Date();
            return day === today.getDate()
                && this.calendarMonth === today.getMonth()
                && this.calendarYear  === today.getFullYear();
        },

        // Retourne true si une dépense existe à ce jour dans les dépenses récentes chargées
        hasExpense(day) {
            if (!day) return false;
            const m   = String(this.calendarMonth + 1).padStart(2, '0');
            const d   = String(day).padStart(2, '0');
            const key = `${this.calendarYear}-${m}-${d}`;
            return this.recentExpenses.some(e => e.expense_date === key);
        },

        /* =========================================================================
           FLUX N°10 : SOLDE MENSUEL — Requête filtrée par mois
           Flux : calendarMonth/calendarYear → GET get_monthly_balance?year=&month=
                  → backend requête SQL avec YEAR() et MONTH()
                  → JSON { je_dois, on_me_doit } → monthBalance mis à jour
           ========================================================================= */
        fetchMonthBalance() {
            const m = this.calendarMonth + 1; // PHP/SQL attend 1-12, JS utilise 0-11
            fetch(`api/backend.php?action=get_monthly_balance&year=${this.calendarYear}&month=${m}`)
                .then(res => res.json())
                .then(data => {
                    this.monthBalance = data.error ? { je_dois: 0, on_me_doit: 0 } : data;
                })
                .catch(() => { this.monthBalance = { je_dois: 0, on_me_doit: 0 }; });
        },

        /* =========================================================================
           FLUX N°14 : MODIFIER UNE DÉPENSE — Déclenchement depuis le tableau de bord
           Flux : clic icône crayon → editExpense(id) → stocke l'ID dans app.js
                  → currentPage = 'editExpense' → EditExpense.js s'affiche
           ========================================================================= */
        editExpense(id) {
            this.$parent.editExpenseId = id;           // Sauvegarde l'ID dans la mémoire partagée (app.js)
            this.$parent.currentPage   = 'editExpense'; // Affiche le composant EditExpense.js
        }
    }
};
