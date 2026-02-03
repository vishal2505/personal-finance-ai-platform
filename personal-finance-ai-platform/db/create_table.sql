
CREATE DATABASE spendwise_db;
USE spendwise_db;

-- 1. Users Table
-- Supports: User Registration and Login
CREATE TABLE users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- Store hashed passwords, not plain text
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Categories Table
-- Supports: Category CRUD, Budgets
CREATE TABLE categories (
    category_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT, -- Links category to specific user
    name VARCHAR(100) NOT NULL,
    type ENUM('income', 'expense') NOT NULL, -- Helps filtering
    is_system_default BOOLEAN DEFAULT FALSE, -- If true, available to all users (optional logic)
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 3. Import Jobs Table
-- Supports: Statement Import Pipeline (Tracking file uploads)
CREATE TABLE import_jobs (
    job_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    status ENUM('pending', 'processing', 'review_required', 'completed', 'failed') DEFAULT 'pending',
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. Transactions Table
-- Supports: Transaction CRUD, Import Review, Anomaly Detection
CREATE TABLE transactions (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    category_id BIGINT, -- Nullable if not yet categorized
    import_job_id BIGINT, -- Links to the source file if imported
    
    amount DECIMAL(15, 2) NOT NULL, -- Always use DECIMAL for currency
    transaction_date DATE NOT NULL,
    description TEXT,
    
    -- Workflow Columns
    is_verified BOOLEAN DEFAULT TRUE, -- FALSE if it came from import and needs review
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP NULL DEFAULT NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    FOREIGN KEY (import_job_id) REFERENCES import_jobs(job_id) ON DELETE SET NULL
);

-- 5. Budgets Table
-- Supports: Budgets Tracking
CREATE TABLE budgets (
    budget_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    amount_limit DECIMAL(15, 2) NOT NULL,
    period_month INT NOT NULL, -- e.g., 1 for January
    period_year INT NOT NULL, -- e.g., 2024
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE
);

-- 6. Savings Goals Table
-- Supports: Goals Tracking
CREATE TABLE savings_goals (
    goal_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    target_amount DECIMAL(15, 2) NOT NULL,
    current_amount DECIMAL(15, 2) DEFAULT 0.00,
    target_date DATE,
    status ENUM('active', 'achieved', 'archived') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 7. AI Monthly Insights Table
-- Supports: AI Monthly Financial Insights
CREATE TABLE ai_monthly_insights (
    insight_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    summary_text TEXT, -- The 3-5 bullet points
    actionable_suggestions TEXT, -- AI suggestions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_monthly_report (user_id, month, year), -- Prevent duplicate reports
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 8. AI Anomaly Detection Table
CREATE TABLE transaction_anomalies (
    anomaly_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT NOT NULL UNIQUE, -- UNIQUE ensures 1:1 relationship
    score DECIMAL(5, 4) NOT NULL, -- e.g., 0.9500
    explanation TEXT,
    model_version VARCHAR(50), -- Optional: tracks which AI model flagged this (e.g., 'v1.2')
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'reviewed', 'dismissed') DEFAULT 'pending', -- track user action
    
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE
);