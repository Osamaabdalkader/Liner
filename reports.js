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
let allNetworkMembers = [];

// حالة الفلاتر الحالية
let currentFilters = {
    time: '30',
    level: 'all',
    rank: 'all',
    activity: 'all',
    startDate: null,
    endDate: null
};

// تهيئة الصفحة عند تحميلها
document.addEventListener('DOMContentLoaded', function() {
    // التحقق من حالة تسجيل الدخول
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUserId = user.uid;
            await loadUserData();
            loadFiltersFromLocalStorage(); // تحميل الفلاتر المحفوظة
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
        showLoadingState();
        
        // الحصول على جميع أعضاء الشبكة
        allNetworkMembers = await getAllNetworkMembers(currentUserId);
        
        // تطبيق الفلاتر على البيانات
        const filteredMembers = applyFilters(allNetworkMembers);
        
        // تحميل إحصائيات الشبكة
        await loadNetworkStats(filteredMembers);
        
        // تحميل الرسوم البيانية
        await loadCharts(filteredMembers);
        
        // تحميل الجداول
        await loadDataTables(filteredMembers);
        
        // تحديث واجهة المستخدم بمعلومات التصفية
        updateFilterSummary(allNetworkMembers.length, filteredMembers.length);
        
        hideLoadingState();
    } catch (error) {
        console.error("Error loading reports data:", error);
        hideLoadingState();
        showError("حدث خطأ في تحميل البيانات");
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
                userData.id = userId; // إضافة المعرف للمستخدم
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

// تحميل إحصائيات الشبكة
async function loadNetworkStats(members) {
    try {
        // حساب الإحصائيات
        const totalMembers = members.length;
        const newMembers = calculateNewMembers(members);
        const networkDepth = calculateNetworkDepth(members);
        const growthRate = calculateGrowthRate(members);
        
        // تحديث واجهة المستخدم
        document.getElementById('total-members').textContent = totalMembers;
        document.getElementById('new-members').textContent = newMembers;
        document.getElementById('network-depth').textContent = networkDepth;
        document.getElementById('growth-rate').textContent = `${growthRate}%`;
        
    } catch (error) {
        console.error("Error loading network stats:", error);
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
async function loadCharts(members) {
    try {
        // رسم مخطط نمو الشبكة
        renderGrowthChart(members);
        
        // رسم مخطط توزيع المستويات
        renderLevelsChart(members);
        
        // رسم مخطط نشاط الأعضاء
        renderActivityChart(members);
        
        // رسم مخطط الترقيات
        renderRanksChart(members);
        
    } catch (error) {
        console.error("Error loading charts:", error);
    }
}

// رسم مخطط نمو الشبكة
function renderGrowthChart(members) {
    const ctx = document.getElementById('growth-chart').getContext('2d');
    
    // تجميع البيانات حسب الشهر
    const monthlyData = aggregateDataByMonth(members);
    
    if (charts.growth) {
        charts.growth.destroy();
    }
    
    charts.growth = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: 'عدد الأعضاء الجدد',
                data: monthlyData.counts,
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
                    text: 'نمو الشبكة الشهري'
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

// دالة مساعدة لتجميع البيانات حسب الشهر
function aggregateDataByMonth(members) {
    // إنشاء كائن لتخزين عدد الأعضاء لكل شهر
    const monthCounts = {};
    
    // أسماء الأشهر بالعربية
    const monthNames = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    // تجميع البيانات
    members.forEach(member => {
        const joinDate = new Date(member.joinDate);
        const year = joinDate.getFullYear();
        const month = joinDate.getMonth();
        
        const key = `${year}-${month}`;
        const label = `${monthNames[month]} ${year}`;
        
        if (!monthCounts[key]) {
            monthCounts[key] = {
                count: 0,
                label: label
            };
        }
        
        monthCounts[key].count++;
    });
    
    // تحويل الكائن إلى مصفوفة وترتيبها حسب التاريخ
    const sortedMonths = Object.keys(monthCounts)
        .sort()
        .map(key => ({
            label: monthCounts[key].label,
            count: monthCounts[key].count
        }));
    
    // إرجاع التنسيق المناسب للرسم البياني
    return {
        labels: sortedMonths.map(item => item.label),
        counts: sortedMonths.map(item => item.count)
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
    
    // حساب النشاط بناءً على آخر مرة سجل فيها المستخدم نقاط
    const activityData = calculateMemberActivity(members);
    
    if (charts.activity) {
        charts.activity.destroy();
    }
    
    charts.activity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['نشط اليوم', 'نشط هذا الأسبوع', 'نشط هذا الشهر'],
            datasets: [{
                label: 'نسبة النشاط',
                data: [
                    activityData.activeToday,
                    activityData.activeThisWeek,
                    activityData.activeThisMonth
                ],
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

// دالة مساعدة لحساب نشاط الأعضاء
function calculateMemberActivity(members) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    let activeToday = 0;
    let activeThisWeek = 0;
    let activeThisMonth = 0;
    
    members.forEach(member => {
        // إذا كان لدى المستخدم آخر نشاط مسجل
        if (member.lastActivity) {
            const lastActivity = new Date(member.lastActivity);
            
            if (lastActivity >= today) {
                activeToday++;
                activeThisWeek++;
                activeThisMonth++;
            } else if (lastActivity >= weekAgo) {
                activeThisWeek++;
                activeThisMonth++;
            } else if (lastActivity >= monthAgo) {
                activeThisMonth++;
            }
        }
        // إذا لم يكن هناك آخر نشاط، نستخدم تاريخ الانضمام كبديل
        else if (member.joinDate) {
            const joinDate = new Date(member.joinDate);
            
            if (joinDate >= monthAgo) {
                activeThisMonth++;
                
                if (joinDate >= weekAgo) {
                    activeThisWeek++;
                    
                    if (joinDate >= today) {
                        activeToday++;
                    }
                }
            }
        }
    });
    
    // حساب النسب المئوية
    const totalMembers = members.length;
    
    return {
        activeToday: totalMembers > 0 ? Math.round((activeToday / totalMembers) * 100) : 0,
        activeThisWeek: totalMembers > 0 ? Math.round((activeThisWeek / totalMembers) * 100) : 0,
        activeThisMonth: totalMembers > 0 ? Math.round((activeThisMonth / totalMembers) * 100) : 0
    };
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
async function loadDataTables(members) {
    try {
        // تحميل أعلى الأعضاء أداءً
        loadTopPerformers(members);
        
        // تحميل آخر الإحالات
        loadRecentReferrals(members);
        
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

// تطبيق الفلاتر على البيانات
function applyFilters(members) {
    return members.filter(member => {
        // تطبيق فلتر الوقت
        if (!applyTimeFilter(member)) return false;
        
        // تطبيق فلتر المستوى
        if (!applyLevelFilter(member)) return false;
        
        // تطبيق فلتر المرتبة
        if (!applyRankFilter(member)) return false;
        
        // تطبيق فلتر النشاط
        if (!applyActivityFilter(member)) return false;
        
        return true;
    });
}

// دالة لتطبيق فلتر الوقت
function applyTimeFilter(member) {
    const joinDate = new Date(member.joinDate);
    const now = new Date();
    
    switch (currentFilters.time) {
        case '7':
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return joinDate >= sevenDaysAgo;
            
        case '30':
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return joinDate >= thirtyDaysAgo;
            
        case '90':
            const ninetyDaysAgo = new Date(now);
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            return joinDate >= ninetyDaysAgo;
            
        case '180':
            const sixMonthsAgo = new Date(now);
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            return joinDate >= sixMonthsAgo;
            
        case '365':
            const oneYearAgo = new Date(now);
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            return joinDate >= oneYearAgo;
            
        case 'custom':
            if (!currentFilters.startDate || !currentFilters.endDate) return true;
            const startDate = new Date(currentFilters.startDate);
            const endDate = new Date(currentFilters.endDate);
            endDate.setHours(23, 59, 59, 999); // حتى نهاية اليوم
            return joinDate >= startDate && joinDate <= endDate;
            
        default:
            return true;
    }
}

// دالة لتطبيق فلتر المستوى
function applyLevelFilter(member) {
    if (currentFilters.level === 'all') return true;
    
    const memberLevel = member.level || 1;
    
    if (currentFilters.level === '4') {
        return memberLevel >= 4;
    }
    
    return memberLevel.toString() === currentFilters.level;
}

// دالة لتطبيق فلتر المرتبة
function applyRankFilter(member) {
    if (currentFilters.rank === 'all') return true;
    
    const memberRank = member.rank || 0;
    
    if (currentFilters.rank === '5') {
        return memberRank >= 5;
    }
    
    return memberRank.toString() === currentFilters.rank;
}

// دالة لتطبيق فلتر النشاط
function applyActivityFilter(member) {
    if (currentFilters.activity === 'all') return true;
    
    const lastActivity = member.lastActivity ? new Date(member.lastActivity) : new Date(member.joinDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (currentFilters.activity === 'active') {
        return lastActivity >= thirtyDaysAgo;
    } else {
        return lastActivity < thirtyDaysAgo;
    }
}

// دالة لتحديث الفلاتر من واجهة المستخدم
function updateFiltersFromUI() {
    currentFilters.time = document.getElementById('time-filter').value;
    currentFilters.level = document.getElementById('level-filter').value;
    currentFilters.rank = document.getElementById('rank-filter').value;
    currentFilters.activity = document.getElementById('activity-filter').value;
    
    // معالجة الفلتر المخصص للوقت
    if (currentFilters.time === 'custom') {
        currentFilters.startDate = document.getElementById('start-date').value;
        currentFilters.endDate = document.getElementById('end-date').value;
    } else {
        currentFilters.startDate = null;
        currentFilters.endDate = null;
    }
    
    // حفظ الفلاتر في localStorage
    saveFiltersToLocalStorage();
}

// دالة لتطبيق الفلاتر على واجهة المستخدم
function applyFiltersToUI() {
    document.getElementById('time-filter').value = currentFilters.time;
    document.getElementById('level-filter').value = currentFilters.level;
    document.getElementById('rank-filter').value = currentFilters.rank;
    document.getElementById('activity-filter').value = currentFilters.activity;
    
    // معالجة الفلتر المخصص للوقت
    if (currentFilters.time === 'custom') {
        document.getElementById('custom-date-range').style.display = 'flex';
        document.getElementById('start-date').value = currentFilters.startDate || '';
        document.getElementById('end-date').value = currentFilters.endDate || '';
    } else {
        document.getElementById('custom-date-range').style.display = 'none';
    }
}

// دالة لحفظ الفلاتر في localStorage
function saveFiltersToLocalStorage() {
    localStorage.setItem('reportFilters', JSON.stringify(currentFilters));
}

// دالة لتحميل الفلاتر من localStorage
function loadFiltersFromLocalStorage() {
    const savedFilters = localStorage.getItem('reportFilters');
    if (savedFilters) {
        currentFilters = JSON.parse(savedFilters);
        applyFiltersToUI();
    }
}

// دالة لإعادة تعيين الفلاتر
function resetFilters() {
    currentFilters = {
        time: '30',
        level: 'all',
        rank: 'all',
        activity: 'all',
        startDate: null,
        endDate: null
    };
    
    applyFiltersToUI();
    loadReportsData();
}

// دالة لتحديث ملخص التصفية
function updateFilterSummary(totalMembers, filteredMembers) {
    const summaryElement = document.getElementById('filter-summary') || createFilterSummaryElement();
    
    let summaryText = `عرض ${filteredMembers} من أصل ${totalMembers} عضو`;
    
    if (filteredMembers < totalMembers) {
        summaryText += ` (تم تصفية ${totalMembers - filteredMembers} عضو)`;
    }
    
    summaryElement.textContent = summaryText;
}

// دالة لإنشاء عنصر ملخص التصفية
function createFilterSummaryElement() {
    const summaryElement = document.createElement('div');
    summaryElement.id = 'filter-summary';
    summaryElement.className = 'filter-summary';
    summaryElement.style.padding = '10px 20px';
    summaryElement.style.backgroundColor = '#f0f8ff';
    summaryElement.style.borderBottom = '1px solid #ddd';
    
    document.querySelector('.charts-container').before(summaryElement);
    return summaryElement;
}

// دوال مساعدة لإدارة حالة التحميل
function showLoadingState() {
    document.querySelectorAll('.chart-container, .table-container').forEach(container => {
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> جاري تحميل البيانات...</div>';
    });
}

function hideLoadingState() {
    document.querySelectorAll('.loading').forEach(loading => {
        loading.remove();
    });
}

function showError(message) {
    const alert = document.createElement('div');
    alert.className = 'alert error';
    alert.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    document.querySelector('.container').prepend(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// تصدير التقرير
function exportReport() {
    // تطبيق الفلاتر على البيانات
    const filteredMembers = applyFilters(allNetworkMembers);
    
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
    
    const topPerformers = getTopPerformers(filteredMembers);
    topPerformers.forEach(member => {
        csvContent += `${member.name || member.email.split('@')[0]},${member.email},${member.level},${member.referrals ? Object.keys(member.referrals).length : 0},${member.points || 0}\n`;
    });
    
    csvContent += "\n";
    
    // إضافة بيانات آخر الإحالات
    csvContent += "آخر الإحالات\n";
    csvContent += "الاسم,البريد الإلكتروني,المستوى,تاريخ الانضمام,الحالة\n";
    
    const recentReferrals = getRecentReferrals(filteredMembers);
    recentReferrals.forEach(member => {
        const status = isActiveMember(member) ? "نشط" : "غير نشط";
        csvContent += `${member.name || member.email.split('@')[0]},${member.email},${member.level},${new Date(member.joinDate).toLocaleDateString('ar-SA')},${status}\n`;
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

// دوال مساعدة للتصدير
function getTopPerformers(members) {
    return [...members]
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, 10);
}

function getRecentReferrals(members) {
    return [...members]
        .sort((a, b) => new Date(b.joinDate) - new Date(a.joinDate))
        .slice(0, 10);
}

function isActiveMember(member) {
    const lastActivity = member.lastActivity ? new Date(member.lastActivity) : new Date(member.joinDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return lastActivity >= thirtyDaysAgo;
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // تطبيق الفلاتر
    document.getElementById('apply-filters').addEventListener('click', async () => {
        updateFiltersFromUI();
        await loadReportsData();
    });
    
    // إعادة تعيين الفلاتر
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
    
    // حفظ تفضيلات الفلاتر
    document.getElementById('save-filters').addEventListener('click', saveFiltersToLocalStorage);
    
    // تصدير التقرير
    document.getElementById('export-report').addEventListener('click', exportReport);
    
    // إظهار/إخفاء نطاق التاريخ المخصص
    document.getElementById('time-filter').addEventListener('change', function() {
        if (this.value === 'custom') {
            document.getElementById('custom-date-range').style.display = 'flex';
        } else {
            document.getElementById('custom-date-range').style.display = 'none';
        }
    });
    }
