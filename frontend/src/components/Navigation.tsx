"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import styles from "@/styles/Navigation.module.css";

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        {/* Logo/Brand */}
        <Link href="/" className={styles.brand}>
          <Image
            src="/nabco.png"
            alt="Nabco Furniture"
            width={140}
            height={45}
            className={styles.logoImage}
            priority
          />
        </Link>

        {/* Nav Links */}
        <ul className={styles.navLinks}>
          <li>
            <Link
              href="/"
              className={`${styles.navLink} ${pathname === "/" ? styles.active : ""}`}
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              href="/search"
              className={`${styles.navLink} ${pathname === "/search" ? styles.active : ""}`}
            >
              Search
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard"
              className={`${styles.navLink} ${pathname === "/dashboard" ? styles.active : ""}`}
            >
              Products
            </Link>
          </li>
          <li>
            <Link
              href="/inventory"
              className={`${styles.navLink} ${pathname?.startsWith("/inventory") ? styles.active : ""}`}
            >
              Inventory
            </Link>
          </li>
          <li>
            <Link
              href="/upload"
              className={`${styles.navLink} ${pathname === "/upload" ? styles.active : ""}`}
            >
              Upload
            </Link>
          </li>
          <li>
            <a href="mailto:contact@nabco.com" className={styles.navLink}>
              Contact
            </a>
          </li>
        </ul>

        {/* Status Indicator */}
        <div className={styles.statusIndicator}>
          <span className={styles.statusDot}></span>
          <span className={styles.statusText}>Live</span>
        </div>
      </div>
    </nav>
  );
}
