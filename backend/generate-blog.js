const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load .env
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, orderBy, query } = require('firebase/firestore');

// --- Configuration ---
// TO USER: Create a .env file in backend/ or set these variables
// For now, we try to load from process.env or fallback to dummy for structure testing
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "REPLACE_WITH_YOUR_KEY",
    authDomain: process.env.FIREBASE_PROJECT_ID ? `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com` : "REPLACE_WITH_ID.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "REPLACE_WITH_ID",
    storageBucket: process.env.FIREBASE_PROJECT_ID ? `${process.env.FIREBASE_PROJECT_ID}.appspot.com` : "REPLACE_WITH_ID.appspot.com",
    messagingSenderId: "1234567890", // Optional for this script
    appId: "1:1234567890:web:abcdef123456" // Optional for this script
};

// Initialize Firebase (Client SDK in Node)
// Note: This requires 'firebase' npm package (v9+)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const OUTPUT_DIR = path.join(__dirname, '../'); // Root directory
const ARTICLES_DIR = path.join(OUTPUT_DIR, 'articles');

// Ensure directories exist
if (!fs.existsSync(ARTICLES_DIR)) fs.mkdirSync(ARTICLES_DIR, { recursive: true });

async function generate() {
    console.log("🚀 Starting Static Blog Generation...");

    // 1. Fetch Articles
    console.log("📥 Fetching articles from Firestore...");
    let articles = [];
    try {
        // We use the Client SDK logic here. 
        // If security rules block non-auth access, we might need signInAnonymously or Admin SDK.
        // Assuming public read access for articles as per web app logic.
        const q = query(collection(db, "articles"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        snapshot.forEach(doc => {
            articles.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ Found ${articles.length} articles.`);
    } catch (e) {
        console.error("❌ Error fetching articles:", e.message);
        console.log("⚠️  Make sure firebaseConfig is correct and Security Rules allow read.");
        return;
    }

    // 2. Load Templates
    const articleTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'article-template.html'), 'utf8');
    const indexTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'blog-index-template.html'), 'utf8');

    // 3. Generate Individual Article Pages
    let gridHTML = "";

    articles.forEach(article => {
        const safeTitle = article.title.replace(/[^a-z0-9\u0600-\u06FF\-]/gi, '_').substring(0, 50);
        const filename = `${article.id}.html`; // Using ID for permalink stability
        const filePath = path.join(ARTICLES_DIR, filename);

        // Prepare Content
        const dateStr = article.createdAt ? new Date(article.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG');
        const imgParams = article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full h-64 object-cover">` : '<div class="h-12 bg-blue-600"></div>';

        // Fill Template
        let html = articleTemplate
            .replace(/{{page_title}}/g, article.title)
            .replace(/{{page_description}}/g, article.snippet || article.title)
            .replace(/{{article_title}}/g, article.title)
            .replace(/{{publish_date}}/g, dateStr)
            .replace(/{{article_content}}/g, article.content) // Expecting pre-sanitized HTML or raw text
            .replace(/{{article_image_section}}/g, imgParams);

        fs.writeFileSync(filePath, html);
        console.log(`   📄 Generated: ${filename}`);

        // Add to Index Grid
        gridHTML += `
            <div class="bg-white rounded-lg shadow hover:shadow-md transition overflow-hidden border border-gray-100">
                ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full h-48 object-cover">` : '<div class="h-2 bg-blue-600"></div>'}
                <div class="p-6">
                    <h3 class="text-xl font-bold mb-2 text-gray-800 line-clamp-2">${article.title}</h3>
                    <p class="text-gray-500 text-sm mb-4 line-clamp-3">${article.snippet || ""}</p>
                    <a href="articles/${filename}" class="text-blue-600 font-bold hover:underline">اقرأ المزيد &larr;</a>
                </div>
            </div>
        `;
    });

    // 4. Generate Main Blog Page
    if (articles.length === 0) {
        gridHTML = `
        <div class="col-span-1 md:col-span-3 text-center py-16 bg-white rounded-lg shadow-sm border border-dashed border-gray-300">
            <p class="text-gray-500 text-lg">لا توجد مقالات منشورة حالياً.</p>
        </div>`;
    }

    const blogHtml = indexTemplate.replace('{{articles_grid}}', gridHTML);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'blog.html'), blogHtml);
    console.log("✅ Updated blog.html");
    console.log("🎉 Static generation complete!");
}

generate();
