// Groupes.js — Composant "Mes Groupes"
// Flux général : montage → get_groups → liste affichée → clic groupe → 4 requêtes détail → panneau
const GroupesPage = {
    data() {
        return {
            groups: [],
            selectedGroup: null,
            groupExpenses: [],
            groupTotals: [],
            groupMembers: [],
            groupSettlements: [],
            allUsers: [],
            newMemberId: '',
            showAddMember: false
        }
    },

    computed: {
        // Calcule automatiquement qui doit quoi à qui à partir des dépenses du groupe
        // Algorithme : part équitable = total / nb membres ; solde net = payé - part équitable
        suggestedDebts() {
            if (this.groupTotals.length === 0) return [];
            const n = this.groupMembers.length > 0 ? this.groupMembers.length : this.groupTotals.length;
            const total      = this.groupTotals.reduce((sum, t) => sum + parseFloat(t.total_avance), 0);
            const fairShare  = total / n;

            // Initialise le solde de chaque membre à -fairShare (ils doivent leur part)
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

            // Algorithme glouton : couple les débiteurs avec les créditeurs
            const creditors = [], debtors = [];
            Object.entries(balances).forEach(([name, net]) => {
                if (net > 0.01)  creditors.push({ name, amount: net });
                else if (net < -0.01) debtors.push({ name, amount: -net });
            });

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

    template: `
        <div class="p-4">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="fw-bold mb-0">Mes Groupes</h4>
                <button class="btn btn-primary rounded-pill btn-sm" @click="$parent.currentPage = 'nouveauGroupe'">
                    <i class="bi bi-plus-lg"></i> Nouveau
                </button>
            </div>

            <!-- Liste des groupes : clic sur la carte → ouvre le panneau de détail -->
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
                <!-- .stop empêche le clic sur la poubelle d'ouvrir le panneau de détail -->
                <button class="btn btn-link text-danger p-0 ms-3" @click.stop="deleteGroup(g.id)">
                    <i class="bi bi-trash3"></i>
                </button>
            </div>

            <!-- PANNEAU DE DÉTAIL DU GROUPE SÉLECTIONNÉ -->
            <div v-if="selectedGroup" class="light-card p-4 mt-4">

                <!-- En-tête du panneau -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5 class="fw-bold mb-0">
                        <i class="bi bi-collection-fill text-primary me-2"></i>{{ selectedGroup.name }}
                    </h5>
                    <button class="btn btn-outline-secondary btn-sm" @click="selectedGroup = null">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>

                <!-- SECTION : Total avancé par membre -->
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

                <!-- SECTION : Dépenses du groupe -->
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

                <!-- SECTION : Membres du groupe -->
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

                <!-- SECTION : Remboursements -->
                <h6 class="section-label mb-3">Remboursements</h6>

                <!-- Solde équilibré -->
                <div v-if="suggestedDebts.length === 0 && groupTotals.length > 0" class="text-success small mb-3">
                    <i class="bi bi-check-circle-fill me-1"></i>Tout est équilibré !
                </div>

                <!-- Remboursements suggérés (calculés depuis les dépenses) -->
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

                <!-- Historique des remboursements enregistrés -->
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

    mounted() {
        this.fetchGroups();
    },

    methods: {
        fetchGroups() {
            fetch('api/backend.php?action=get_groups')
                .then(res => res.json())
                .then(data => { this.groups = data; });
        },

        selectGroup(group) {
            if (this.selectedGroup && this.selectedGroup.id === group.id) {
                this.selectedGroup = null;
                return;
            }
            this.selectedGroup    = group;
            this.groupExpenses    = [];
            this.groupTotals      = [];
            this.groupMembers     = [];
            this.groupSettlements = [];
            this.showAddMember    = false;
            this.newMemberId      = '';

            fetch(`api/backend.php?action=get_group_expenses_named&group_id=${group.id}`)
                .then(res => res.json())
                .then(data => { this.groupExpenses = Array.isArray(data) ? data : []; });

            fetch(`api/backend.php?action=get_group_totals&group_id=${group.id}`)
                .then(res => res.json())
                .then(data => { this.groupTotals = Array.isArray(data) ? data : []; });

            fetch(`api/backend.php?action=get_group_members&group_id=${group.id}`)
                .then(res => res.json())
                .then(data => { this.groupMembers = Array.isArray(data) ? data : []; });

            fetch(`api/backend.php?action=get_group_settlements&group_id=${group.id}`)
                .then(res => res.json())
                .then(data => { this.groupSettlements = Array.isArray(data) ? data : []; });

            if (this.allUsers.length === 0) {
                fetch('api/backend.php?action=get_users')
                    .then(res => res.json())
                    .then(data => { this.allUsers = Array.isArray(data) ? data : []; });
            }
        },

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
                        if (this.selectedGroup && this.selectedGroup.id === id) this.selectedGroup = null;
                        this.fetchGroups();
                    })
                    .catch(() => { this.$parent.showToast('Erreur réseau.', 'danger'); });
            }
        },

        async addMember() {
            if (!this.newMemberId) return;

            // Flux → POST action=add_member (user_id + group_id)
            // Le backend fait INSERT IGNORE INTO participations → pas d'erreur si déjà membre
            const fd = new FormData();
            fd.append('user_id',  this.newMemberId);
            fd.append('group_id', this.selectedGroup.id);
            const res  = await fetch('api/backend.php?action=add_member', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                this.$parent.showToast('Membre ajouté au groupe !', 'success');
                this.newMemberId   = '';
                this.showAddMember = false;
                // Flux retour ← recharge la liste des membres pour rafraîchir l'affichage
                fetch(`api/backend.php?action=get_group_members&group_id=${this.selectedGroup.id}`)
                    .then(r => r.json())
                    .then(d => { this.groupMembers = Array.isArray(d) ? d : []; });
            } else {
                this.$parent.showToast(data.error || "Erreur lors de l'ajout.", 'danger');
            }
        },

        async recordSettlement(fromName, toName, amount) {
            // Traduit les noms en IDs réels (nécessaires pour la clé étrangère en BDD)
            const sender   = this.allUsers.find(u => u.name === fromName);
            const receiver = this.allUsers.find(u => u.name === toName);
            if (!sender || !receiver) return;

            // Flux → POST action=add_settlement (group_id, sender_id, receiver_id, amount)
            // Le backend INSERT INTO settlements avec la date du jour
            const fd = new FormData();
            fd.append('group_id',    this.selectedGroup.id);
            fd.append('sender_id',   sender.id);
            fd.append('receiver_id', receiver.id);
            fd.append('amount',      amount);
            const res  = await fetch('api/backend.php?action=add_settlement', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                this.$parent.showToast('Remboursement enregistré !', 'success');
                // Flux retour ← recharge l'historique des remboursements pour rafraîchir l'affichage
                fetch(`api/backend.php?action=get_group_settlements&group_id=${this.selectedGroup.id}`)
                    .then(r => r.json())
                    .then(d => { this.groupSettlements = Array.isArray(d) ? d : []; });
            } else {
                this.$parent.showToast("Erreur lors de l'enregistrement.", 'danger');
            }
        },

        formatDate(dateStr) {
            if (!dateStr) return '';
            const [y, m, d] = dateStr.split('-');
            return d + '/' + m + '/' + y;
        }
    }
};
