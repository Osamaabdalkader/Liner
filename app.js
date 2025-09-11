import { 
  app, auth, database, 
  signOut, onAuthStateChanged, ref, get, child,
  checkPromotions, checkTeamPromotions, addPointsAndCheckPromotion, setupRankChangeListener,
  checkAdminStatus, getAllUsers, searchUsers, addPointsToUser, updateAdminStatus,
  getUserIdFromReferralCode, distributePointsToUplines
} from './firebase.js';

// عناصر DOM
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const logoutBtn = document.getElementById('logout-btn');
const copyLinkBtn = document.getElementById('copy-link-btn');

// إدارة Tabs
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        
        // إلغاء تفعيل جميع Tabs
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        
        // تفعيل Tab المحدد
        tab.classList.add('active');
        document.getElementById(`${tabId}-tab`).classList.add('active');
        
        // إذا كان tab الشبكة، قم بتحميل الشبكة
        if (tabId === 'network') {
            loadNetworkTree();
        }
        
        // إذا كان tab الإدارة، قم بتحميل الأعضاء
        if (tabId === 'management') {
            loadNetworkMembers();
        }
    });
});

// تحميل بيانات المستخدم
function loadUserData(userId) {
    // تحميل بيانات المستخدم
    get(ref(database, 'users/' + userId))
        .then(snapshot => {
            const userData = snapshot.val();
            if (userData) {
                document.getElementById('username').textContent = userData.name;
                document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=random`;
                
                document.getElementById('points-count').textContent = userData.points || '0';
                document.getElementById('join-date').textContent = new Date(userData.joinDate).toLocaleDateString('ar-SA');
                
                // إنشاء رابط الإحالة
                const referralLink = `${window.location.origin}${window.location.pathname}?ref=${userData.referralCode}`;
                document.getElementById('referral-link').value = referralLink;
            }
        });
    
    // تحميل الإحالات المباشرة
    loadDirectReferrals(userId);
}

// تحميل الإحالات المباشرة
function loadDirectReferrals(userId) {
    get(ref(database, 'userReferrals/' + userId))
        .then(snapshot => {
            const referralsList = document.getElementById('recent-referrals');
            referralsList.innerHTML = '';
            
            if (snapshot.exists()) {
                const referrals = snapshot.val();
                document.getElementById('referrals-count').textContent = Object.keys(referrals).length;
                
                // عرض آخر 5 إحالات فقط
                const recentReferrals = Object.entries(referrals).slice(0, 5);
                
                recentReferrals.forEach(([id, data]) => {
                    const row = referralsList.insertRow();
                    row.innerHTML = `
                        <td>${data.name}</td>
                        <td>${data.email}</td>
                        <td><span class="user-badge level-0">مستوى 1</span></td>
                        <td>${new Date(data.joinDate).toLocaleDateString('ar-SA')}</td>
                        <td><span style="color: green;">نشط</span></td>
                    `;
                });
            } else {
                referralsList.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center;">لا توجد إحالات حتى الآن</td>
                    </tr>
                `;
            }
        });
}

// تحميل شجرة الشبكة
function loadNetworkTree() {
    const userId = auth.currentUser.uid;
    const networkTree = document.getElementById('network-tree');
    
    networkTree.innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p>جاري تحميل شبكة الإحالات...</p>
        </div>
    `;
    
    // في تطبيق حقيقي، سنقوم بجلب البيانات من Firebase
    // هنا سأعرض بيانات وهمية للتوضيح
    
    setTimeout(() => {
        // بيانات وهمية للتوضيح
        networkTree.innerHTML = `
            <div class="tree-node">
                <div class="node-header">
                    <span>
                        <i class="fas fa-user"></i> أنت (المستوى 0)
                        <span class="user-badge level-0">قائد الشبكة</span>
                    </span>
                    <i class="fas fa-chevron-down collapse-icon"></i>
                </div>
                <div class="node-content">
                    <p>البريد: ${auth.currentUser.email}</p>
                    <p>تاريخ الانضمام: ${new Date().toLocaleDateString('ar-SA')}</p>
                    <p>عدد الإحالات المباشرة: 3</p>
                </div>
                <div class="node-children">
                    <div class="tree-node">
                        <div class="node-header">
                            <span>
                                <i class="fas fa-user"></i> أحمد محمد (المستوى 1)
                                <span class="user-badge level-1">مباشر</span>
                            </span>
                            <i class="fas fa-chevron-down collapse-icon"></i>
                        </div>
                        <div class="node-content">
                            <p>البريد: ahmed@example.com</p>
                            <p>تاريخ الانضمام: 15/08/2023</p>
                            <p>عدد الإحالات: 2</p>
                        </div>
                        <div class="node-children">
                            <div class="tree-node">
                                <div class="node-header">
                                    <span>
                                        <i class="fas fa-user"></i> سعيد عبدالله (المستوى 2)
                                        <span class="user-badge level-2">غير مباشر</span>
                                    </span>
                                </div>
                                <div class="node-content">
                                    <p>البريد: saeed@example.com</p>
                                    <p>تاريخ الانضمام: 20/08/2023</p>
                                    <p>عدد الإحالات: 0</p>
                                </div>
                            </div>
                            <div class="tree-node">
                                <div class="node-header">
                                    <span>
                                        <i class="fas fa-user"></i> فاطمة أحمد (المستوى 2)
                                        <span class="user-badge level-2">غير مباشر</span>
                                    </span>
                                </div>
                                <div class="node-content">
                                    <p>البريد: fatima@example.com</p>
                                    <p>تاريخ الانضمام: 25/08/2023</p>
                                    <p>عدد الإحالات: 1</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tree-node">
                        <div class="node-header">
                            <span>
                                <i class="fas fa-user"></i> محمد علي (المستوى 1)
                                <span class="user-badge level-1">مباشر</span>
                            </span>
                        </div>
                        <div class="node-content">
                            <p>البريد: mohamed@example.com</p>
                            <p>تاريخ الانضمام: 10/08/2023</p>
                            <p>عدد الإحالات: 0</p>
                        </div>
                    </div>
                    <div class="tree-node">
                        <div class="node-header">
                            <span>
                                <i class="fas fa-user"></i> سارة خالد (المستوى 1)
                                <span class="user-badge level-1">مباشر</span>
                            </span>
                            <i class="fas fa-chevron-down collapse-icon"></i>
                        </div>
                        <div class="node-content">
                            <p>البريد: sara@example.com</p>
                            <p>تاريخ الانضمام: 05/08/2023</p>
                            <p>عدد الإحالات: 1</p>
                        </div>
                        <div class="node-children">
                            <div class="tree-node">
                                <div class="node-header">
                                    <span>
                                        <i class="fas fa-user"></i> خالد سعيد (المستوى 2)
                                        <span class="user-badge level-2">غير مباشر</span>
                                    </span>
                                </div>
                                <div class="node-content">
                                    <p>البريد: khaled@example.com</p>
                                    <p>تاريخ الانضمام: 12/08/2023</p>
                                    <p>عدد الإحالات: 0</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // إضافة أحداث للطي والفرد
        document.querySelectorAll('.node-header').forEach(header => {
            header.addEventListener('click', function() {
                const content = this.nextElementSibling;
                const children = this.parentElement.querySelector('.node-children');
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    if (children) children.style.display = 'block';
                    this.parentElement.classList.remove('collapsed');
                } else {
                    content.style.display = 'none';
                    if (children) children.style.display = 'none';
                    this.parentElement.classList.add('collapsed');
                }
            });
        });
        
        // تحديث الإحصائيات
        document.getElementById('total-members').textContent = '7';
        document.getElementById('direct-referrals').textContent = '3';
        document.getElementById('max-level').textContent = '2';
        document.getElementById('active-today').textContent = '5';
        
    }, 1500);
}

// تحميل أعضاء الشبكة للتبويب إدارة المجموعة
function loadNetworkMembers() {
    const tbody = document.getElementById('network-members');
    
    // بيانات وهمية للتوضيح
    const members = [
        { name: 'أحمد محمد', email: 'ahmed@example.com', level: 1, joinDate: '15/08/2023', referrals: 2, points: 150 },
        { name: 'سارة خالد', email: 'sara@example.com', level: 1, joinDate: '05/08/2023', referrals: 1, points: 100 },
        { name: 'محمد علي', email: 'mohamed@example.com', level: 1, joinDate: '10/08/2023', referrals: 0, points: 50 },
        { name: 'سعيد عبدالله', email: 'saeed@example.com', level: 2, joinDate: '20/08/2023', referrals: 0, points: 30 },
        { name: 'فاطمة أحمد', email: 'fatima@example.com', level: 2, joinDate: '25/08/2023', referrals: 1, points: 70 },
        { name: 'خالد سعيد', email: 'khaled@example.com', level: 2, joinDate: '12/08/2023', referrals: 0, points: 20 }
    ];
    
    tbody.innerHTML = '';
    
    members.forEach(member => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${member.name}</td>
            <td>${member.email}</td>
            <td><span class="user-badge level-${member.level-1}">مستوى ${member.level}</span></td>
            <td>${member.joinDate}</td>
            <td>${member.referrals}</td>
            <td>${member.points}</td>
            <td>
                <button style="padding: 5px 10px; font-size: 14px;"><i class="fas fa-envelope"></i></button>
                <button style="padding: 5px 10px; font-size: 14px;"><i class="fas fa-chart-line"></i></button>
            </td>
        `;
    });
    
    // تحديث الإحصائيات
    document.getElementById('top-contributor').textContent = 'أحمد محمد (150 نقطة)';
    document.getElementById('last-activity').textContent = 'اليوم الساعة 15:30';
    document.getElementById('growth-rate').textContent = '15%';
}

// تسجيل الخروج
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.reload();
        });
    });
}

// نسخ رابط الإحالة
if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
        const referralLink = document.getElementById('referral-link');
        referralLink.select();
        document.execCommand('copy');
        alert('تم نسخ رابط الإحالة!');
    });
}

// مشاركة على وسائل التواصل
document.getElementById('share-fb').addEventListener('click', shareOnFacebook);
document.getElementById('share-twitter').addEventListener('click', shareOnTwitter);
document.getElementById('share-whatsapp').addEventListener('click', shareOnWhatsApp);

// دوال المشاركة على وسائل التواصل
function shareOnFacebook() {
    const url = encodeURIComponent(document.getElementById('referral-link').value);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function shareOnTwitter() {
    const text = encodeURIComponent('انضم إلى هذا الموقع الرائع عبر رابط الإحالة الخاص بي!');
    const url = encodeURIComponent(document.getElementById('referral-link').value);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function shareOnWhatsApp() {
    const text = encodeURIComponent('انضم إلى هذا الموقع الرائع عبر رابط الإحالة الخاص بي: ');
    const url = encodeURIComponent(document.getElementById('referral-link').value);
    window.open(`https://wa.me/?text=${text}${url}`, '_blank');
}

// التحقق من وجود مستخدم مسجل دخوله
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadUserData(user.uid);
        document.getElementById('levels-count').textContent = '3'; // قيمة وهمية للتوضيح
    } else {
        // إذا لم يكن المستخدم مسجلاً، توجيهه إلى تسجيل الدخول
        window.location.href = 'login.html';
    }
});

// التحقق من وجود رمز إحالة في URL
const urlParams = new URLSearchParams(window.location.search);
const refCode = urlParams.get('ref');
if (refCode) {
    // في حالة وجود رمز إحالة، يمكنك تخزينه في localStorage لاستخدامه عند التسجيل
    localStorage.setItem('referralCode', refCode);
}
