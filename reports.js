// تهيئة Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAzYZMxqNmnLMGYnCyiJYPg2MbxZMt0co0",
    authDomain: "osama-91b95.firebaseapp.com",
    databaseURL: "https://osama-91b95-default-rtdb.firebaseio.com",
    projectId: "osama-91b95",
    storageBucket: "osama-91b95.appspot.com",
    messagingSenderId: "118875905722",
    appId: "1:118875905722:web:200bff1bd99db2c1caac83",
    measurementId: "G-LEM5PVPJZC"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// المتغيرات العامة
let currentUserId = null;
let charts = {};
let userData = {};

// تهيئة الصفحة عند تحميلها
document.addEventListener('DOMContentLoaded', function() {
    // التحقق من حالة تسجيل الدخول
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUserId = user.uid;
            await loadUserData();
            await loadReportsData();
            setupEventListeners();
        } else {
            // توجيه المستخدم إلى صفحة تسجيل الدخول إذا لم يكن مسجلاً
            window.location.href = 'login.html';
        }
    });
});

// تحميل بيانات المستخدم
async function loadUserData() {
    try {
        const userRef = database.ref('users/' + currentUserId);
        userRef.once('value', (snapshot) => {
            if (snapshot.exists()) {
                userData = snapshot.val();
                
                // تحديث واجهة المستخدم
                document.getElementById('username').textContent = userData.name || userData.email.split('@')[0];
                document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || userData.email)}&background=random`;
                document.getElementById('user-rank').textContent = `مرتبة ${userData.rank || 0}`;
                
                // التحقق من صلاحيات المشرف
                if (userData.isAdmin) {
                    document.getElementById('admin-badge').style.display = 'inline-block';
                    document.getElementById('admin-nav').style.display = 'flex';
                }
            }
        });
    } catch (error) {
        console.error("Error loading user data:", error);
    }
}

// تحميل بيانات التقارير
async function loadReportsData() {
    try {
        // تحميل إحصائيات الشبكة
        await loadNetworkStats();
        
        // تحميل الرسوم البيانية
        await loadCharts();
        
        // تحميل الجداول
        await loadDataTables();
        
    } catch (error) {
        console.error("Error loading reports data:", error);
    }
}

// تحميل إحصائيات الشبكة
async function loadNetworkStats() {
    try {
        // الحصول على جميع أعضاء الشبكة
        const allMembers = await getAllNetworkMembers(currentUserId);
        
        // حساب الإحصائيات
        const totalMembers = allMembers.length;
        const newMembers = calculateNewMembers(allMembers);
        const networkDepth = calculateNetworkDepth(allMembers);
        const growthRate = calculateGrowthRate(allMembers);
        
        // تحديث واجهة المستخدم
        document.getElementById('total-members').textContent = totalMembers;
        document.getElementById('new-members').textContent = newMembers;
        document.getElementById('network-depth').textContent = networkDepth;
        document.getElementById('growth-rate').textContent = `${growthRate}%`;
        
    } catch (error) {
        console.error("Error loading network stats:", error);
    }
}

// الحصول على جميع أعضاء الشبكة
async function getAllNetworkMembers(userId, level = 0, allMembers = []) {
    try {
        // إضافة المستخدم الحالي إلى القائمة
        if (level > 0) { // لا نضيف المستخدم الرئيسي
            const userRef = database.ref('users/' + userId);
            const snapshot = await userRef.once('value');
            if (snapshot.exists()) {
                const userData = snapshot.val();
                userData.level = level;
                allMembers.push(userData);
            }
        }
        
        // الحصول على الإحالات المباشرة
        const referralsRef = database.ref('userReferrals/' + userId);
        const snapshot = await referralsRef.once('value');
        
        if (snapshot.exists()) {
            const referrals = snapshot.val();
            
            // معالجة كل إحالة بشكل متوازي
            const promises = Object.keys(referrals).map(async (memberId) => {
                await getAllNetworkMembers(memberId, level + 1, allMembers);
            });
            
            await Promise.all(promises);
        }
        
        return allMembers;
    } catch (error) {
        console.error("Error getting network members:", error);
        return allMembers;
    }
}

// حساب الأعضاء الجدد (آخر 30 يومًا)
function calculateNewMembers(members) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return members.filter(member => {
        const joinDate = new Date(member.joinDate);
        return joinDate >= thirtyDaysAgo;
    }).length;
}

// حساب أعمق مستوى في الشبكة
function calculateNetworkDepth(members) {
    return Math.max(...members.map(member => member.level), 0);
}

// حساب معدل النمو (نسبة الزيادة في الأعضاء خلال آخر 30 يومًا مقارنة بالـ 30 يومًا السابقة)
function calculateGrowthRate(members) {
    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);
    
    const previous30Days = new Date(last30Days);
    previous30Days.setDate(previous30Days.getDate() - 30);
    
    const membersLast30Days = members.filter(member => {
        const joinDate = new Date(member.joinDate);
        return joinDate >= last30Days && joinDate < now;
    }).length;
    
    const membersPrevious30Days = members.filter(member => {
        const joinDate = new Date(member.joinDate);
        return joinDate >= previous30Days && joinDate < last30Days;
    }).length;
    
    if (membersPrevious30Days === 0) return membersLast30Days > 0 ? 100 : 0;
    
    const growth = ((membersLast30Days - membersPrevious30Days) / membersPrevious30Days) * 100;
    return Math.round(growth);
}

// تحميل الرسوم البيانية
async function loadCharts() {
    try {
        // الحصول على بيانات للرسوم البيانية
        const allMembers = await getAllNetworkMembers(currentUserId);
        
        // رسم مخطط نمو الشبكة
        renderGrowthChart(allMembers);
        
        // رسم مخطط توزيع المستويات
        renderLevelsChart(allMembers);
        
        // رسم مخطط نشاط الأعضاء
        renderActivityChart(allMembers);
        
        // رسم مخطط الترقيات
        renderRanksChart(allMembers);
        
    } catch (error) {
        console.error("Error loading charts:", error);
    }
}

// رسم مخطط نمو الشبكة
function renderGrowthChart(members) {
    const ctx = document.getElementById('growth-chart').getContext('2d');
    
    // تجميع البيانات حسب الأسابيع
    const weeklyData = aggregateDataByWeek(members);
    
    if (charts.growth) {
        charts.growth.destroy();
    }
    
    charts.growth = new Chart(ctx, {
        type: 'line',
        data: {
            labels: weeklyData.labels,
            datasets: [{
                label: 'عدد الأعضاء الجدد',
                data: weeklyData.counts,
                backgroundColor: 'rgba(67, 97, 238, 0.2)',
                borderColor: 'rgba(67, 97, 238, 1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'نمو الشبكة الأسبوعي'
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'عدد الأعضاء'
                    }
                }
            }
        }
    });
}

// تجميع البيانات حسب الأسابيع
function aggregateDataByWeek(members) {
    // إنشاء تاريخ قبل 12 أسبوعًا
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84); // 12 أسبوع * 7 أيام
    
    // تصفية الأعضاء الذين انضموا خلال الـ12 أسبوعًا الماضية
    const recentMembers = members.filter(member => {
        const joinDate = new Date(member.joinDate);
        return joinDate >= twelveWeeksAgo;
    });
    
    // تجميع البيانات حسب الأسبوع
    const weeklyData = {};
    for (let i = 11; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const weekKey = `الأسبوع ${12-i}`;
        weeklyData[weekKey] = 0;
        
        recentMembers.forEach(member => {
            const joinDate = new Date(member.joinDate);
            if (joinDate >= weekStart && joinDate <= weekEnd) {
                weeklyData[weekKey]++;
            }
        });
    }
    
    return {
        labels: Object.keys(weeklyData),
        counts: Object.values(weeklyData)
    };
}

// رسم مخطط توزيع المستويات
function renderLevelsChart(members) {
    const ctx = document.getElementById('levels-chart').getContext('2d');
    
    // تجميع البيانات حسب المستويات
    const levelCounts = {};
    members.forEach(member => {
        const level = member.level;
        levelCounts[level] = (levelCounts[level] || 0) + 1;
    });
    
    // تحضير البيانات للرسم
    const labels = Object.keys(levelCounts).sort((a, b) => a - b).map(level => `المستوى ${level}`);
    const data = Object.keys(levelCounts).sort((a, b) => a - b).map(level => levelCounts[level]);
    
    if (charts.levels) {
        charts.levels.destroy();
    }
    
    charts.levels = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(67, 97, 238, 0.7)',
                    'rgba(58, 12, 163, 0.7)',
                    'rgba(247, 37, 133, 0.7)',
                    'rgba(76, 201, 240, 0.7)',
                    'rgba(249, 199, 79, 0.7)',
                    'rgba(249, 65, 68, 0.7)',
                    'rgba(33, 158, 188, 0.7)',
                    'rgba(142, 202, 230, 0.7)',
                    'rgba(2, 48, 71, 0.7)',
                    'rgba(255, 183, 3, 0.7)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: 'توزيع الأعضاء حسب المستوى'
                }
            }
        }
    });
}

// رسم مخطط نشاط الأعضاء
function renderActivityChart(members) {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    
    // حساب النشاط (هذه بيانات وهمية للتوضيح)
    const activityData = {
        اليوم: Math.floor(Math.random() * 30) + 10,
        الأسبوع: Math.floor(Math.random() * 50) + 40,
        الشهر: Math.floor(Math.random() * 70) + 60
    };
    
    if (charts.activity) {
        charts.activity.destroy();
    }
    
    charts.activity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(activityData),
            datasets: [{
                label: 'نسبة النشاط',
                data: Object.values(activityData),
                backgroundColor: [
                    'rgba(76, 201, 240, 0.7)',
                    'rgba(67, 97, 238, 0.7)',
                    'rgba(58, 12, 163, 0.7)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'نسبة نشاط الأعضاء'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'النسبة المئوية'
                    }
                }
            }
        }
    });
}

// رسم مخطط الترقيات
function renderRanksChart(members) {
    const ctx = document.getElementById('ranks-chart').getContext('2d');
    
    // تجميع البيانات حسب المرتبة
    const rankCounts = {};
    members.forEach(member => {
        const rank = member.rank || 0;
        rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    
    // تحضير البيانات للرسم
    const labels = Object.keys(rankCounts).sort((a, b) => a - b).map(rank => `المرتبة ${rank}`);
    const data = Object.keys(rankCounts).sort((a, b) => a - b).map(rank => rankCounts[rank]);
    
    if (charts.ranks) {
        charts.ranks.destroy();
    }
    
    charts.ranks = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(67, 97, 238, 0.7)',
                    'rgba(58, 12, 163, 0.7)',
                    'rgba(247, 37, 133, 0.7)',
                    'rgba(76, 201, 240, 0.7)',
                    'rgba(249, 199, 79, 0.7)',
                    'rgba(249, 65, 68, 0.7)',
                    'rgba(33, 158, 188, 0.7)',
                    'rgba(142, 202, 230, 0.7)',
                    'rgba(2, 48, 71, 0.7)',
                    'rgba(255, 183, 3, 0.7)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: 'توزيع المراتب بين الأعضاء'
                }
            }
        }
    });
}

// تحميل الجداول
async function loadDataTables() {
    try {
        // الحصول على جميع أعضاء الشبكة
        const allMembers = await getAllNetworkMembers(currentUserId);
        
        // تحميل أعلى الأعضاء أداءً
        loadTopPerformers(allMembers);
        
        // تحميل آخر الإحالات
        loadRecentReferrals(allMembers);
        
    } catch (error) {
        console.error("Error loading data tables:", error);
    }
}

// تحميل أعلى الأعضاء أداءً
function loadTopPerformers(members) {
    // ترتيب الأعضاء حسب عدد النقاط (من الأعلى إلى الأقل)
    const sortedMembers = [...members].sort((a, b) => (b.points || 0) - (a.points || 0));
    
    // أخذ أول 10 أعضاء فقط
    const topPerformers = sortedMembers.slice(0, 10);
    
    // تحديث الجدول
    const tbody = document.getElementById('top-performers');
    tbody.innerHTML = '';
    
    if (topPerformers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا توجد بيانات</td></tr>';
        return;
    }
    
    topPerformers.forEach(member => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${member.name || member.email.split('@')[0]}</td>
            <td>${member.email}</td>
            <td>${member.level}</td>
            <td>${member.referrals ? Object.keys(member.referrals).length : 0}</td>
            <td>${member.points || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// تحميل آخر الإحالات
function loadRecentReferrals(members) {
    // ترتيب الأعضاء حسب تاريخ الانضمام (من الأحدث إلى الأقدم)
    const sortedMembers = [...members].sort((a, b) => 
        new Date(b.joinDate) - new Date(a.joinDate)
    );
    
    // أخذ أول 10 أعضاء فقط
    const recentReferrals = sortedMembers.slice(0, 10);
    
    // تحديث الجدول
    const tbody = document.getElementById('recent-referrals');
    tbody.innerHTML = '';
    
    if (recentReferrals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا توجد بيانات</td></tr>';
        return;
    }
    
    recentReferrals.forEach(member => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${member.name || member.email.split('@')[0]}</td>
            <td>${member.email}</td>
            <td>${member.level}</td>
            <td>${new Date(member.joinDate).toLocaleDateString('ar-SA')}</td>
            <td><span style="color: green;">نشط</span></td>
        `;
        tbody.appendChild(row);
    });
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // تطبيق الفلاتر
    document.getElementById('apply-filters').addEventListener('click', async () => {
        // إعادة تحميل البيانات مع تطبيق الفلاتر
        await loadReportsData();
    });
    
    // تصدير التقرير
    document.getElementById('export-report').addEventListener('click', exportReport);
}

// تصدير التقرير
function exportReport() {
    // إنشاء محتوى CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // إضافة رأس التقرير
    csvContent += "تقرير أداء الشبكة\n\n";
    csvContent += `تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}\n`;
    csvContent += `إجمالي الأعضاء: ${document.getElementById('total-members').textContent}\n`;
    csvContent += `الأعضاء الجدد: ${document.getElementById('new-members').textContent}\n`;
    csvContent += `أعمق مستوى: ${document.getElementById('network-depth').textContent}\n`;
    csvContent += `معدل النمو: ${document.getElementById('growth-rate').textContent}\n\n`;
    
    // إضافة بيانات أعلى الأداء
    csvContent += "أعلى الأعضاء أداءً\n";
    csvContent += "الاسم,البريد الإلكتروني,المستوى,عدد الإحالات,النقاط\n";
    
    const performersTable = document.getElementById('top-performers');
    const performerRows = performersTable.querySelectorAll('tr');
    
    performerRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const rowData = Array.from(cells).map(cell => cell.textContent).join(',');
            csvContent += rowData + '\n';
        }
    });
    
    csvContent += "\n";
    
    // إضافة بيانات آخر الإحالات
    csvContent += "آخر الإحالات\n";
    csvContent += "الاسم,البريد الإلكتروني,المستوى,تاريخ الانضمام,الحالة\n";
    
    const referralsTable = document.getElementById('recent-referrals');
    const referralRows = referralsTable.querySelectorAll('tr');
    
    referralRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const rowData = Array.from(cells).map(cell => cell.textContent).join(',');
            csvContent += rowData + '\n';
        }
    });
    
    // إنشاء رابط التحميل
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `تقرير_أداء_الشبكة_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    
    // تنزيل الملف
    link.click();
    document.body.removeChild(link);
}
