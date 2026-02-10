
CREATE DATABASE spendwise_db;
USE spendwise_db;

-- 1. Users Table
-- Supports: User Registration and Login
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE KEY idx_email (email),
    INDEX idx_created_at (created_at)
);

-- 2. Categories Table
-- Supports: Category CRUD, Hierarchical Categories, Budgets
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    name VARCHAR(100) NOT NULL,
    type ENUM('expense', 'income', 'transfer') NOT NULL DEFAULT 'expense',
    parent_id INT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(10) DEFAULT '💰',
    sort_order INT DEFAULT 0,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uix_user_category_name (user_id, name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 3. Accounts Table
-- Supports: Bank/Card Account Tracking
CREATE TABLE accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    card_last_four VARCHAR(4),
    account_type VARCHAR(50) DEFAULT 'credit_card',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Import Jobs Table
-- Supports: Statement Import Pipeline (Tracking file uploads)
CREATE TABLE import_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    account_id INT,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    statement_period VARCHAR(100),
    total_transactions INT DEFAULT 0,
    processed_transactions INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- 5. Transactions Table
-- Supports: Transaction CRUD, Import Review, Anomaly Detection
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT,
    account_id INT,
    import_job_id INT,
    
    date DATETIME NOT NULL,
    amount FLOAT NOT NULL,
    merchant VARCHAR(255) NOT NULL,
    description TEXT,
    
    transaction_type ENUM('debit', 'credit') DEFAULT 'debit',
    status ENUM('pending', 'processed', 'reviewed') DEFAULT 'pending',
    source ENUM('manual', 'imported_csv', 'imported_pdf') DEFAULT 'manual',
    
    bank_name VARCHAR(255),
    card_last_four VARCHAR(4),
    statement_period VARCHAR(100),
    
    is_anomaly BOOLEAN DEFAULT FALSE,
    anomaly_score FLOAT DEFAULT 0.0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE SET NULL,
    INDEX idx_user_date (user_id, date),
    INDEX idx_category (category_id)
);

-- 6. Budgets Table
-- Supports: Budget Tracking with Flexible Periods
CREATE TABLE budgets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT,
    
    name VARCHAR(255) NOT NULL,
    amount FLOAT NOT NULL,
    period ENUM('monthly', 'yearly', 'weekly') DEFAULT 'monthly',
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 7. Merchant Rules Table
-- Supports: Auto-categorization based on merchant patterns
CREATE TABLE merchant_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    merchant_pattern VARCHAR(255) NOT NULL,
    category_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);