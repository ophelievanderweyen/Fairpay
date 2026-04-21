const AccueilPage = {
    data() {
        return {
            expenses: [], // Liste vide au début
            loading: true
        }
    },
    template: `
        <div class="p-4">
            <h4 class="fw-bold mb-4 text-dark">Dernières dépenses</h4>
            
            <div v-if="expenses.length === 0" class="text-center p-5">
                <i class="bi bi-emoji-frown fs-1 text-muted"></i>
                <p class="text-muted mt-2">Aucune dépense pour le moment.</p>
            </div>

            <div v-for="item in expenses" :key="item.id" class="light-card p-3 mb-2 d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                        <i class="bi bi-cart-fill"></i>
                    </div>
                    <div>
                        <span class="fw-bold text-dark d-block">{{ item.reason }}</span>
                        <small class="text-muted">{{ item.expense_date }}</small>
                    </div>
                </div>
                <div class="text-end">
                    <span class="fw-bold text-primary fs-5">{{ item.amount }} €</span>
                </div>
            </div>
            
            <div style="height: 80px;"></div> </div>
    `,
    mounted() {
        // Cette fonction se lance toute seule au chargement de la page
        this.fetchExpenses();
    },
    methods: {
        fetchExpenses() {
            fetch('api/backend.php?action=get_expenses')
                .then(response => response.json())
                .then(data => {
                    this.expenses = data;
                    this.loading = false;
                });
        }
    }
};