import Link from "next/link";
import Image from "next/image";
import styles from "@/styles/Home.module.css";

export default function Home() {
  return (
    <main className={styles.container}>
      <div className={styles.content}>
        {/* Hero */}
        <div className={styles.hero}>
          <Image
            src="/nabco.png"
            alt="Nabco Furniture"
            width={280}
            height={90}
            className={styles.heroLogo}
            priority
          />
          <h1 className={styles.title}>
            Furniture Image Search for Nabco Furniture
          </h1>
          <p className={styles.subtitle}>
            Nabco Furniture Image Search uses visual recognition to instantly
            match similar furniture designs from our catalog — streamlining
            organization, style comparison, and product discovery.
          </p>

          {/* Features */}
          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}><span className="material-symbols-outlined">chair</span></div>
              <h3>Visual Match</h3>
              <p>Find similar furniture instantly</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}><span className="material-symbols-outlined">bolt</span></div>
              <h3>Fast Search</h3>
              <p>AI-powered recognition</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}><span className="material-symbols-outlined">compare</span></div>
              <h3>Style Compare</h3>
              <p>Compare designs easily</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}><span className="material-symbols-outlined">target</span></div>
              <h3>Product Discovery</h3>
              <p>Find the perfect piece</p>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className={styles.cta}>
          <Link href="/search" className={`${styles.btn} ${styles.btnPrimary}`}>
            <span className={styles.btnIcon}><span className="material-symbols-outlined">search</span></span>
            Search Furniture
          </Link>
          <Link
            href="/upload"
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            <span className={styles.btnIcon}><span className="material-symbols-outlined">upload</span></span>
            Add Products
          </Link>
        </div>

        {/* Tech Stack */}
        <div className={styles.techStack}>
          <h2>Tech Stack</h2>
          <div className={styles.techGrid}>
            <div className={styles.techItem}>
              <span className={styles.techName}>Backend</span>
              <span className={styles.techValue}>FastAPI 0.104.1</span>
            </div>
            <div className={styles.techItem}>
              <span className={styles.techName}>ML Model</span>
              <span className={styles.techValue}>CLIP ViT-base-patch32</span>
            </div>
            <div className={styles.techItem}>
              <span className={styles.techName}>Database</span>
              <span className={styles.techValue}>PostgreSQL 15 + pgvector</span>
            </div>
            <div className={styles.techItem}>
              <span className={styles.techName}>Storage</span>
              <span className={styles.techValue}>MinIO S3-compatible</span>
            </div>
            <div className={styles.techItem}>
              <span className={styles.techName}>Frontend</span>
              <span className={styles.techValue}>Next.js 14 + React 18</span>
            </div>
            <div className={styles.techItem}>
              <span className={styles.techName}>Vector Index</span>
              <span className={styles.techValue}>IVFFLAT (lists=100)</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className={styles.quickLinks}>
          <h2>Resources</h2>
          <ul className={styles.linksList}>
            <li>
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                <span className="material-symbols-outlined">menu_book</span> API Documentation (Swagger)
              </a>
            </li>
            <li>
              <a
                href="http://localhost:9001"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                <span className="material-symbols-outlined">folder</span> MinIO Object Storage
              </a>
            </li>
            <li>
              <a
                href="http://localhost:8000/api/v1/status"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                <span className="material-symbols-outlined">settings</span> API Status
              </a>
            </li>
          </ul>
        </div>

        {/* Info Panel */}
        <div className={styles.infoPanel}>
          <h3>Phase 3: Complete ✅</h3>
          <p>
            CLIP embeddings are computed automatically for all uploaded images.
            The system performs semantic vector search using pgvector's IVFFLAT
            indexing for fast, accurate results.
          </p>
          <p>
            <strong>Uploads:</strong> Image → S3 Storage → CLIP Embedding →
            pgvector Database → Ready for Search
          </p>
        </div>
      </div>
    </main>
  );
}
