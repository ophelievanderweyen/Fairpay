/* =========================================================================
   APP.JS — Moteur central de Fairpay
   Flux traités : Flux 1 (Inscription) · Flux 2 (Connexion)
                  Flux 6 (Déconnexion) · Flux 7 (Navigation)

   TABLE DES MATIÈRES
   ──────────────────────────────────────────────────────────────────────
    1.  Data
          État global    currentPage · currentUser · toasts
          Auth partagé   isLogin · error · showPassword
          Flux 2         login_form  { email, password }
          Flux 1         register_form  { username, email, password }
    2.  Méthodes
          Utilitaires    showToast · removeToast
          Flux 7         goTo
          Flux 1 & 2     toggleMode
          Flux 2         login
          Flux 1         register
          Flux 6         (directement dans index.html : currentUser = null)
    3.  Composants enregistrés
          accueil-page · nouveau-page · nouveau-groupe-page · groupes-page
    4.  Montage  .....  app.mount('#app')
   ──────────────────────────────────────────────────────────────────────
========================================================================= */

/* =========================================================================
   AUCUN FLUX — Initialisation de l'application Vue
   On importe createApp depuis Vue.js et on configure l'application principale.
   ========================================================================= */
const { createApp } = Vue;

const app = createApp({
    data() {
        return {

            /* -----------------------------------------------------------------
               AUCUN FLUX — Variables globales de navigation et d'état
               ----------------------------------------------------------------- */
            currentPage:   'home',  // Page actuellement affichée ('home', 'groupes', 'profil'...)
            currentUser:   null,    // Infos de l'utilisateur connecté (null = non connecté)
            editExpenseId: null,    // ID de la dépense à modifier, partagé avec EditExpense.js (Flux 15)
            toasts:        [],      // Liste des notifications flottantes à afficher

            /* -----------------------------------------------------------------
               FLUX N°1 & 2 — Variables communes aux formulaires d'authentification
               ----------------------------------------------------------------- */
            isLogin: true,   // true = formulaire de connexion, false = formulaire d'inscription
            error: null,   // Message d'erreur affiché sous le formulaire actif
            showPassword: false,  // Bascule l'affichage du mot de passe en clair

            /* -----------------------------------------------------------------
               FLUX N°2 — Données du formulaire de connexion
               Liées aux inputs via v-model dans index.html
               ----------------------------------------------------------------- */
            login_form: {
                email: '',
                password: ''
            },

            /* -----------------------------------------------------------------
               FLUX N°1 — Données du formulaire d'inscription
               Liées aux inputs via v-model dans index.html
               ----------------------------------------------------------------- */
            register_form: {
                username: '',
                email: '',
                password: ''
            }
        }
    },

    methods: {

        /* =========================================================================
           AUCUN FLUX — Utilitaires globaux partagés entre tous les composants
           ========================================================================= */

        // Affiche une notification flottante (toast) pendant 3 secondes
        // Appelée par les composants via this.$parent.showToast('message', 'success'|'danger')
        showToast(message, type = 'success') {
            const id = Date.now();
            this.toasts.push({ id, message, type });
            setTimeout(() => {
                this.toasts = this.toasts.filter(t => t.id !== id);
            }, 3000);
        },

        // Ferme manuellement un toast via le bouton ×
        removeToast(id) {
            this.toasts = this.toasts.filter(t => t.id !== id);
        },

        /* =========================================================================
           FLUX N°7 : NAVIGATION — Changement de page (barre latérale desktop)
           Flux : clic bouton sidebar → goTo(page) → currentPage change
                  → Vue.js affiche le composant correspondant + remonte en haut
           ========================================================================= */
        goTo(page) {
            this.currentPage = page;
            window.scrollTo(0, 0); // Remonte en haut de la page à chaque changement
        },

        /* =========================================================================
           FLUX N°1 & 2 — Bascule entre le formulaire de connexion et d'inscription
           Flux : clic lien "Créer un compte" / "Se connecter" → isLogin s'inverse
           ========================================================================= */
        toggleMode() {
            this.isLogin = !this.isLogin;
            this.error = null; // Efface les erreurs du formulaire précédent
        },

        /* =========================================================================
           FLUX N°2 : CONNEXION (LOGIN)
           Flux : @submit.prevent="login" (index.html)
                  → POST backend.php?action=login avec email + mot de passe en JSON
                  → currentUser reçoit les données de session
                  → Vue.js bascule de v-if="!currentUser" vers v-else (l'application)
           ========================================================================= */
        async login() {
            this.error = null;
            try {
                const res = await fetch('api/backend.php?action=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.login_form)
                });

                const data = res.json();

                // Flux retour ← connexion confirmée → currentUser stocke les infos de session PHP
                // Vue réagit instantanément : le formulaire disparaît, l'application s'affiche
                if (res.ok && data.connexion) {
                    this.currentUser = data.user;
                } else {
                    this.error = data.message || 'Erreur de connexion';
                }
            } catch (err) {
                this.error = 'Erreur serveur interne';
            }
        },

        /* =========================================================================
           FLUX N°1 : INSCRIPTION (REGISTER)
           Flux : @submit.prevent="register" (index.html)
                  → POST backend.php?action=register avec username + email + mot de passe en JSON
                  → retour automatique en mode connexion + toast de confirmation
           ========================================================================= */
        async register() {
            this.error = null;
            try {
                const res = await fetch('api/backend.php?action=register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.register_form)
                });

                const data = res.json();

                // Flux retour ← inscription réussie → bascule en mode connexion + toast
                if (res.ok && data.success) {
                    this.isLogin = true;
                    this.error = null;
                    this.showToast('Inscription réussie ! Vous pouvez vous connecter.', 'success');
                } else {
                    this.error = data.message || "Erreur lors de l'inscription";
                }
            } catch (err) {
                this.error = 'Erreur serveur interne';
            }
        }

        /* =========================================================================
           FLUX N°7 : DÉCONNEXION — Gérée directement dans index.html
           @click="currentUser = null" vide la variable → Vue rebascule sur le formulaire
           Attention : la session PHP côté serveur n'est PAS détruite (pas d'appel fetch)
           ========================================================================= */
    }
});

/* =========================================================================
   AUCUN FLUX — Enregistrement des composants Vue (une ligne = une page)
   La balise HTML utilisée dans index.html est dérivée du nom (ex: 'accueil-page')
   ========================================================================= */

app.component('accueil-page',        AccueilPage);       // Flux 8
app.component('nouveau-page',        NouveauPage);        // Flux 3, 5
app.component('nouveau-groupe-page', NouveauGroupePage);  // Flux 4
app.component('groupes-page',        GroupesPage);        // Flux 3, 9, 10

/* =========================================================================
   AUCUN FLUX — Montage : Vue prend le contrôle de <div id="app"> dans index.html
   ========================================================================= */
app.mount('#app');
