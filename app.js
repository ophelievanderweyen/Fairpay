/**
 * app.js - Moteur de navigation de Fairpay
 * Gère l'affichage dynamique des composants Accueil et Nouveau
 */

const { createApp } = Vue;

const app = createApp({ // tout ce qu'on veut appeler ici (les data) on dois mettre le prefixe this mais dans l'HTML PAS DE THIS
    data() {
        return {
            currentPage: 'home',
            currentUser: null,
            isLogin: true,
            error: null,
            showPassword: false,
            login_form: {
                email: '',
                password: ''
            },
            register_form: {
                username: '',
                email: '',
                password: ''
            }
        }
    },
    methods: {
        goTo(page) {
            this.currentPage = page;
            window.scrollTo(0, 0);
        },
        toggleMode() {
            this.isLogin = !this.isLogin;
            this.error = null;
        },
        async login() {
            this.error = null;
            try {
                const res = await fetch('api/backend.php?action=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.login_form)
                });
                const data = await res.json();
                if (res.ok && data.connexion) {
                    this.currentUser = data.user;
                } else {
                    this.error = data.message || 'Erreur de connexion';
                }
            } catch (err) {
                this.error = 'Erreur serveur interne';
            }
        },
        async register() {
            this.error = null;
            try {
                const res = await fetch('api/backend.php?action=register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.register_form)
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    this.isLogin = true;
                    this.error = null;
                    alert('Inscription réussie ! Vous pouvez vous connecter.');
                } else {
                    this.error = data.message || 'Erreur lors de l\'inscription';
                }
            } catch (err) {
                this.error = 'Erreur serveur interne';
            }
        }
    }
});

// Enregistrement des composants
app.component('accueil-page', AccueilPage);
app.component('nouveau-page', NouveauPage);
app.component('nouveau-groupe-page', NouveauGroupePage);
app.component('groupes-page', GroupesPage);
app.component('edit-expense-page', EditExpensePage);
app.component('select-group-page', SelectGroupPage);
app.component('nouveau-page', NouveauPage);
app.component('nouveau-groupe-page', NouveauGroupePage);
app.component('groupes-page', GroupesPage);

// Montage de l'application sur la div #app de ton index.html
app.mount('#app');

