const AccueilPage = {
    // Flux descendant (prop) : currentUser vient de app.js → index.html → ici via ":current-user"
    props: ['currentUser'],

    data() {
        return {
            groups: [],           // Groupes chargés depuis la BDD
            recentExpenses: [],   // 5 dernières dépenses avec nom de groupe (jointure SQL)
            balance: { je_dois: 0, on_me_doit: 0, total_mois: 0 }, // Soldes + total mensuel
            monthBalance: { je_dois: 0, on_me_doit: 0 }, // Solde filtré sur le mois affiché dans le calendrier
            loading: true,
            currentDate: '',       // Date du jour affichée dans la barre supérieure
            calendarYear:  new Date().getFullYear(),  // Année affichée dans le calendrier
            calendarMonth: new Date().getMonth()      // Mois affiché (0 = janvier)
        }
    },

    // Observateurs : relancent fetchMonthBalance() chaque fois que le mois ou l'année du calendrier change
    // Flux : clic prevMonth/nextMonth → calendarMonth change → watch déclenché → nouvelle requête backend
    watch: {
        calendarMonth() { this.fetchMonthBalance(); },
        calendarYear()  { this.fetchMonthBalance(); }
    },

    // Propriétés calculées : Vue les recalcule automatiquement quand calendarYear ou calendarMonth changent
    computed: {
        // Nom du mois en français selon calendarMonth
        monthName() {
            const mois = ['Janvier','Février','Mars','Avril','Mai','Juin',
                          'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
            return mois[this.calendarMonth];
        },

        // Génère le tableau des cellules du calendrier (null = case vide, nombre = jour)
        // Flux : calendarYear + calendarMonth → calcul JS → v-for dans le template
        calendarCells() {
            const firstDay  = new Date(this.calendarYear, this.calendarMonth, 1).getDay();
            const nbJours   = new Date(this.calendarYear, this.calendarMonth + 1, 0).getDate();
            const decalage  = (firstDay + 6) % 7; // Convertit dimanche=0 en lundi=0
            const cells = [];
            for (let i = 0; i < decalage; i++) cells.push(null); // Cases vides avant le 1er
            for (let d = 1; d <= nbJours; d++) cells.push(d);
            return cells;
        }
    },

    template: `
        <div>

            <!-- BARRE SUPÉRIEURE : recherche + date (desktop uniquement via d-none d-lg-flex) -->
            <div class="desktop-topbar d-none d-lg-flex">
                <div class="topbar-search">
                    <i class="bi bi-search topbar-search-icon"></i>
                    <input type="text" class="topbar-search-input" placeholder="Rechercher une dépense ou un groupe...">
                </div>
                <span class="topbar-date">{{ currentDate }}</span>
            </div>

            <!-- SPINNER affiché pendant la requête fetch() vers le backend -->
            <div v-if="loading" class="text-center p-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="text-muted mt-2 small">Chargement...</p>
            </div>

            <!-- GRILLE PRINCIPALE : 1 colonne sur mobile, 2 colonnes sur desktop -->
            <div v-else class="dashboard-grid">

                <!-- ============================================================ -->
                <!-- COLONNE GAUCHE : contenu principal du tableau de bord        -->
                <!-- ============================================================ -->
                <div class="dashboard-main">

                    <!-- BANNIÈRE DE BIENVENUE -->
                    <!-- currentUser.pseudo vient de la prop (login → session PHP → app.js → index.html → ici) -->
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

                    <!-- CARTES DE SOLDE -->
                    <!-- Flux : balance.je_dois et balance.on_me_doit calculés côté PHP (formule n-parts) et reçus en JSON -->
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

                    <!-- SECTION GROUPES -->
                    <!-- Flux : tableau groups[] reçu du backend → v-for génère une carte colorée par groupe -->
                    <div class="section-header mb-3">
                        <h6 class="fw-bold text-dark mb-0">Groupes</h6>
                        <a href="#" @click.prevent="$parent.currentPage = 'groupes'" class="section-link">Voir tout</a>
                    </div>

                    <div v-if="groups.length === 0" class="empty-state">
                        <i class="bi bi-collection"></i>
                        <p>Aucun groupe pour le moment.</p>
                    </div>

                    <div class="groups-scroll mb-4">
                        <!-- groupColor(i) retourne un dégradé CSS différent selon l'index -->
                        <div v-for="(g, i) in groups" :key="g.id"
                             class="group-card-pc"
                             :style="{ background: groupColor(i) }">
                            <div class="group-card-name">{{ g.name }}</div>
                            <div class="group-card-desc">{{ g.description }}</div>
                            <i class="bi bi-people-fill group-card-icon"></i>
                        </div>
                    </div>

                    <!-- TABLEAU DES DÉPENSES RÉCENTES -->
                    <!-- Flux : recentExpenses[] contient item.group_name issu d'un LEFT JOIN SQL côté PHP -->
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
                                    <!-- group_name vient de la jointure SQL (LEFT JOIN groups) -->
                                    <td class="text-muted">{{ item.group_name || '—' }}</td>
                                    <td>
                                        <!-- payer_name vient directement du LEFT JOIN users dans SQL 2 -->
                                        <span class="payer-badge">{{ item.payer_name || '—' }}</span>
                                    </td>
                                    <td class="fw-bold text-primary">{{ item.amount }} €</td>
                                    <td class="text-muted">{{ formatDate(item.expense_date) }}</td>
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

                <!-- ============================================================ -->
                <!-- COLONNE DROITE : profil + calendrier (desktop uniquement)    -->
                <!-- Cachée sur mobile via CSS (display:none à moins de 992px)    -->
                <!-- ============================================================ -->
                <div class="dashboard-right">

                    <!-- CARTE PROFIL -->
                    <!-- Flux : currentUser.pseudo et currentUser.nom viennent de la prop -->
                    <div class="right-card mb-3 text-center">
                        <!-- initials() extrait la première lettre du pseudo pour l'avatar -->
                        <div class="profile-avatar">{{ initials(currentUser.pseudo) }}</div>
                        <h6 class="fw-bold mt-3 mb-0">{{ currentUser.pseudo }}</h6>
                        <p class="text-muted small mb-3">{{ currentUser.nom }}</p>
                        <button class="btn btn-outline-primary btn-sm w-100"
                                @click="$parent.currentPage = 'profil'">
                            Mon profil
                        </button>
                    </div>

                    <!-- MINI CALENDRIER -->
                    <div class="right-card">

                        <!-- Navigation : mois précédent / nom du mois / mois suivant -->
                        <!-- Flux : clic → prevMonth/nextMonth → calendarMonth change → computed recalcule -->
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <button class="cal-nav-btn" @click="prevMonth">
                                <i class="bi bi-chevron-left"></i>
                            </button>
                            <span class="fw-bold small">{{ monthName }} {{ calendarYear }}</span>
                            <button class="cal-nav-btn" @click="nextMonth">
                                <i class="bi bi-chevron-right"></i>
                            </button>
                        </div>

                        <!-- En-têtes des jours (lundi en premier, format européen) -->
                        <div class="cal-grid mb-1">
                            <span v-for="(j, i) in ['L','M','M','J','V','S','D']"
                                  :key="'h'+i" class="cal-header">{{ j }}</span>
                        </div>

                        <!-- Cellules du mois -->
                        <!-- Flux : calendarCells (computed) → v-for → isToday/hasExpense ajoutent les classes CSS -->
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

                        <!-- Total du mois -->
                        <!-- Flux : balance.total_mois vient du backend (SQL SUM sur le mois en cours) -->
                        <div class="cal-total mt-3">
                            <span class="text-muted small">Total payé par moi</span>
                            <span class="fw-bold">{{ balance.total_mois }} €</span>
                        </div>

                        <!-- Mini-soldes du mois affiché : recalculés à chaque navigation dans le calendrier -->
                        <!-- Flux : calendarMonth change → watch → fetchMonthBalance → monthBalance mis à jour → Vue re-render -->
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

            <!-- Espace sous le contenu pour la barre mobile (ignoré sur desktop) -->
            <div class="d-lg-none" style="height: 80px;"></div>

        </div>
    `,

    mounted() {
        this.currentDate = this.formatTodayDate();
        // Flux 1 → démarre les deux requêtes vers le backend dès que le composant s'affiche
        this.fetchDashboard();
        this.fetchMonthBalance();
    },

    methods: {
        fetchDashboard() {
            // Flux 1 → Requête GET : le navigateur envoie une demande à backend.php
            // Le backend lit la session PHP (côté serveur) pour identifier l'utilisateur connecté
            fetch('api/backend.php?action=get_dashboard')
                .then(res => res.json())
                .then(data => {
                    // Flux 2 ← Réponse JSON : Vue reçoit les données et met à jour ses variables
                    // La réactivité Vue re-génère automatiquement le HTML à chaque changement
                    this.groups          = data.groups   || [];
                    this.recentExpenses  = data.expenses || [];
                    this.balance         = data.balance  || { je_dois: 0, on_me_doit: 0, total_mois: 0 };
                    this.loading         = false;
                })
                .catch(err => {
                    console.error('Erreur tableau de bord :', err);
                    this.loading = false;
                });
        },

        // --- Navigation calendrier ---
        prevMonth() {
            // Recule d'un mois ; si janvier (0) → passe à décembre de l'année précédente
            if (this.calendarMonth === 0) { this.calendarMonth = 11; this.calendarYear--; }
            else { this.calendarMonth--; }
        },
        nextMonth() {
            if (this.calendarMonth === 11) { this.calendarMonth = 0; this.calendarYear++; }
            else { this.calendarMonth++; }
        },

        // Vérifie si un numéro de jour correspond à aujourd'hui dans le mois affiché
        isToday(day) {
            if (!day) return false;
            const today = new Date();
            return day === today.getDate()
                && this.calendarMonth === today.getMonth()
                && this.calendarYear  === today.getFullYear();
        },

        // Vérifie si une dépense existe à ce jour dans recentExpenses[]
        // Flux : construit la date YYYY-MM-DD et cherche dans recentExpenses reçues du backend
        hasExpense(day) {
            if (!day) return false;
            const m   = String(this.calendarMonth + 1).padStart(2, '0');
            const d   = String(day).padStart(2, '0');
            const key = `${this.calendarYear}-${m}-${d}`;
            return this.recentExpenses.some(e => e.expense_date === key);
        },

        // Convertit le format SQL (YYYY-MM-DD) en format lisible (DD/MM/YYYY)
        formatDate(dateStr) {
            if (!dateStr) return '';
            const [y, m, d] = dateStr.split('-');
            return d + '/' + m + '/' + y;
        },

        // Génère la date du jour en français pour la barre supérieure
        formatTodayDate() {
            const now = new Date();
            const jours = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
            const mois  = ['Janvier','Février','Mars','Avril','Mai','Juin',
                           'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
            return jours[now.getDay()] + ' ' + now.getDate() + ' ' + mois[now.getMonth()] + ' ' + now.getFullYear();
        },

        // Retourne un dégradé CSS différent selon l'index (pour colorier les cartes de groupes)
        groupColor(index) {
            const couleurs = [
                'linear-gradient(135deg, #4361ee, #7c85ff)',
                'linear-gradient(135deg, #6d28d9, #4361ee)',
                'linear-gradient(135deg, #3a86ff, #4361ee)',
                'linear-gradient(135deg, #2d3272, #4361ee)'
            ];
            return couleurs[index % couleurs.length];
        },

        // Extrait la première lettre du pseudo pour l'avatar généré
        initials(pseudo) {
            return pseudo ? pseudo.charAt(0).toUpperCase() : '?';
        },

        // Navigue vers la page de modification d'une dépense
        editExpense(id) {
            this.$parent.editExpenseId = id;
            this.$parent.currentPage   = 'editExpense';
        },

        // Flux : envoie calendarYear + calendarMonth au backend → reçoit le solde filtré pour ce mois
        // Appelé au montage ET à chaque changement de mois via le watch
        fetchMonthBalance() {
            const m = this.calendarMonth + 1; // PHP/SQL attend 1-12, JS utilise 0-11
            fetch(`api/backend.php?action=get_monthly_balance&year=${this.calendarYear}&month=${m}`)
                .then(res => res.json())
                .then(data => {
                    // Flux retour : Vue met à jour monthBalance → les mini-cartes se re-rendent automatiquement
                    this.monthBalance = data.error ? { je_dois: 0, on_me_doit: 0 } : data;
                })
                .catch(() => { this.monthBalance = { je_dois: 0, on_me_doit: 0 }; });
        }
    }
};
