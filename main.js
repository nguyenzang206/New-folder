const socket = io(); 
let websites = []; 
let currentIndex = 0;

const trafficHeap = new class MaxHeap {
    constructor() { this.heap = []; }
    clear() { this.heap = []; }
    insert(website) {
        const currentTraffic = website.access.at(-1);
        const node = { name: website.name, logo: website.logo, traffic: currentTraffic };
        this.heap.push(node);
        this.bubbleUp();
    }
    bubbleUp() {
        let index = this.heap.length - 1;
        while (index > 0) {
            let element = this.heap[index];
            let parentIndex = Math.floor((index - 1) / 2);
            let parent = this.heap[parentIndex];
            if (parent.traffic >= element.traffic) break;
            this.heap[parentIndex] = element;
            this.heap[index] = parent;
            index = parentIndex;
        }
    }
    peek() { return this.heap[0]; }
    getSortedList() { return [...this.heap].sort((a, b) => b.traffic - a.traffic); }
}();

socket.on('update_data', (serverData) => {
    serverData.forEach(sItem => {
        let localItem = websites.find(w => w.name === sItem.name);
        if (localItem) {
            localItem.access = sItem.access;
            localItem.search = sItem.search;
            localItem.transaction = sItem.transaction;
            localItem.interaction = sItem.interaction;
            if (sItem.labels) localItem.labels = sItem.labels;
            
            if (localItem.chart) {
                localItem.chart.data.labels = sItem.labels || Array(sItem.access.length).fill("");
                localItem.chart.data.datasets[0].data = sItem.access;
                localItem.chart.data.datasets[1].data = sItem.search;
                localItem.chart.data.datasets[2].data = sItem.transaction;
                localItem.chart.data.datasets[3].data = sItem.interaction;
                localItem.chart.update('none');
            }
        } else {
            websites.push(sItem);
        }
    });

    for (let i = websites.length - 1; i >= 0; i--) {
        if (!serverData.find(s => s.name === websites[i].name)) {
            if (websites[i].chart) websites[i].chart.destroy();
            websites.splice(i, 1);
        }
    }

    initCharts(); 
    updateHomeUI();
    if (typeof currentIndex !== 'undefined') updateCardData(currentIndex);
});

let list = document.querySelectorAll(".navigation li");

function activeLink() {
    list.forEach(item => item.classList.remove("hovered"));
    this.classList.add("hovered");
}
list.forEach(item => item.addEventListener("mouseenter", activeLink));

let toggle = document.querySelector(".toggle");
let navigation = document.querySelector(".navigation");
let main = document.querySelector(".main");

if (toggle) {
    toggle.onclick = function () {
        navigation.classList.toggle("active");
        main.classList.toggle("active");
    };
}

if (navigation) {
    navigation.addEventListener('mouseleave', () => {
        list.forEach(item => item.classList.remove('hovered'));
    });
}

function generateAutoLogo(name) {
    let cleanName = name.trim().toLowerCase();
    if (!cleanName.includes('.')) cleanName += ".com";
    return `https://logo.clearbit.com/${cleanName}`;
}

function formatNumber(numInBillions) {
    let value = numInBillions * 1000000000;
    if (value >= 1000000000) return (value / 1000000000).toFixed(2) + " B";
    else if (value >= 1000000) return (value / 1000000).toFixed(2) + " M";
    else if (value >= 1000) return (value / 1000).toFixed(2) + " K";
    else return Math.round(value).toString();
}

function updateCardData(index) {
    const site = websites[index];
    if (!site) return;
    document.getElementById('access-card').querySelector('.numbers').textContent = formatNumber(site.access.at(-1));
    document.getElementById('search-card').querySelector('.numbers').textContent = formatNumber(site.search.at(-1));
    document.getElementById('transaction-card').querySelector('.numbers').textContent = formatNumber(site.transaction.at(-1));
    document.getElementById('interaction-card').querySelector('.numbers').textContent = formatNumber(site.interaction.at(-1));
}

function updateHomeUI() {
    trafficHeap.clear();
    websites.forEach(site => trafficHeap.insert(site));

    const topWeb = trafficHeap.peek();
    if (topWeb) {
        const topName = document.getElementById('top-name');
        const topTraffic = document.getElementById('top-traffic');
        const topLogo = document.getElementById('top-logo');
        if (topName) topName.innerText = topWeb.name;
        if (topTraffic) topTraffic.innerText = formatNumber(topWeb.traffic);
        if (topLogo) topLogo.src = topWeb.logo;
    }

    const listView = document.getElementById('list-view');
    if (listView) {
        const sortedList = trafficHeap.getSortedList();
        let html = "";
        sortedList.forEach((web, index) => {
            let rankColor = "#ccc";
            if (index === 0) rankColor = "#ffd700";
            else if (index === 1) rankColor = "#95a5a6";
            else if (index === 2) rankColor = "#cd7f32";

            html += `
                <div class="lb-item">
                    <div class="lb-left">
                        <span class="rank-badge" style="color: ${rankColor}">#${index + 1}</span>
                        <img class="tiny-logo" src="${web.logo}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3645/3645245.png'">
                        <b>${web.name}</b>
                    </div>
                    <div class="lb-right" style="display: flex; align-items: center; gap: 15px;">
                        <span class="item-traffic">${formatNumber(web.traffic)}</span>
                        <ion-icon name="trash-outline" 
                                  style="color: #ff4d4d; cursor: pointer; font-size: 1.2rem;"
                                  onclick="deleteWebsite('${web.name}')">
                        </ion-icon>
                    </div>
                </div>`;
        });
        listView.innerHTML = html;
    }
}

window.deleteWebsite = function (siteName) {
    if (confirm("Bạn có chắc chắn muốn xóa " + siteName + " khỏi danh sách?")) {
        socket.emit('delete_site', siteName);
    }
}

window.handleAddClick = function () {
    const nameInput = document.getElementById('inpName');
    const trafficInput = document.getElementById('inpTraffic');
    const name = nameInput.value;
    const trafficRaw = trafficInput.value;

    if (name === "" || trafficRaw === "") {
        alert("Vui lòng nhập đủ thông tin!");
        return;
    }

    let rawNumber = parseFloat(trafficRaw);
    let trafficVal = rawNumber / 1000000000;

    const newSite = {
        name: name,
        logo: generateAutoLogo(name),
        access: [trafficVal],
        search: [trafficVal * 2],
        transaction: [trafficVal * 0.1],
        interaction: [trafficVal * 5],
        chart: null,
        labels: ["Now"]
    };

    socket.emit('add_new_site', newSite);

    nameInput.value = "";
    trafficInput.value = "";
    toggleModal();
    alert(`Đã gửi yêu cầu thêm ${name}. Đợi Python xử lý...`);
};

window.toggleModal = function () {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.toggle('active');
};

function initCharts() {
    websites.forEach((site, index) => {
        if (site.chart) return;

        const canvas = document.getElementById(`trafficChart${index}`);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const gradients = [
            ctx.createLinearGradient(0, 0, 0, 400),
            ctx.createLinearGradient(0, 0, 0, 400),
            ctx.createLinearGradient(0, 0, 0, 400),
            ctx.createLinearGradient(0, 0, 0, 400)
        ];
        const colors = ['rgba(0, 255, 255,', 'rgba(255, 0, 170,', 'rgba(0, 255, 153,', 'rgba(255, 234, 0,'];

        gradients.forEach((g, i) => {
            g.addColorStop(0, colors[i] + ' 0.6)');
            g.addColorStop(1, colors[i] + ' 0)');
        });

        site.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: site.labels || [],
                datasets: [
                    { label: 'Truy cập', data: site.access, borderColor: '#00ffff', backgroundColor: gradients[0], borderWidth: 3.5, fill: true, tension: 0.45 },
                    { label: 'Tìm kiếm', data: site.search, borderColor: '#ff00aa', backgroundColor: gradients[1], borderWidth: 3.5, fill: true, tension: 0.45 },
                    { label: 'Giao dịch', data: site.transaction, borderColor: '#00ff99', backgroundColor: gradients[2], borderWidth: 3.5, fill: true, tension: 0.45 },
                    { label: 'Tương tác', data: site.interaction, borderColor: '#ffea00', backgroundColor: gradients[3], borderWidth: 3.5, fill: true, tension: 0.45 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#808080' } },
                    y: { ticks: { color: '#808080' }, beginAtZero: true }
                },
                animation: false
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const homeContent = document.getElementById('home-content');

    window.showChart = function (index) {
        if (homeContent) homeContent.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';

        document.querySelectorAll('.chart-container').forEach(c => c.classList.remove('active'));
        const targetChart = document.getElementById(`chart${index}`);
        if (targetChart) targetChart.classList.add('active');

        currentIndex = index;
        updateCardData(currentIndex);
    };

    window.showHome = function () {
        if (mainContent) mainContent.style.display = 'none';
        if (homeContent) homeContent.style.display = 'block';
        updateHomeUI();
    };

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', e => {
            if (e.key === 'Enter') {
                const q = searchInput.value.trim().toLowerCase();
                if (!q) return;
                const idx = websites.findIndex(s => s.name.toLowerCase().includes(q));
                if (idx !== -1) {
                    showChart(idx);
                    highlightAndScrollToSite(idx);
                } else {
                    alert("Không tìm thấy website: " + q);
                }
                searchInput.value = '';
            }
        });
    }
});

function highlightAndScrollToSite(index) {
    const items = document.querySelectorAll('.navigation li');
    const navIndex = index + 2;
    items.forEach(el => el.classList.remove('hovered'));
    if (items[navIndex]) {
        const target = items[navIndex];
        target.classList.add('hovered');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}