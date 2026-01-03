import {
    db, auth,
    collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, updateDoc, doc, setDoc, getDoc,
    signInWithEmailAndPassword, signOut, onAuthStateChanged, limit, where, getDocs
} from "./firebase-config.js";

console.log("App Logic Loaded");
const getTodayDate = () => new Date().toISOString().split('T')[0];

function injectSEOMeta() {
    if (document.querySelector('meta[name="description"]')) return;
    const metaDesc = document.createElement('meta');
    metaDesc.name = "description";
    metaDesc.content = "عيادة د. أحمد - استشاري الباطنة والقلب. حجز مواعيد أونلاين، متابعة الدور، ومقالات طبية موثوقة.";
    document.head.appendChild(metaDesc);

    // Performance
    document.head.innerHTML += `
        <link rel="preconnect" href="https://cdn.tailwindcss.com">
        <link rel="preconnect" href="https://fonts.googleapis.com">
    `;
}
injectSEOMeta();

// --- 1. Booking Logic (Public) ---
const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
    // Load Clinic Config first
    let clinicConfig = null;
    getDoc(doc(db, "settings", "clinic_config")).then(snap => {
        if (snap.exists()) {
            clinicConfig = snap.data();
            // Show closure message if holiday mode
            if (clinicConfig.holidayMode) {
                const form = document.getElementById('bookingForm');
                form.innerHTML = `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert"><strong class="font-bold">عذراً!</strong> <span class="block sm:inline">العيادة مغلقة مؤقتاً للإجازة. يرجى المحاولة لاحقاً.</span></div>`;
            } else {
                // Populate working hours display if exists
                const infoDiv = document.getElementById('clinicHoursInfo');
                if (infoDiv && clinicConfig.openTime && clinicConfig.closeTime) {
                    // Convert 24h to 12h nicely if needed, or just show
                    infoDiv.innerText = `مواعيد العمل: ${clinicConfig.openTime} - ${clinicConfig.closeTime}`;
                }
            }
        }
    });

    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Date Validation
        const dateInput = document.getElementById('appointmentDate');
        const selectedDate = new Date(dateInput.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            return alert("لا يمكن حجز موعد في الماضي!");
        }

        // Check Working Days
        if (clinicConfig && clinicConfig.workDays) {
            const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
            if (!clinicConfig.workDays.includes(dayName)) {
                return alert(`عذراً، العيادة لا تعمل يوم ${selectedDate.toLocaleDateString('ar-EG', { weekday: 'long' })}.`);
            }
        }

        const submitBtn = bookingForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = "جارٍ الحجز...";

        const name = document.getElementById('patientName').value;
        const phone = document.getElementById('patientPhone').value;
        const complaint = document.getElementById('complaint').value;

        try {
            const docRef = await addDoc(collection(db, "appointments"), {
                patientName: name,
                patientPhone: phone,
                complaint: complaint,
                appointmentDate: dateInput.value, // YYYY-MM-DD
                status: "pending",
                createdAt: serverTimestamp(),
                queueNumber: null
            });
            alert(`تم استلام طلبك بنجاح! \nرقم المعاملة: ${docRef.id.slice(0, 5)} \nسيتم تحويلك لواتساب لتأكيد الحجز.`);

            // Redirect to WhatsApp with confirmation message
            const waText = `تأكيد حجز ClinicCore\nالاسم: ${name}\nالتاريخ: ${dateInput.value}\nرقم المعاملة: ${docRef.id}`;
            const waUrl = `https://wa.me/201000000000?text=${encodeURIComponent(waText)}`;
            window.location.href = waUrl;

            bookingForm.reset();
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء الحجز.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        }
    });
}

// --- 2. Auth Logic ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Basic role routing based on email convention
            if (email.includes('doctor')) {
                window.location.href = 'doctor-vitals.html';
            } else {
                window.location.href = 'secretary-hub.html';
            }
        } catch (error) {
            console.error(error);
            alert("فشل الدخول: " + error.message);
        }
    });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        });
    });
}

// Global Auth Check for Protected Pages
function checkAuth() {
    onAuthStateChanged(auth, (user) => {
        if (!user && (window.location.pathname.includes('doctor') || window.location.pathname.includes('secretary'))) {
            window.location.href = 'login.html';
        }
    });
}
// Run auth check if we are not on public pages
if (!window.location.pathname.endsWith('index.html') &&
    !window.location.pathname.endsWith('booking.html') &&
    !window.location.pathname.endsWith('login.html') &&
    !window.location.pathname.endsWith('queue-live.html')) {
    checkAuth();
}

// --- 3. Secretary Logic (Queue Management) ---
const queueList = document.getElementById('queueList');
if (queueList) {
    const q = query(collection(db, "appointments"), where("appointmentDate", "==", getTodayDate()), orderBy("createdAt", "asc"));

    onSnapshot(q, (snapshot) => {
        queueList.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50";

            // Status Badge
            let statusColor = "bg-gray-100 text-gray-800";
            if (data.status === 'confirmed') statusColor = "bg-green-100 text-green-800";
            if (data.status === 'done') statusColor = "bg-blue-100 text-blue-800";

            tr.innerHTML = `
                <td class="p-3">${docSnap.id.slice(0, 5)}</td>
                <td class="p-3 font-semibold">${data.patientName}</td>
                <td class="p-3 text-sm">${data.patientPhone}</td>
                <td class="p-3"><span class="px-2 py-1 rounded text-xs ${statusColor}">${data.status}</span></td>
                <td class="p-3 flex gap-2">
                    ${data.status === 'pending' ? `
                        <button onclick="confirmBooking('${docSnap.id}')" class="text-green-600 hover:text-green-800 font-bold border border-green-200 px-2 py-1 rounded">تأكيد</button>
                    ` : ''}
                    ${data.status !== 'done' ? `
                         <button onclick="deleteBooking('${docSnap.id}')" class="text-red-600 hover:text-red-800 text-xs">حذف</button>
                    ` : ''}
                </td>
            `;
            queueList.appendChild(tr);
        });
    });
}

// Expose functions globally for HTML onclick handlers
window.confirmBooking = async (id) => {
    try {
        // Assign a mock queue number (timestamp based for now, ideally sequential)
        const qNum = Date.now().toString().slice(-3);
        await updateDoc(doc(db, "appointments", id), {
            status: "confirmed",
            queueNumber: qNum
        });
    } catch (e) { alert(e.message); }
};
window.deleteBooking = async (id) => {
    if (confirm('حذف هذا الحجز؟')) {
        await updateDoc(doc(db, "appointments", id), { status: "cancelled" });
    }
};

// --- 4. Doctor Logic (Vitals) ---
const currentPatientInfo = document.getElementById('currentPatientInfo');
if (currentPatientInfo) {
    // Listen for confirmed patients, ordered by creation
    // In a real app, you might want a specific query for 'status == confirmed' & 'limit(1)'
    // For simplicity, we fetch all and filter in memory or just basic query
    const q = query(collection(db, "appointments"), where("appointmentDate", "==", getTodayDate()), orderBy("createdAt", "asc"));

    onSnapshot(q, (snapshot) => {
        // Find first confirmed
        const currentPatient = snapshot.docs.find(d => d.data().status === 'confirmed');

        if (currentPatient) {
            const data = currentPatient.data();
            currentPatientInfo.innerHTML = `
                <div class="text-2xl font-bold text-gray-800 mb-2">${data.patientName}</div>
                <div class="text-gray-500">رقم: ${data.queueNumber}</div>
                <div class="mt-4 p-4 bg-gray-50 rounded border">
                    <span class="block text-xs text-gray-400">الشكوى:</span>
                    <p>${data.complaint || "لا يوجد"}</p>
                </div>
                
                <!-- File Link Section -->
                <div class="mt-4 border-t pt-4">
                    <label class="block text-xs text-gray-500 mb-1">ملفات طبية (رابط Google Drive / أشعة)</label>
                    ${data.fileLink ? `<a href="${data.fileLink}" target="_blank" class="block mb-2 text-blue-600 underline text-sm">📄 عرض الملف المرفق</a>` : ''}
                    <div class="flex gap-2">
                        <input type="url" id="patientFileLink" class="text-sm bg-gray-100 p-2 rounded w-full text-right" placeholder="لصق رابط الملف هنا...">
                        <button onclick="savePatientFileLink('${currentPatient.id}')" class="bg-gray-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap">حفظ</button>
                    </div>
                </div>

                <!-- Notes Section -->
                <div class="mt-4 border-t pt-4">
                     <label class="block text-xs text-gray-500 mb-1">الملاحظات / التشخيص</label>
                     <textarea id="visitNotes" class="w-full border p-2 rounded text-sm h-20" placeholder="اكتب التشخيص أو الملاحظات هنا..."></textarea>
                </div>

                <div class="mt-4">
                     <button onclick="finishSession('${currentPatient.id}')" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 w-full">إنهاء الجلسة</button>
                </div>
            `;

            // Auto-History: Trigger search if phone exists
            if (data.patientPhone) {
                // Determine if we need to fill the search box or just pass query
                const searchInput = document.getElementById('searchPhone');
                if (searchInput) {
                    searchInput.value = data.patientPhone;
                    // Small delay to ensure UI renders
                    setTimeout(() => window.searchPatientHistory(), 500);
                }
            }

        } else {
            currentPatientInfo.innerHTML = "<p class='text-gray-400'>لا يوجد مرضى في الانتظار...</p>";
        }
    });

    window.finishSession = async (id) => {
        const notes = document.getElementById('visitNotes').value || "";
        await updateDoc(doc(db, "appointments", id), {
            status: "done",
            doctorNotes: notes
        });
    };

    window.savePatientFileLink = async (id) => {
        const linkInput = document.getElementById('patientFileLink');
        const url = linkInput.value.trim();
        if (!url) return alert("ضع الرابط أولاً");

        try {
            await updateDoc(doc(db, "appointments", id), {
                fileLink: url
            });
            alert("تم حفظ رابط الملف في سجل المريض!");
            linkInput.value = "";
        } catch (e) {
            alert("خطأ: " + e.message);
        }
    };
}


// --- 5. Public Queue Display ---
const currentNumberEl = document.getElementById('currentNumber');
const nextNumberEl = document.getElementById('nextNumber');

if (currentNumberEl && nextNumberEl) {
    console.log("Initializing Public Queue...");
    const q = query(collection(db, "appointments"), where("appointmentDate", "==", getTodayDate()), where("status", "==", "confirmed"), orderBy("queueNumber", "asc"));

    onSnapshot(q, (snapshot) => {
        // Filter for confirmed patients only
        // In production, use a composite index query: where("status", "==", "confirmed").orderBy("createdAt")
        const confirmedPatients = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => p.status === 'confirmed')
            .sort((a, b) => a.queueNumber - b.queueNumber); // client-side sort backup

        if (confirmedPatients.length > 0) {
            const current = confirmedPatients[0];
            currentNumberEl.innerText = current.queueNumber || "--";
            currentNumberEl.classList.add('animate-pulse'); // Simple visual cue
            setTimeout(() => currentNumberEl.classList.remove('animate-pulse'), 1000);

            if (confirmedPatients.length > 1) {
                const next = confirmedPatients[1];
                nextNumberEl.innerText = next.queueNumber || "--";
            } else {
                nextNumberEl.innerText = "--";
            }
        } else {
            currentNumberEl.innerText = "--";
            nextNumberEl.innerText = "--";
        }
    });
}

// --- 6. Content Manager (AI & FAQ) ---
const articleTopic = document.getElementById('articleTopic');
if (articleTopic) {
    // 6.1 Generate Article
    document.getElementById('generateArticleBtn').addEventListener('click', async () => {
        const btn = document.getElementById('generateArticleBtn');
        const topic = articleTopic.value;
        if (!topic) return alert("اكتب موضوع المقال أولاً");

        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ جارٍ التفكير...";
        btn.disabled = true;

        try {
            // Call our Cloudflare Worker AI Endpoint
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: topic, type: 'article' })
            });

            if (!response.ok) throw new Error("AI Service Failed");

            const data = await response.text();
            document.getElementById('articleContent').value = data;

        } catch (error) {
            console.error(error);
            // Fallback mock check
            document.getElementById('articleContent').value = `(AI Mock Response)\n\nعنوان: ${topic}\n\nهذا نص تجريبي. تأكد من تشغيل الـ Backend ونشر الـ Worker لتفعيل الذكاء الاصطناعي الحقيقي.`;
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // 6.2 Save Article
    document.getElementById('saveArticleBtn').addEventListener('click', async () => {
        const content = document.getElementById('articleContent').value;
        const topic = articleTopic.value;
        const imageUrl = document.getElementById('articleImage') ? document.getElementById('articleImage').value : "";
        if (!content) return;

        try {
            await addDoc(collection(db, "articles"), {
                title: topic,
                content: content,
                imageUrl: imageUrl, // Save URL
                snippet: content.substring(0, 150) + "...",
                createdAt: serverTimestamp(),
                author: auth.currentUser ? auth.currentUser.email : "Doctor"
            });
            alert("تم نشر المقال بنجاح!");
            articleTopic.value = "";
            document.getElementById('articleContent').value = "";
            if (document.getElementById('articleImage')) document.getElementById('articleImage').value = "";
        } catch (e) { alert(e.message); }
    });

    // 6.3 FAQ Management
    const faqList = document.getElementById('faqList');
    if (faqList) {
        // Load FAQs
        onSnapshot(query(collection(db, "faqs"), orderBy("createdAt", "desc")), (snapshot) => {
            faqList.innerHTML = "";
            snapshot.forEach(doc => {
                const d = doc.data();
                const li = document.createElement('li');
                li.innerHTML = `<strong>س:</strong> ${d.question}<br><span class="text-gray-500">ج: ${d.answer}</span>`;
                li.className = "border-b pb-1";
                faqList.appendChild(li);
            });
        });

        document.getElementById('saveFaqBtn').addEventListener('click', async () => {
            const q = document.getElementById('faqQuestion').value;
            const a = document.getElementById('faqAnswer').value;
            if (!q || !a) return;

            try {
                await addDoc(collection(db, "faqs"), {
                    question: q,
                    answer: a,
                    createdAt: serverTimestamp()
                });
                alert("تم حفظ الرد!");
                document.getElementById('faqQuestion').value = "";
                document.getElementById('faqAnswer').value = "";
            } catch (e) { alert(e.message); }
        });
    }
}


// --- 9. Internal Chat System (Doctor <-> Secretary) ---
function initChatSystem(role) {
    const chatBox = document.getElementById('chatBox');
    const msgInput = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendMsgBtn');

    if (!chatBox || !msgInput || !sendBtn) return;

    // Optimize: Last 30 messages only
    const q = query(collection(db, "internal_messages"), orderBy("createdAt", "desc"), limit(30));

    onSnapshot(q, (snapshot) => {
        const msgs = [];
        snapshot.forEach(doc => msgs.push(doc.data()));
        msgs.reverse(); // Show oldest to newest

        chatBox.innerHTML = '';
        msgs.forEach(data => {
            const isMe = data.role === role;
            const align = isMe ? 'text-left' : 'text-right';
            const bg = isMe ? 'bg-blue-100' : 'bg-gray-100';

            chatBox.innerHTML += `
                <div class="${align} mb-2">
                    <span class="text-xs text-gray-500 block">${data.role}</span>
                    <div class="inline-block ${bg} px-3 py-2 rounded-lg text-sm">${data.text}</div>
                </div>
            `;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    // Send Message
    async function sendMsg() {
        const text = msgInput.value.trim();
        if (!text) return;

        await addDoc(collection(db, "internal_messages"), {
            text: text,
            role: role,
            createdAt: serverTimestamp()
        });
        msgInput.value = '';
    }

    sendBtn.addEventListener('click', sendMsg);
    msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMsg() });
}

// Initialize Chat if elements exist
if (document.getElementById('chatBox')) {
    const role = window.location.href.includes('doctor-vitals') ? 'الطبيب' : 'الاستقبال';
    initChatSystem(role);
}

// --- 10. Advanced Queue Logic (Swap/Edit) ---
window.swapWithNext = async (currentId, currentQueueNum) => {
    if (!confirm("هل أنت متأكد من تبديل هذا المريض مع المريض التالي؟ (تخطي)")) return;

    // Find next patient (Today Only)
    const nextQ = query(
        collection(db, "appointments"),
        where("appointmentDate", "==", getTodayDate()),
        where("status", "==", "confirmed"),
        where("queueNumber", ">", currentQueueNum),
        orderBy("queueNumber", "asc"),
        limit(1)
    );
    const snap = await getDocs(nextQ);

    if (snap.empty) return alert("لا يوجد مريض تالي للتبديل معه.");

    const nextDoc = snap.docs[0];
    const nextId = nextDoc.id;
    const nextQueueNum = nextDoc.data().queueNumber;

    // Swap numbers
    try {
        await updateDoc(doc(db, "appointments", currentId), { queueNumber: nextQueueNum });
        await updateDoc(doc(db, "appointments", nextId), { queueNumber: currentQueueNum });
        alert("تم التبديل بنجاح!");
    } catch (e) {
        console.error(e);
        alert("خطأ في التبديل");
    }
};

window.editQueueNumber = async (id, oldNum) => {
    const newNum = prompt("أدخل رقم الدور الجديد:", oldNum);
    if (newNum && newNum !== oldNum) {
        await updateDoc(doc(db, "appointments", id), { queueNumber: parseInt(newNum) });
    }
};

// --- 11. Patient History Search ---
export async function searchPatientHistory(optionalPhone) {
    const searchInput = document.getElementById('historySearchInput');
    const phone = optionalPhone || (searchInput ? searchInput.value : null);

    if (!phone) return;

    const resultsDiv = document.getElementById('historyResults');
    if (resultsDiv) resultsDiv.innerHTML = "<div class='text-center py-4'>جاري البحث...</div>";

    try {
        const q = query(collection(db, "appointments"), where("patientPhone", "==", phone), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        if (resultsDiv) {
            if (snap.empty) {
                resultsDiv.innerHTML = "<div class='text-center py-4 text-gray-400'>لا يوجد تاريخ مسبق لهذا الرقم.</div>";
            } else {
                resultsDiv.innerHTML = "";
                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    const dateStr = data.appointmentDate || "غير محدد";
                    const status = data.status === 'confirmed' ? 'تم الكشف' : (data.status === 'completed' ? 'منتهي' : 'حجز');

                    const item = document.createElement('div');
                    item.className = "p-4 border-b border-gray-100 hover:bg-gray-50 transition";
                    item.innerHTML = `
                        <div class="flex justify-between items-start mb-1">
                            <span class="font-bold text-gray-800">${dateStr}</span>
                            <span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">${status}</span>
                        </div>
                        <div class="text-sm text-gray-600 mb-2">${data.complaint || 'بدون شكوى مسجلة'}</div>
                        ${data.notes ? `<div class="text-xs bg-yellow-50 p-2 rounded text-gray-700"><strong>التشخيص:</strong> ${data.notes}</div>` : ''}
                        ${data.fileLink ? `<a href="${data.fileLink}" target="_blank" class="text-xs text-blue-600 underline mt-2 inline-block">عرض الملف الطبي</a>` : ''}
                    `;
                    resultsDiv.appendChild(item);
                });
            }
        }
    } catch (e) {
        console.error(e);
        if (resultsDiv) resultsDiv.innerHTML = "<div class='text-red-500'>خطأ في تحميل التاريخ.</div>";
    }
}

// --- 12. Blog & Home Articles ---

export async function loadHomeArticles() {
    const container = document.getElementById('homeArticles');
    if (!container) return;

    try {
        const q = query(collection(db, "articles"), orderBy("createdAt", "desc"), limit(3));
        const snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = "<p class='text-gray-400 text-center col-span-3'>لا توجد مقالات مضافة بعد.</p>";
            return;
        }

        container.innerHTML = "";
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const card = document.createElement('div');
            card.className = "bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl transition group border border-gray-100";
            card.innerHTML = `
                <div class="h-48 overflow-hidden rounded-xl mb-6">
                    <img src="${data.image || 'https://images.unsplash.com/photo-1576091160550-217359f4ecf8?auto=format&fit=crop&q=80&w=800'}" 
                         class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${data.title}">
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-3">${data.title}</h3>
                <p class="text-gray-500 text-sm line-clamp-3 mb-4">${data.content.replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
                <a href="articles/${docSnap.id}.html" class="text-blue-600 font-bold hover:text-blue-800 transition">اقرأ المزيد &larr;</a>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Error loading home articles:", e);
        container.innerHTML = "<p class='text-red-500 text-center col-span-3'>خطأ في تحميل المقالات.</p>";
    }
}

export async function initBlogPage() {
    const grid = document.getElementById('articlesGrid');
    if (!grid) return;

    // If grid already has children (from static gen), don't reload dynamically
    if (grid.children.length > 0 && !grid.querySelector('.animate-pulse')) {
        console.log("Articles already present (static version).");
        return;
    }

    try {
        const q = query(collection(db, "articles"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        grid.innerHTML = "";
        if (snap.empty) {
            grid.innerHTML = "<p class='text-gray-400 text-center col-span-3'>لا توجد مقالات مضافة بعد.</p>";
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const card = document.createElement('div');
            card.className = "bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl transition group border border-gray-100";
            card.innerHTML = `
                <div class="h-48 overflow-hidden rounded-xl mb-6">
                    <img src="${data.image || 'https://images.unsplash.com/photo-1576091160550-217359f4ecf8?auto=format&fit=crop&q=80&w=800'}" 
                         class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${data.title}">
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-3">${data.title}</h3>
                <p class="text-gray-500 text-sm line-clamp-3 mb-4">${data.content.replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
                <a href="articles/${docSnap.id}.html" class="text-blue-600 font-bold hover:text-blue-800 transition">اقرأ المزيد &larr;</a>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        console.error("Error loading blog page:", e);
        grid.innerHTML = "<p class='text-red-500 text-center col-span-3'>خطأ في تحميل المقالات.</p>";
    }
}

// Ensure other internal functions are exported if needed or bind to window
window.searchPatientHistory = searchPatientHistory;
window.loadHomeArticles = loadHomeArticles;
window.initBlogPage = initBlogPage;
